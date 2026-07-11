import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

// Epic: Data sharing & consent (Section 3 of the architecture doc).
// Two paths create an AccessGrant:
//  - broker-initiated: broker selects an org during onboarding -> auto GRANTED
//  - org-requested: an org requests access to a broker it doesn't yet have
//    a relationship with -> PENDING until the broker decides
// Nothing about a broker is visible to an organization without a GRANTED row.
@Injectable()
export class AccessGrantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async grantOnBrokerInitiated(brokerId: string, organizationId: string) {
    return this.prisma.accessGrant.upsert({
      where: { brokerId_organizationId: { brokerId, organizationId } },
      create: {
        brokerId,
        organizationId,
        origin: "BROKER_INITIATED",
        status: "GRANTED",
        decidedAt: new Date(),
        decidedByBrokerId: brokerId,
      },
      update: { status: "GRANTED", decidedAt: new Date() },
    });
  }

  async requestAccess(brokerId: string, organizationId: string, requestedByUserId: string) {
    const grant = await this.prisma.accessGrant.upsert({
      where: { brokerId_organizationId: { brokerId, organizationId } },
      create: {
        brokerId,
        organizationId,
        origin: "ORG_REQUESTED",
        status: "PENDING",
        requestedByUserId,
      },
      update: {},
      include: { broker: true, organization: true },
    });

    // Only notify on a genuinely new pending request - re-requesting an
    // already-decided grant (upsert's update: {} branch) shouldn't spam the
    // broker with duplicate emails.
    if (grant.status === "PENDING") {
      await this.notificationsService.sendAccessGrantNotification(
        grant.broker.email,
        grant.broker.firstName,
        grant.organization.legalName,
        grant.status,
      );
    }

    return grant;
  }

  async decide(grantId: string, decision: "GRANTED" | "DENIED", decidedByBrokerId: string) {
    const grant = await this.prisma.accessGrant.findUniqueOrThrow({ where: { id: grantId } });
    if (grant.brokerId !== decidedByBrokerId) {
      throw new BadRequestException("Only the broker who owns this grant can decide it");
    }
    return this.prisma.accessGrant.update({
      where: { id: grantId },
      data: { status: decision, decidedAt: new Date(), decidedByBrokerId },
    });
  }

  // Resolved decision: revocation is NEVER blocked, even while the
  // organization holds a currently ACTIVE BrokerRelationship or
  // BrokerBusinessRelationship with this broker. The broker retains full
  // control of their data at all times - that's the point of the consent
  // model (Section 1.1). This can leave an org with an active
  // accreditation but no visibility into current compliance status; that
  // is an accepted, intentional consequence, not a bug to fix later.
  async revoke(grantId: string, brokerId: string) {
    const grant = await this.prisma.accessGrant.findUniqueOrThrow({ where: { id: grantId } });
    if (grant.brokerId !== brokerId) {
      throw new BadRequestException("Only the broker who owns this grant can revoke it");
    }
    return this.prisma.accessGrant.update({
      where: { id: grantId },
      data: { status: "REVOKED", decidedAt: new Date() },
    });
  }

  async listForBroker(brokerId: string) {
    return this.prisma.accessGrant.findMany({
      where: { brokerId },
      include: { organization: true },
      orderBy: { requestedAt: "desc" },
    });
  }

  async hasGrantedAccess(brokerId: string, organizationId: string) {
    const grant = await this.prisma.accessGrant.findUnique({
      where: { brokerId_organizationId: { brokerId, organizationId } },
    });
    return grant?.status === "GRANTED";
  }
}
