import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { BrokerVerificationStatus } from "@verro/db";
import { NotificationsService } from "../notifications/notifications.service";

// The broker's ONE global verification pipeline (Section 2, reworked) -
// IDV, screening, doc review, and admin approval happen once per broker,
// driven off Broker.overallStatus, not repeated per organization
// relationship. This is the actual enforcement of the "verify once,
// trusted by the network" thesis. Compare RelationshipStatus's much
// thinner per-org state machine in compliance.service.ts.
const ALLOWED_TRANSITIONS: Record<BrokerVerificationStatus, BrokerVerificationStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["IDV_PENDING"],
  IDV_PENDING: ["SCREENING_PENDING", "SUSPENDED"],
  SCREENING_PENDING: ["DOC_REVIEW_PENDING", "SUSPENDED"],
  DOC_REVIEW_PENDING: ["PENDING_ADMIN_APPROVAL", "SUSPENDED"],
  PENDING_ADMIN_APPROVAL: ["ACTIVE", "DECLINED"],
  ACTIVE: ["SUSPENDED", "REVOKED"],
  SUSPENDED: ["ACTIVE", "REVOKED"],
  DECLINED: [],
  REVOKED: [],
};

@Injectable()
export class BrokerVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async transition(brokerId: string, toStatus: BrokerVerificationStatus, actionedBy?: string, reason?: string) {
    const broker = await this.prisma.broker.findUniqueOrThrow({ where: { id: brokerId } });

    const allowed = ALLOWED_TRANSITIONS[broker.overallStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Cannot transition broker verification from ${broker.overallStatus} to ${toStatus}`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.broker.update({ where: { id: brokerId }, data: { overallStatus: toStatus } }),
      this.prisma.brokerStatusEvent.create({
        data: { brokerId, fromStatus: broker.overallStatus, toStatus, actionedBy, reason },
      }),
    ]);

    await this.notificationsService.sendStatusChangeEmail(broker.email, broker.overallStatus, toStatus);

    return updated;
  }

  async history(brokerId: string) {
    return this.prisma.brokerStatusEvent.findMany({ where: { brokerId }, orderBy: { createdAt: "asc" } });
  }
}
