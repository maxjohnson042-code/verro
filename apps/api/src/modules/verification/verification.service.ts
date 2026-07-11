import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { isValidAbnChecksum, lookupAbn } from "./abr-client";

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private oneYearFromNow(): Date {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }

  // Milestone 2: real ABR ABN Lookup integration (free web service, GUID
  // registration at https://abr.business.gov.au/Tools/WebServices). Three
  // tiers of outcome, matching CheckResult:
  //  - FAIL: the ABN fails the checksum, or the ABR says it isn't a valid
  //    ABN/ACN, or it's genuinely not on the register
  //  - REVIEW_REQUIRED: it's a real, registered ABN, but its status isn't
  //    "Active" (e.g. cancelled) - a human should look at it
  //  - PASS: a real, currently active ABN
  // A misconfigured GUID or a network/ABR outage falls back to PENDING
  // (never FAIL) so a transient problem on the ABR's side doesn't wrongly
  // block a broker - same fail-safe philosophy as NotificationsService.
  async runAbnLookup(input: { brokerId?: string; brokerBusinessId?: string; abn: string }) {
    const guid = this.config.get<string>("ABR_ABN_LOOKUP_GUID");

    if (!isValidAbnChecksum(input.abn)) {
      this.logger.warn(`runAbnLookup: "${input.abn}" fails the ABN checksum`);
      return this.prisma.verificationCheck.create({
        data: {
          brokerId: input.brokerId,
          brokerBusinessId: input.brokerBusinessId,
          checkType: "ABN",
          vendor: "ABR",
          result: "FAIL",
          rawResponse: { error: "Fails ABN checksum validation", abn: input.abn },
          expiresAt: this.oneYearFromNow(),
        },
      });
    }

    if (!guid) {
      this.logger.warn(
        `runAbnLookup: ABR_ABN_LOOKUP_GUID not set - leaving check PENDING for broker=${input.brokerId ?? "-"} business=${input.brokerBusinessId ?? "-"} abn=${input.abn}. See .env.example.`,
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

    let outcome: Awaited<ReturnType<typeof lookupAbn>>;
    try {
      outcome = await lookupAbn(input.abn, guid);
    } catch (err) {
      this.logger.error(`runAbnLookup: ABR request threw: ${(err as Error).message}`);
      return this.prisma.verificationCheck.create({
        data: {
          brokerId: input.brokerId,
          brokerBusinessId: input.brokerBusinessId,
          checkType: "ABN",
          vendor: "ABR",
          result: "PENDING",
          rawResponse: { error: (err as Error).message },
          expiresAt: this.oneYearFromNow(),
        },
      });
    }

    if (outcome.outcome === "FOUND") {
      const isActive = outcome.details.abnStatus.toLowerCase() === "active";
      this.logger.log(`runAbnLookup: ${input.abn} -> ${outcome.details.entityName} (${outcome.details.abnStatus})`);
      return this.prisma.verificationCheck.create({
        data: {
          brokerId: input.brokerId,
          brokerBusinessId: input.brokerBusinessId,
          checkType: "ABN",
          vendor: "ABR",
          result: isActive ? "PASS" : "REVIEW_REQUIRED",
          rawResponse: outcome.raw as object,
          expiresAt: this.oneYearFromNow(),
        },
      });
    }

    if (outcome.outcome === "INVALID_GUID") {
      this.logger.error(`runAbnLookup: ${outcome.message} - check ABR_ABN_LOOKUP_GUID`);
      return this.prisma.verificationCheck.create({
        data: {
          brokerId: input.brokerId,
          brokerBusinessId: input.brokerBusinessId,
          checkType: "ABN",
          vendor: "ABR",
          result: "PENDING",
          rawResponse: { error: outcome.message },
          expiresAt: this.oneYearFromNow(),
        },
      });
    }

    // NOT_FOUND or ERROR (e.g. ABR rejected the search string) - the ABN
    // itself is the problem, so this is a genuine FAIL.
    this.logger.warn(`runAbnLookup: ${input.abn} -> ${outcome.message}`);
    return this.prisma.verificationCheck.create({
      data: {
        brokerId: input.brokerId,
        brokerBusinessId: input.brokerBusinessId,
        checkType: "ABN",
        vendor: "ABR",
        result: "FAIL",
        rawResponse: { error: outcome.message },
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

  // ABN checks are recorded against the BrokerBusiness (a business can
  // outlive any one broker's membership in it), not the Broker - see
  // runAbnLookup. Used by AdminService to show a broker's full check
  // history including checks run for businesses they're a member of.
  async listForBrokerBusinesses(brokerBusinessIds: string[]) {
    if (brokerBusinessIds.length === 0) return [];
    return this.prisma.verificationCheck.findMany({
      where: { brokerBusinessId: { in: brokerBusinessIds } },
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
