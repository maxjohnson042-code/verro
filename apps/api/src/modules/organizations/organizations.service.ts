import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { OrgType } from "@verro/db";
import { ComplianceNotesService } from "../compliance/compliance-notes.service";
import { ComplianceFlagsService } from "../compliance/compliance-flags.service";

// Minimal Organizations module. There's no "Client organization
// onboarding" flow yet (deferred - Section 8, open decision #5), so this
// exists purely so the broker onboarding wizard's aggregator/lender/
// association picker, and Admin/testing, have something to list and
// create against. Not the eventual self-serve org signup.
//
// Client/FI portal (Epic: Client dashboard): everything below list/get/
// create is the org's own view of the network - always scoped by GRANTED
// AccessGrant (Section 1.1), since nothing about a broker is visible to an
// organization without one, regardless of any BrokerRelationship status.
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly complianceNotesService: ComplianceNotesService,
    private readonly complianceFlagsService: ComplianceFlagsService,
  ) {}

  async list(orgType?: OrgType) {
    return this.prisma.organization.findMany({
      where: orgType ? { orgType } : undefined,
      orderBy: { legalName: "asc" },
    });
  }

  async create(input: {
    orgType: OrgType;
    legalName: string;
    tradingName?: string;
    abnAcn?: string;
    primaryContactEmail?: string;
  }) {
    return this.prisma.organization.create({ data: input });
  }

  async get(id: string) {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  // Epic: Client dashboard - "As a Client I want to see a count of my
  // brokers by status". Scoped to GRANTED AccessGrants only - a
  // BrokerRelationship can exist without (or after losing) a grant, so
  // relationship counts are reported separately from broker visibility.
  async getDashboardSummary(organizationId: string) {
    const grants = await this.prisma.accessGrant.findMany({
      where: { organizationId, status: "GRANTED" },
      include: { broker: { select: { overallStatus: true } } },
    });

    const byVerificationStatus: Record<string, number> = {};
    for (const g of grants) {
      byVerificationStatus[g.broker.overallStatus] = (byVerificationStatus[g.broker.overallStatus] ?? 0) + 1;
    }

    const relationships = await this.prisma.brokerRelationship.findMany({
      where: { organizationId },
      select: { status: true },
    });
    const byRelationshipStatus: Record<string, number> = {};
    for (const r of relationships) {
      byRelationshipStatus[r.status] = (byRelationshipStatus[r.status] ?? 0) + 1;
    }

    const openFlagCount = await this.prisma.complianceFlag.count({
      where: {
        status: { in: ["OPEN", "UNDER_REVIEW"] },
        broker: { accessGrants: { some: { organizationId, status: "GRANTED" } } },
      },
    });

    return {
      totalVisibleBrokers: grants.length,
      byVerificationStatus,
      byRelationshipStatus,
      openFlagCount,
    };
  }

  // Epic: Client dashboard - "As a Client I want to see a list of my
  // brokers". One row per broker holding a GRANTED AccessGrant for this
  // org, with this org's own relationship (if any - a lender/aggregator/
  // association may have a grant without ever forming a relationship, e.g.
  // an org-requested grant that's still pending elsewhere) and open flag
  // count surfaced inline.
  async getVisibleBrokers(organizationId: string) {
    const grants = await this.prisma.accessGrant.findMany({
      where: { organizationId, status: "GRANTED" },
      include: {
        broker: {
          include: {
            relationships: { where: { organizationId } },
            complianceFlags: { where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } },
          },
        },
      },
      orderBy: { decidedAt: "desc" },
    });

    return grants.map((g) => ({
      brokerId: g.brokerId,
      firstName: g.broker.firstName,
      lastName: g.broker.lastName,
      email: g.broker.email,
      overallStatus: g.broker.overallStatus,
      relationship: g.broker.relationships[0] ?? null,
      openFlagCount: g.broker.complianceFlags.length,
      accessGrantedAt: g.decidedAt,
    }));
  }

  // Epic: Client dashboard - broker detail view. Re-checks the GRANTED
  // AccessGrant itself (not just relationship status) before returning
  // anything - a broker can revoke access at any time even with an ACTIVE
  // relationship (Section 1.1, AccessGrantsService.revoke), and that
  // revocation must take effect here immediately.
  async getBrokerDetail(organizationId: string, brokerId: string) {
    const grant = await this.prisma.accessGrant.findUnique({
      where: { brokerId_organizationId: { brokerId, organizationId } },
    });
    if (grant?.status !== "GRANTED") {
      throw new ForbiddenException("You don't have access to this broker's information");
    }

    const broker = await this.prisma.broker.findUniqueOrThrow({
      where: { id: brokerId },
      include: {
        relationships: {
          where: { organizationId },
          include: { statusEvents: { orderBy: { createdAt: "asc" } }, trainingRecords: true },
        },
        statusEvents: { orderBy: { createdAt: "asc" } },
        businessMemberships: { include: { brokerBusiness: true } },
      },
    });

    const [notes, flags] = await Promise.all([
      this.complianceNotesService.listForBroker(brokerId, organizationId),
      this.complianceFlagsService.listForBroker(brokerId),
    ]);

    return { broker, notes, flags };
  }
}
