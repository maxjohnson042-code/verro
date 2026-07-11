import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AccessGrantsService } from "../access-grants/access-grants.service";
import { BrokerVerificationService } from "../compliance/broker-verification.service";
import { ComplianceService, STANDARD_LENDER_TRAINING } from "../compliance/compliance.service";
import { OrgType, RelationshipStatus } from "@verro/db";

// Non-terminal relationship statuses - used when checking "does this broker
// already have a live connection to org X" (as opposed to one that already
// ended in DECLINED/REVOKED and shouldn't block a fresh attempt).
const NON_TERMINAL_STATUSES: RelationshipStatus[] = [
  "INVITED",
  "PENDING_ACCEPTANCE",
  "CREDIT_REP_PENDING",
  "ACCREDITATION_PENDING",
  "ACTIVE",
  "FLAGGED",
  "SUSPENDED",
];

// Epic: Broker onboarding (BRD) - Milestone 1/2 walking skeleton.
// Personal info lives directly on Broker. Business/entity info lives on
// BrokerBusiness (see the broker-business module) since a broker's
// business can be a sole trader or a complex multi-broker entity.
//
// Self-registration (creating the Broker row) moved to AuthService -
// registerBroker there creates the Broker + PortalUser login together in
// one transaction. Everything in this service now assumes a Broker
// already exists and operates on it by id.
//
// Section 2 (reworked): verification and organization connections are two
// separate phases. submitOnboarding() only ever advances the broker's own
// BrokerVerificationStatus - it doesn't touch relationships anymore.
// addRelationship() is blocked until that verification is ACTIVE, since a
// broker can't connect with any organization before their one-time
// verification/DD is complete.
//
// Section 2 (further reworked) - chain of trust: once verification is
// ACTIVE, addRelationship() enforces the ordering the business requires.
// Association and aggregator are independent of each other - a broker can
// connect to either first, in any order - but a lender relationship always
// requires an ACTIVE aggregator (exclusive, auto-revoking any prior
// aggregator), restricted to that aggregator's AggregatorLenderPanel.
// Association is not required for a lender connection - most lenders
// expect one in practice, but it isn't enforced here (see the "Waiting on
// others"/context display instead). See ComplianceService for the cascade
// that offboards lender relationships when the aggregator relationship
// ends.
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessGrantsService: AccessGrantsService,
    private readonly brokerVerificationService: BrokerVerificationService,
    private readonly complianceService: ComplianceService,
  ) {}

  // Ownership check for routes keyed by relationshipId rather than
  // brokerId directly (e.g. DELETE /brokers/relationships/:relationshipId)
  // - the controller can't compare against the URL's :id there, so it
  // looks the relationship up first.
  async assertRelationshipOwnedBy(relationshipId: string, brokerId: string | null) {
    const relationship = await this.prisma.brokerRelationship.findUniqueOrThrow({
      where: { id: relationshipId },
    });
    if (!brokerId || relationship.brokerId !== brokerId) {
      throw new ForbiddenException("You can only manage your own relationships");
    }
  }

  async getBrokerProfile(brokerId: string) {
    return this.prisma.broker.findUnique({
      where: { id: brokerId },
      include: {
        relationships: {
          include: { organization: true, trainingRecords: true, statusEvents: true },
        },
        businessMemberships: { include: { brokerBusiness: true } },
        documents: true,
        accessGrants: { include: { organization: true } },
        statusEvents: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  // Epic: Broker onboarding - "link to the Association of which I am a
  // member". Self-declared text fields only (Section 5: no MFAA/FBAA API
  // today) - separate from the real, accept-gated BrokerRelationship to an
  // ASSOCIATION-type Organization created via addRelationship() below,
  // which is what actually unlocks the aggregator step.
  async setAssociation(brokerId: string, input: { associationName: string; associationMembershipNumber: string }) {
    return this.prisma.broker.update({ where: { id: brokerId }, data: input });
  }

  // Checklist rework - Section: Qualifications/experience and Professional
  // membership/insurance. Self-declared record-keeping fields, same
  // pattern as setAssociation - evidence itself is uploaded separately as
  // a Document.
  async setQualifications(
    brokerId: string,
    input: {
      certIvCompletedAt?: string;
      diplomaCompletedAt?: string;
      cpdHoursCurrentYear?: number;
      piInsurancePolicyNumber?: string;
      piInsuranceExpiryAt?: string;
    },
  ) {
    return this.prisma.broker.update({
      where: { id: brokerId },
      data: {
        certIvCompletedAt: input.certIvCompletedAt ? new Date(input.certIvCompletedAt) : undefined,
        diplomaCompletedAt: input.diplomaCompletedAt ? new Date(input.diplomaCompletedAt) : undefined,
        cpdHoursCurrentYear: input.cpdHoursCurrentYear,
        piInsurancePolicyNumber: input.piInsurancePolicyNumber,
        piInsuranceExpiryAt: input.piInsuranceExpiryAt ? new Date(input.piInsuranceExpiryAt) : undefined,
      },
    });
  }

  // Epic: Broker onboarding - "attest to the relevant privacy policy and
  // terms and conditions prior to onboarding".
  async attest(brokerId: string) {
    return this.prisma.broker.update({ where: { id: brokerId }, data: { attestedAt: new Date() } });
  }

  private async findActiveRelationship(brokerId: string, orgType: OrgType) {
    return this.prisma.brokerRelationship.findFirst({
      where: { brokerId, status: "ACTIVE", organization: { orgType } },
      include: { organization: true },
    });
  }

  // Section 2 (further reworked) - options available to a broker at their
  // current stage of the chain of trust. Drives the staged /broker/connect
  // UI: associations and aggregators are both offered as soon as
  // verification is ACTIVE (independent of each other, either order);
  // lenders are only the ones on the current aggregator's panel, and only
  // once an aggregator relationship is ACTIVE.
  async getConnectOptions(brokerId: string) {
    const broker = await this.prisma.broker.findUniqueOrThrow({ where: { id: brokerId } });
    if (broker.overallStatus !== "ACTIVE") {
      return {
        verificationActive: false,
        activeAssociation: null,
        activeAggregator: null,
        associations: [],
        aggregators: [],
        lenders: [],
      };
    }

    const [activeAssociation, activeAggregator] = await Promise.all([
      this.findActiveRelationship(brokerId, "ASSOCIATION"),
      this.findActiveRelationship(brokerId, "AGGREGATOR"),
    ]);

    const [associations, aggregators] = await Promise.all([
      this.prisma.organization.findMany({
        where: { orgType: "ASSOCIATION", isActive: true },
        orderBy: { legalName: "asc" },
      }),
      this.prisma.organization.findMany({
        where: { orgType: "AGGREGATOR", isActive: true },
        orderBy: { legalName: "asc" },
      }),
    ]);

    let lenders: Awaited<ReturnType<typeof this.prisma.organization.findMany>> = [];
    if (activeAggregator) {
      const panel = await this.prisma.aggregatorLenderPanel.findMany({
        where: { aggregatorOrgId: activeAggregator.organizationId, lenderOrg: { isActive: true } },
        include: { lenderOrg: true },
        orderBy: { lenderOrg: { legalName: "asc" } },
      });
      lenders = panel.map((p) => p.lenderOrg);
    }

    return {
      verificationActive: true,
      activeAssociation: activeAssociation?.organization ?? null,
      activeAggregator: activeAggregator?.organization ?? null,
      associations,
      aggregators,
      lenders,
    };
  }

  // Epic: Broker onboarding - "link to the Association of which I am a
  // member" / "link to the Aggregator or Broking firm I work through" /
  // "select the Lenders I wish to onboard with". Only reachable once the
  // broker's own verification is ACTIVE - there's nothing left for an
  // organization to due-diligence at that point, so the relationship
  // starts at PENDING_ACCEPTANCE (one lightweight accept step) rather than
  // repeating IDV/screening/doc-review.
  //
  // Chain-of-trust ordering is enforced here per target org type:
  //   ASSOCIATION - no extra gate beyond verification being ACTIVE.
  //   AGGREGATOR  - no extra gate beyond verification being ACTIVE either -
  //                 association and aggregator are independent, either can
  //                 come first. Exclusive: connecting to a different
  //                 aggregator than the broker's current one auto-revokes
  //                 the old relationship (broker- or aggregator-initiated
  //                 switch both funnel through here / ComplianceService),
  //                 which in turn cascades to revoke dependent lender
  //                 relationships (see ComplianceService.transition).
  //   LENDER      - requires an ACTIVE aggregator relationship first, AND
  //                 that aggregator must have a panel agreement with this
  //                 lender (AggregatorLenderPanel) - otherwise the lender
  //                 was never reachable through that sponsorship. An
  //                 ACTIVE association is NOT required here - most lenders
  //                 expect one in practice, but it isn't enforced.
  //
  // Selecting an organization is itself consent (Section 1.1), so it
  // auto-grants access regardless of the relationship's accept status.
  async addRelationship(brokerId: string, organizationId: string) {
    const broker = await this.prisma.broker.findUniqueOrThrow({ where: { id: brokerId } });
    if (broker.overallStatus !== "ACTIVE") {
      throw new BadRequestException(
        "You can connect with organizations once your verification is complete. Current status: " +
          broker.overallStatus,
      );
    }

    const organization = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });

    if (organization.orgType === "AGGREGATOR") {
      // Exclusivity: a broker has one current aggregator. Auto-revoke any
      // other non-terminal aggregator relationship before creating the new
      // one - ComplianceService.transition cascades this into revoking the
      // broker's lender relationships too, since those only existed
      // through the old aggregator's sponsorship.
      const otherAggregatorRelationships = await this.prisma.brokerRelationship.findMany({
        where: {
          brokerId,
          organizationId: { not: organizationId },
          status: { in: NON_TERMINAL_STATUSES },
          organization: { orgType: "AGGREGATOR" },
        },
      });
      for (const old of otherAggregatorRelationships) {
        await this.complianceService.transition(
          old.id,
          "REVOKED",
          undefined,
          "Broker switched to a new aggregator",
        );
      }
    } else if (organization.orgType === "LENDER") {
      const activeAggregator = await this.findActiveRelationship(brokerId, "AGGREGATOR");
      if (!activeAggregator) {
        throw new BadRequestException("You must be accepted by an aggregator before connecting with a lender.");
      }
      const onPanel = await this.prisma.aggregatorLenderPanel.findFirst({
        where: { aggregatorOrgId: activeAggregator.organizationId, lenderOrgId: organizationId },
      });
      if (!onPanel) {
        throw new BadRequestException("This lender isn't on your aggregator's panel.");
      }
    }

    const existing = await this.prisma.brokerRelationship.findUnique({
      where: { brokerId_organizationId: { brokerId, organizationId } },
    });

    const relationship = await this.prisma.brokerRelationship.upsert({
      where: { brokerId_organizationId: { brokerId, organizationId } },
      create: { brokerId, organizationId, status: "PENDING_ACCEPTANCE" },
      update: { status: "PENDING_ACCEPTANCE" },
    });

    // Checklist rework - Section: Aggregator and lender activation. A fresh
    // lender relationship needs the standard accreditation modules before
    // it can reach ACTIVE (see ComplianceService.transition) - seed them
    // once, on first creation only, so re-adding an existing relationship
    // doesn't reset completed training.
    if (!existing && organization.orgType === "LENDER") {
      await this.prisma.trainingRecord.createMany({
        data: STANDARD_LENDER_TRAINING.map((trainingName) => ({ relationshipId: relationship.id, trainingName })),
      });
    }

    await this.accessGrantsService.grantOnBrokerInitiated(brokerId, organizationId);
    return relationship;
  }

  async removeRelationship(relationshipId: string) {
    // Only meaningful while still PENDING_ACCEPTANCE (broker changed their
    // mind before the organization accepted) - removing an active
    // relationship is a bigger decision that belongs to Admin/the
    // organization, not this endpoint.
    const relationship = await this.prisma.brokerRelationship.findUniqueOrThrow({
      where: { id: relationshipId },
    });
    if (relationship.status !== "PENDING_ACCEPTANCE") {
      throw new BadRequestException("Only a PENDING_ACCEPTANCE relationship can be removed by the broker directly");
    }
    return this.prisma.brokerRelationship.delete({ where: { id: relationshipId } });
  }

  // Epic: Broker onboarding - final submit. Requires the attestation to be
  // recorded, then submits the broker's OWN verification pipeline
  // (Section 2, reworked) - this is what puts them in Admin's verification
  // queue (Epic: Verro 'admin' review). Organization connections happen
  // later, in a separate step, once that verification reaches ACTIVE.
  async submitOnboarding(brokerId: string) {
    const broker = await this.prisma.broker.findUniqueOrThrow({ where: { id: brokerId } });

    if (!broker.attestedAt) {
      throw new BadRequestException("Broker must attest to the privacy policy / T&Cs before submitting");
    }

    return this.brokerVerificationService.transition(brokerId, "SUBMITTED", undefined, "Broker submitted onboarding");
  }
}
