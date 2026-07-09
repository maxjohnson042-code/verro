import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RelationshipStatus } from "@verro/db";

// Broker relationship status state machine - Section 2 of the architecture
// doc. Runs per BROKER_RELATIONSHIP (per organization), independently of
// any other relationship the same broker holds.
const ALLOWED_TRANSITIONS: Record<RelationshipStatus, RelationshipStatus[]> = {
  INVITED: ["DRAFT"],
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["IDV_PENDING"],
  IDV_PENDING: ["SCREENING_PENDING", "FLAGGED"],
  SCREENING_PENDING: ["DOC_REVIEW_PENDING", "FLAGGED"],
  DOC_REVIEW_PENDING: ["PENDING_ADMIN_APPROVAL", "FLAGGED"],
  PENDING_ADMIN_APPROVAL: ["ACTIVE", "DECLINED"],
  ACTIVE: ["FLAGGED", "REVOKED"],
  FLAGGED: ["ACTIVE", "SUSPENDED"],
  SUSPENDED: ["ACTIVE", "REVOKED"],
  DECLINED: [],
  REVOKED: [],
};

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async transition(
    relationshipId: string,
    toStatus: RelationshipStatus,
    actionedBy?: string,
    reason?: string,
  ) {
    const relationship = await this.prisma.brokerRelationship.findUniqueOrThrow({
      where: { id: relationshipId },
    });

    const allowed = ALLOWED_TRANSITIONS[relationship.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Cannot transition relationship from ${relationship.status} to ${toStatus}`,
      );
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

    return updated;
  }

  async history(relationshipId: string) {
    return this.prisma.statusEvent.findMany({
      where: { relationshipId },
      orderBy: { createdAt: "asc" },
    });
  }
}
