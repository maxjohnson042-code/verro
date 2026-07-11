import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { FlagCategory, FlagSeverity } from "@verro/db";

// New requirement: FBAA, MFAA, lenders and aggregators can flag compliance
// issues against a broker or broker business. Unlike ComplianceNote, a
// flag is always visible to every organization holding a GRANTED
// AccessGrant for the subject (Section 1.1) - that's the entire point of
// raising one, so there's no visibility field to set.
@Injectable()
export class ComplianceFlagsService {
  private readonly logger = new Logger(ComplianceFlagsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async raiseFlag(input: {
    brokerId?: string;
    brokerBusinessId?: string;
    raisedByOrganizationId: string;
    raisedByUserId: string;
    category: FlagCategory;
    severity: FlagSeverity;
    description: string;
  }) {
    if (!input.brokerId && !input.brokerBusinessId) {
      throw new BadRequestException("A flag must be about a broker or a broker business");
    }

    const flag = await this.prisma.complianceFlag.create({ data: input });

    // TODO: broadcast to every organization holding a GRANTED AccessGrant
    // for this broker/business, same mechanism as
    // VerificationService.broadcastAdverseFinding.
    this.logger.warn(
      `broadcastComplianceFlag stub: flag=${flag.id} broker=${input.brokerId ?? "-"} business=${input.brokerBusinessId ?? "-"}`,
    );

    return flag;
  }

  async resolve(flagId: string, resolvedByUserId: string, resolutionNotes?: string) {
    return this.prisma.complianceFlag.update({
      where: { id: flagId },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedByUserId, resolutionNotes },
    });
  }

  async listForBroker(brokerId: string) {
    // Always network-visible to any org with a GRANTED AccessGrant - no
    // org-scoping filter needed here, unlike ComplianceNotesService.
    return this.prisma.complianceFlag.findMany({
      where: { brokerId },
      include: { raisedByOrganization: true },
      orderBy: { createdAt: "desc" },
    });
  }
}
