import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RelationshipStatus } from "@verro/db";
import { NotificationsService } from "../notifications/notifications.service";

// Standard lender accreditation modules (checklist rework) - auto-seeded as
// TrainingRecord rows whenever a LENDER BrokerRelationship is created (see
// OnboardingService.addRelationship). Every row must be completed before
// the relationship can reach ACTIVE (enforced in transition() below).
export const STANDARD_LENDER_TRAINING = [
  "Responsible lending training",
  "Best interests duty training",
  "Privacy, AML/CTF & fraud training",
  "CRM & loan submission platform training",
  "Lender product & policy training",
];

// Per-organization relationship status state machine - Section 2
// (reworked). Deliberately thin: a relationship only exists once the
// broker's own verification (BrokerVerificationService) is already
// ACTIVE, so there's no IDV/screening/doc-review to repeat here - the
// organization just does one lightweight accept. FLAGGED/SUSPENDED/
// REVOKED remain per-relationship, since one org can cut a broker off
// from just their organization without affecting the broker anywhere
// else. PENDING_ACCEPTANCE/FLAGGED can also go straight to REVOKED now,
// which the aggregator-loss cascade below relies on.
//
// CREDIT_REP_PENDING/ACCREDITATION_PENDING (checklist rework) are optional
// intermediate stages an org can move a relationship through before
// ACTIVE - AGGREGATOR only / LENDER only respectively (see schema.prisma).
// They're optional because the ACTIVE gate itself (further down in
// transition()) is what actually enforces the requirement; a caller can
// also go straight PENDING_ACCEPTANCE -> ACTIVE and the gate will simply
// reject it until the credit-rep/training requirement is met.
const ALLOWED_TRANSITIONS: Record<RelationshipStatus, RelationshipStatus[]> = {
  INVITED: ["PENDING_ACCEPTANCE"],
  PENDING_ACCEPTANCE: ["ACTIVE", "DECLINED", "REVOKED", "CREDIT_REP_PENDING", "ACCREDITATION_PENDING"],
  CREDIT_REP_PENDING: ["ACTIVE", "DECLINED", "REVOKED"],
  ACCREDITATION_PENDING: ["ACTIVE", "DECLINED", "REVOKED"],
  ACTIVE: ["FLAGGED", "SUSPENDED", "REVOKED"],
  FLAGGED: ["ACTIVE", "SUSPENDED", "REVOKED"],
  SUSPENDED: ["ACTIVE", "REVOKED"],
  DECLINED: [],
  REVOKED: [],
};

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async transition(relationshipId: string, toStatus: RelationshipStatus, actionedBy?: string, reason?: string) {
    const relationship = await this.prisma.brokerRelationship.findUniqueOrThrow({
      where: { id: relationshipId },
      include: { broker: true, organization: true },
    });

    const allowed = ALLOWED_TRANSITIONS[relationship.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(`Cannot transition relationship from ${relationship.status} to ${toStatus}`);
    }

    // Checklist rework: ACTIVE means something type-specific now, not just
    // "the org accepted". An aggregator relationship additionally needs the
    // credit representative appointment recorded; a lender relationship
    // additionally needs every required training/accreditation item
    // completed. See BrokerRelationship's doc comment in schema.prisma.
    if (toStatus === "ACTIVE") {
      if (relationship.organization.orgType === "AGGREGATOR" && !relationship.creditRepNumber) {
        throw new BadRequestException(
          "Record the broker's credit representative number before activating this relationship.",
        );
      }
      if (relationship.organization.orgType === "LENDER") {
        const trainingRecords = await this.prisma.trainingRecord.findMany({ where: { relationshipId } });
        const outstanding = trainingRecords.filter((t) => !t.completed);
        if (trainingRecords.length === 0 || outstanding.length > 0) {
          throw new BadRequestException(
            "All required training/accreditation items must be completed before activating this relationship.",
          );
        }
      }
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.brokerRelationship.update({
        where: { id: relationshipId },
        data: { status: toStatus },
      }),
      this.prisma.statusEvent.create({
        data: {
          relationshipId,
          fromStatus: relationship.status,
          toStatus,
          actionedBy,
          reason,
        },
      }),
    ]);

    // Epic: Notifications - "As a broker I want an email when my status
    // changes". Fire-and-forget from the caller's perspective; the
    // service itself just logs today (see NotificationsService), but the
    // wiring point is real so swapping in SES later is a one-file change.
    await this.notificationsService.sendStatusChangeEmail(relationship.broker.email, relationship.status, toStatus);

    // Chain-of-trust cascade (Section 2, further reworked): a lender only
    // ever saw this broker through their aggregator's sponsorship, so
    // losing the aggregator relationship means every dependent lender
    // relationship is offboarded too - whether the aggregator revoked the
    // broker directly (this path) or the broker switched aggregators
    // (OnboardingService.addRelationship, which calls transition() the
    // same way).
    if (relationship.organization.orgType === "AGGREGATOR" && toStatus === "REVOKED") {
      await this.revokeLenderRelationshipsForBroker(
        relationship.brokerId,
        actionedBy,
        reason ?? "Aggregator relationship ended",
      );
    }

    return updated;
  }

  async revokeLenderRelationshipsForBroker(brokerId: string, actionedBy: string | undefined, reason: string) {
    const lenderRelationships = await this.prisma.brokerRelationship.findMany({
      where: {
        brokerId,
        organization: { orgType: "LENDER" },
        status: {
          in: ["INVITED", "PENDING_ACCEPTANCE", "CREDIT_REP_PENDING", "ACCREDITATION_PENDING", "ACTIVE", "FLAGGED", "SUSPENDED"],
        },
      },
    });
    for (const rel of lenderRelationships) {
      await this.transition(rel.id, "REVOKED", actionedBy, reason);
    }
  }

  // Checklist rework - Section: Licensing structure. Records the
  // aggregator's appointment of the broker as a credit representative
  // (ASIC registration number), which unblocks the ACTIVE gate above.
  // Convenience: also attempts the ACTIVE transition immediately, since
  // recording the number is usually the last step before activating -
  // callers that want to stage it via CREDIT_REP_PENDING first can just
  // not rely on the auto-activate and transition manually instead.
  async recordCreditRep(relationshipId: string, creditRepNumber: string, actionedBy?: string) {
    const relationship = await this.prisma.brokerRelationship.findUniqueOrThrow({
      where: { id: relationshipId },
      include: { organization: true },
    });
    if (relationship.organization.orgType !== "AGGREGATOR") {
      throw new BadRequestException("Credit representative appointment only applies to aggregator relationships");
    }
    await this.prisma.brokerRelationship.update({
      where: { id: relationshipId },
      data: { creditRepNumber, creditRepAuthorisedAt: new Date() },
    });
    if (["PENDING_ACCEPTANCE", "CREDIT_REP_PENDING"].includes(relationship.status)) {
      return this.transition(relationshipId, "ACTIVE", actionedBy, "Credit representative appointment recorded");
    }
    return this.prisma.brokerRelationship.findUniqueOrThrow({ where: { id: relationshipId } });
  }

  // Checklist rework - Section: Aggregator and lender activation. Lists
  // the required training/accreditation items for a lender relationship
  // (auto-seeded on creation, see OnboardingService.addRelationship).
  async listTrainingRecords(relationshipId: string) {
    return this.prisma.trainingRecord.findMany({ where: { relationshipId }, orderBy: { createdAt: "asc" } });
  }

  async setTrainingRecordCompleted(trainingRecordId: string, completed: boolean, markedByUserId?: string) {
    return this.prisma.trainingRecord.update({
      where: { id: trainingRecordId },
      data: { completed, completedDate: completed ? new Date() : null, markedByUserId: markedByUserId ?? null },
    });
  }

  async history(relationshipId: string) {
    return this.prisma.statusEvent.findMany({
      where: { relationshipId },
      orderBy: { createdAt: "asc" },
    });
  }
}
