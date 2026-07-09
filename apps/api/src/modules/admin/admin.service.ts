import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// Epic: Verro 'admin' review (Section 3) - internal ops/compliance
// team's review queue, distinct from the Client portal.
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getReviewQueue() {
    return this.prisma.brokerRelationship.findMany({
      where: {
        status: {
          in: [
            "SUBMITTED",
            "IDV_PENDING",
            "SCREENING_PENDING",
            "DOC_REVIEW_PENDING",
            "PENDING_ADMIN_APPROVAL",
          ],
        },
      },
      include: { broker: true, organization: true },
      orderBy: { updatedAt: "asc" },
    });
  }

  async getFlaggedAndSuspended() {
    return this.prisma.brokerRelationship.findMany({
      where: { status: { in: ["FLAGGED", "SUSPENDED"] } },
      include: { broker: true, organization: true },
      orderBy: { updatedAt: "desc" },
    });
  }
}
