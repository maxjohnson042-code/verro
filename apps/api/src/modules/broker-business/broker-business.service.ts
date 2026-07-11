import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AclHolderType, BrokerBusinessMemberRole, BusinessEntityType } from "@verro/db";
import { VerificationService } from "../verification/verification.service";

// New epic: Broker business & structure. A broking business can be a
// sole trader (one Broker, one membership row, isPrimary=true) or a
// complex entity with many brokers working under it - see the comment
// block at the top of schema.prisma for the full reasoning.
@Injectable()
export class BrokerBusinessService {
  private readonly logger = new Logger(BrokerBusinessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: VerificationService,
  ) {}

  async createBusiness(input: {
    legalName: string;
    tradingName?: string;
    entityType: BusinessEntityType;
    abnAcn?: string;
    website?: string;
    aclHolderType: AclHolderType;
    aclNumber?: string;
    creditRepresentativeNumber?: string;
    aclHolderOrganizationId?: string;
  }) {
    const business = await this.prisma.brokerBusiness.create({ data: input });

    // Milestone 2: as soon as a broker gives us an ABN, check it against
    // the ABR - no separate "verify my ABN" step to remember. Awaited (not
    // fire-and-forget) since it's one quick HTTP call, but any failure
    // inside runAbnLookup already resolves to a stored PENDING/FAIL check
    // rather than throwing, so it can never break business creation itself.
    if (input.abnAcn?.trim()) {
      try {
        await this.verificationService.runAbnLookup({ brokerBusinessId: business.id, abn: input.abnAcn });
      } catch (err) {
        this.logger.error(`ABN lookup failed to even run for business ${business.id}: ${(err as Error).message}`);
      }
    }

    return business;
  }

  // Attaches a broker (individual) to a business. Sole traders get exactly
  // one of these rows; complex entities get one per broker working there.
  async addMember(input: {
    brokerBusinessId: string;
    brokerId: string;
    role: BrokerBusinessMemberRole;
    isPrimary?: boolean;
  }) {
    return this.prisma.brokerBusinessMembership.create({
      data: { ...input, isPrimary: input.isPrimary ?? true },
    });
  }

  // Ends a membership without deleting it, preserving history - this is
  // the digital equivalent of the manual "Transfer Requests" process in
  // the source docs (Section 1.1 / Section 6, broker portability).
  async endMembership(membershipId: string) {
    return this.prisma.brokerBusinessMembership.update({
      where: { id: membershipId },
      data: { endDate: new Date() },
    });
  }

  async getBusiness(id: string) {
    return this.prisma.brokerBusiness.findUnique({
      where: { id },
      include: {
        memberships: { include: { broker: true } },
        relationships: { include: { organization: true } },
      },
    });
  }

  async listForBroker(brokerId: string) {
    return this.prisma.brokerBusinessMembership.findMany({
      where: { brokerId },
      include: { brokerBusiness: true },
      orderBy: { startDate: "desc" },
    });
  }
}
