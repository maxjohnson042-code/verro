import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { OnboardingService } from "../onboarding/onboarding.service";
import { ComplianceNotesService } from "../compliance/compliance-notes.service";
import { ComplianceFlagsService } from "../compliance/compliance-flags.service";

// Epic: Verro 'admin' review (Section 3) - internal ops/compliance
// team's review queues, distinct from the Client portal.
//
// Section 2 (reworked): verification is a broker-level pipeline, so the
// main review queue is now one row per BROKER, not per broker-org
// relationship - admin verifies the person once. Once a broker reaches
// ACTIVE, any relationship they create still needs one lightweight accept
// from the organization side, which is a separate, much smaller queue.
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboardingService: OnboardingService,
    private readonly complianceNotesService: ComplianceNotesService,
    private readonly complianceFlagsService: ComplianceFlagsService,
  ) {}

  // Unified broker profile view (unlike the Client portal's org-scoped
  // getBrokerDetail, which deliberately hides other orgs' relationships
  // to preserve broker-controlled consent - Section 1.1) - Admin sees
  // everything: every organization relationship, all documents, notes
  // from every organization, and every flag raised against the broker.
  async getBrokerFullProfile(brokerId: string) {
    const broker = await this.onboardingService.getBrokerProfile(brokerId);
    if (!broker) throw new NotFoundException("Broker not found");
    const [notes, flags] = await Promise.all([
      this.complianceNotesService.listForBroker(brokerId, "internal-admin"),
      this.complianceFlagsService.listForBroker(brokerId),
    ]);
    return { broker, notes, flags };
  }

  async getVerificationQueue() {
    return this.prisma.broker.findMany({
      where: {
        overallStatus: {
          in: ["SUBMITTED", "IDV_PENDING", "SCREENING_PENDING", "DOC_REVIEW_PENDING", "PENDING_ADMIN_APPROVAL"],
        },
      },
      orderBy: { updatedAt: "asc" },
    });
  }

  // Includes CREDIT_REP_PENDING/ACCREDITATION_PENDING (checklist rework) -
  // both still need an org-side action (recording the CR appointment, or
  // ticking off training) before the relationship is really "accepted",
  // same as a plain PENDING_ACCEPTANCE row. Also pulls the broker's
  // association/aggregator relationships as context, since the whole point
  // of the chain of trust is that a lender or aggregator reviewing this row
  // can see "association and aggregator are both happy" (and, once an
  // aggregator switch has happened, the broker's history) without having to
  // look the broker up separately.
  async getPendingAcceptances() {
    return this.prisma.brokerRelationship.findMany({
      where: { status: { in: ["PENDING_ACCEPTANCE", "CREDIT_REP_PENDING", "ACCREDITATION_PENDING"] } },
      include: {
        broker: {
          include: {
            relationships: {
              where: { organization: { orgType: { in: ["ASSOCIATION", "AGGREGATOR"] } } },
              include: { organization: true },
              orderBy: { updatedAt: "desc" },
            },
          },
        },
        organization: true,
        trainingRecords: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async getFlaggedAndSuspended() {
    const [brokers, relationships] = await Promise.all([
      this.prisma.broker.findMany({
        where: { overallStatus: { in: ["SUSPENDED"] } },
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.brokerRelationship.findMany({
        where: { status: { in: ["FLAGGED", "SUSPENDED"] } },
        include: { broker: true, organization: true, trainingRecords: { orderBy: { createdAt: "asc" } } },
        orderBy: { updatedAt: "desc" },
      }),
    ]);
    return { brokers, relationships };
  }
}
