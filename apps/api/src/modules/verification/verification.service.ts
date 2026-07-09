import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// Verification orchestration (Section 4 / Milestones 2-3 of the arch doc).
// Milestone 2: ABN Lookup API (free, no vendor negotiation) - build this
// integration first to prove the pattern: job -> VerificationCheck row ->
// relationship status transition.
// Milestone 3: FrankieOne ID&V.
//
// Resolved decision (Open decision #4): check currency is a single global
// policy, not configurable per organization - every check expires 12
// months after it runs. See oneYearFromNow() below.
//
// ABN/company-level checks can be about a broker (sole trader) or a
// BrokerBusiness; ID&V is always about the individual.
@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  private oneYearFromNow(): Date {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }

  async runAbnLookup(input: { brokerId?: string; brokerBusinessId?: string; abn: string }) {
    // TODO(Milestone 2): call the ABR ABN Lookup API using
    // ABR_ABN_LOOKUP_GUID (free, register at
    // https://abr.business.gov.au/Tools/WebServices) and store the real
    // result instead of leaving this PENDING.
    this.logger.warn(
      `runAbnLookup stub for broker=${input.brokerId ?? "-"} business=${input.brokerBusinessId ?? "-"} abn=${input.abn} - ABR API not wired up yet`,
    );
    return this.prisma.verificationCheck.create({
      data: {
        brokerId: input.brokerId,
        brokerBusinessId: input.brokerBusinessId,
        checkType: "ABN",
        vendor: "ABR",
        result: "PENDING",
        expiresAt: this.oneYearFromNow(),
      },
    });
  }

  async runIdv(brokerId: string) {
    // TODO(Milestone 3): call FrankieOne, store rawResponse, and compare
    // extracted ID&V data against broker-entered data to flag disparities
    // (BRD Epic: Identity verification).
    this.logger.warn(`runIdv stub for broker=${brokerId} - FrankieOne not wired up yet`);
    return this.prisma.verificationCheck.create({
      data: {
        brokerId,
        checkType: "IDV",
        vendor: "FrankieOne",
        result: "PENDING",
        expiresAt: this.oneYearFromNow(),
      },
    });
  }

  async listForBroker(brokerId: string) {
    return this.prisma.verificationCheck.findMany({
      where: { brokerId },
      orderBy: { runAt: "desc" },
    });
  }

  async listStale() {
    // Checks past their global 12-month expiry - candidates for the
    // Milestone 5 ongoing-monitoring scheduler to re-run.
    return this.prisma.verificationCheck.findMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  async broadcastAdverseFinding(brokerId: string, checkId: string) {
    // TODO: on an adverse result, notify every organization holding a
    // GRANTED AccessGrant for this broker (Section 1.1) via
    // NotificationsService, not just log it.
    this.logger.warn(`broadcastAdverseFinding stub: broker=${brokerId} check=${checkId}`);
  }
}
