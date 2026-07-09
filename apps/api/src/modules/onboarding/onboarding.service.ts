import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// Epic: Broker onboarding (BRD) - Milestone 1 walking skeleton.
// Personal info only. Business/entity info now lives on BrokerBusiness
// (see the broker-business module) since a broker's business can be a
// sole trader or a complex multi-broker entity - see schema.prisma and
// Section 1 of the architecture doc for the reasoning.
@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async registerBroker(input: {
    firstName: string;
    lastName: string;
    email: string;
    dateOfBirth: Date;
  }) {
    return this.prisma.broker.create({
      data: {
        ...input,
        overallStatus: "DRAFT",
      },
    });
  }

  async getBrokerProfile(brokerId: string) {
    return this.prisma.broker.findUnique({
      where: { id: brokerId },
      include: {
        relationships: { include: { organization: true, trainingRecords: true } },
        businessMemberships: { include: { brokerBusiness: true } },
        documents: true,
      },
    });
  }
}
