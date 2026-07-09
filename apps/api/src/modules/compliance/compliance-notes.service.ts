import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NoteVisibility } from "@verro/db";

// Epic: Data sharing & consent / new requirement: FBAA, MFAA, lenders and
// aggregators can keep notes against a broker or broker business. Defaults
// private to the authoring organization; must be explicitly marked
// NETWORK_VISIBLE to be shared with other organizations. Contrast with
// ComplianceFlag, which is always network-visible - see that file.
@Injectable()
export class ComplianceNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async addNote(input: {
    brokerId?: string;
    brokerBusinessId?: string;
    organizationId: string;
    authorUserId: string;
    body: string;
    visibility?: NoteVisibility;
  }) {
    if (!input.brokerId && !input.brokerBusinessId) {
      throw new BadRequestException("A note must be about a broker or a broker business");
    }
    return this.prisma.complianceNote.create({
      data: { ...input, visibility: input.visibility ?? "PRIVATE_TO_ORG" },
    });
  }

  // Returns notes visible to the requesting organization: its own notes
  // (private or not) plus any other org's NETWORK_VISIBLE notes. Does NOT
  // itself check that requestingOrganizationId holds a GRANTED
  // AccessGrant for this broker - callers should check that first via
  // AccessGrantsService (Section 1.1).
  async listForBroker(brokerId: string, requestingOrganizationId: string) {
    return this.prisma.complianceNote.findMany({
      where: {
        brokerId,
        OR: [{ organizationId: requestingOrganizationId }, { visibility: "NETWORK_VISIBLE" }],
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
