import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { isValidAbnChecksum, lookupAbn } from "./abr-client";
import { createAccessToken, verifyWebhookSignature, type SumsubWebhookPayload } from "./sumsub-client";
import { BrokerVerificationService } from "../compliance/broker-verification.service";

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
    private readonly brokerVerificationService: BrokerVerificationService,
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

  // Milestone 3: real ID&V via Sumsub. Two halves, split because the
  // actual verification (document capture + biometric liveness check)
  // happens inside Sumsub's own WebSDK widget in the browser, not
  // synchronously in this API call - all this does is mint the WebSDK its
  // access token, and mark that verification has genuinely started.
  //
  // "genuinely started" is the point: unlike every other check in this
  // service, IDV_PENDING is no longer a status an admin clicks into by
  // hand (see admin/review/page.tsx's old VERIFICATION_NEXT map) - it now
  // means "the broker has an active Sumsub session," and SCREENING_PENDING
  // (below, in handleIdvWebhook) means "Sumsub returned a real answer."
  // That directly addresses the gap flagged in the onboarding audit: the
  // pipeline's status names now correspond to something actually happening,
  // for this one check at least.
  async createIdvSession(brokerId: string) {
    const appToken = this.config.get<string>("SUMSUB_APP_TOKEN");
    const secretKey = this.config.get<string>("SUMSUB_SECRET_KEY");
    const levelName = this.config.get<string>("SUMSUB_LEVEL_NAME") ?? "basic-kyc-level";
    const baseUrl = this.config.get<string>("SUMSUB_BASE_URL");

    if (!appToken || !secretKey) {
      // Unlike ABN/email, there's no sensible "fall back to PENDING and
      // carry on" here - identity verification simply cannot happen
      // without Sumsub configured. Fail loudly and immediately rather than
      // let a broker sit in front of a broken widget.
      this.logger.error("createIdvSession: SUMSUB_APP_TOKEN/SUMSUB_SECRET_KEY not configured. See .env.example.");
      throw new BadRequestException("Identity verification isn't configured yet - contact support.");
    }

    const broker = await this.prisma.broker.findUniqueOrThrow({ where: { id: brokerId } });

    const { token } = await createAccessToken({
      appToken,
      secretKey,
      baseUrl,
      userId: brokerId,
      levelName,
      email: broker.email,
      phone: broker.phone ?? undefined,
    });

    // Broker has an in-flight Sumsub session now - reflect that in the
    // pipeline. Only fires from SUBMITTED (the one allowed transition into
    // IDV_PENDING); re-opening the WebSDK after that point (e.g. a broker
    // re-launching mid-flow) just re-mints a token without re-transitioning.
    if (broker.overallStatus === "SUBMITTED") {
      await this.brokerVerificationService.transition(
        brokerId,
        "IDV_PENDING",
        undefined,
        "Broker started identity verification via Sumsub",
      );
    }

    return { token, applicantId: brokerId };
  }

  // Sumsub calls this once a review completes (the applicantReviewed
  // webhook - see sumsub-client.ts). Signature MUST be verified against the
  // raw request bytes (see main.ts's rawBody option) before trusting
  // anything in the payload - this endpoint has no other auth, since
  // Sumsub itself is the caller, not a logged-in user.
  async handleIdvWebhook(rawBody: Buffer, digestHeader: string | undefined, algHeader: string | undefined) {
    const webhookSecret = this.config.get<string>("SUMSUB_WEBHOOK_SECRET");
    if (!webhookSecret || !verifyWebhookSignature(rawBody, digestHeader, algHeader, webhookSecret)) {
      throw new UnauthorizedException("Invalid webhook signature");
    }

    const payload = JSON.parse(rawBody.toString("utf-8")) as SumsubWebhookPayload;

    if (payload.type !== "applicantReviewed") {
      // We only asked Sumsub to send us applicantReviewed events, but
      // acknowledge anything else harmlessly rather than erroring - a
      // dashboard-side webhook type change shouldn't start failing deliveries.
      this.logger.log(`handleIdvWebhook: ignoring event type "${payload.type}"`);
      return { ignored: true };
    }

    const brokerId = payload.externalUserId;
    if (!brokerId) {
      this.logger.error("handleIdvWebhook: applicantReviewed event missing externalUserId");
      return { ignored: true };
    }

    const reviewAnswer = payload.reviewResult?.reviewAnswer;
    const result = reviewAnswer === "GREEN" ? "PASS" : reviewAnswer === "RED" ? "FAIL" : "REVIEW_REQUIRED";

    await this.prisma.verificationCheck.create({
      data: {
        brokerId,
        checkType: "IDV",
        vendor: "Sumsub",
        result,
        rawResponse: payload as object,
        expiresAt: this.oneYearFromNow(),
      },
    });
    this.logger.log(`handleIdvWebhook: broker=${brokerId} -> ${result} (Sumsub reviewAnswer=${reviewAnswer})`);

    // Only auto-advance the pipeline on a clean pass. A FAIL or anything
    // ambiguous is deliberately left for a human admin to look at via the
    // "External checks" card - Sumsub's RED can mean genuine fraud, but it
    // can just as easily mean a blurry photo that needs resubmitting, and
    // this app has no automated way to tell those apart. Auto-suspending a
    // real person on an unreviewed vendor call isn't a call this method
    // should make on its own.
    if (result === "PASS") {
      const broker = await this.prisma.broker.findUnique({ where: { id: brokerId } });
      if (broker?.overallStatus === "IDV_PENDING") {
        await this.brokerVerificationService.transition(
          brokerId,
          "SCREENING_PENDING",
          undefined,
          "Sumsub identity verification passed automatically",
        );
      }
    }

    return { ok: true };
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
