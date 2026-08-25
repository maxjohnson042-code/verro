import { createHmac } from "crypto";

// Thin client for Sumsub's ID&V API (https://docs.sumsub.com). Two
// unrelated signing schemes are involved here, both HMAC-SHA256 by
// default but computed differently - easy to mix up, so they're kept as
// two clearly-separate functions:
//  - signRequest(): signs OUTGOING requests we make to Sumsub's API
//    (POST /resources/accessTokens/sdk), per their "Authentication" spec.
//  - verifyWebhookSignature(): verifies INCOMING webhook calls Sumsub
//    makes to us, per their "Webhook manager - verify webhook sender" spec.
// Verified against Sumsub's docs.sumsub.com reference pages, Aug 2026.

const DEFAULT_BASE_URL = "https://api.sumsub.com";

function signRequest(secretKey: string, ts: number, method: string, path: string, body: string): string {
  // Sig = HMAC-SHA256(secretKey, ts + METHOD + path(+query) + body), hex,
  // lowercase. body is omitted entirely for requests with no body (e.g.
  // GET) - always present here since we only ever POST.
  return createHmac("sha256", secretKey).update(`${ts}${method}${path}${body}`).digest("hex");
}

export interface CreateAccessTokenParams {
  appToken: string;
  secretKey: string;
  userId: string; // becomes externalUserId on the applicant - we use brokerId
  levelName: string;
  email?: string;
  phone?: string;
  ttlInSecs?: number;
  baseUrl?: string;
}

export async function createAccessToken(params: CreateAccessTokenParams): Promise<{ token: string; userId: string }> {
  const path = "/resources/accessTokens/sdk";
  const bodyObj: Record<string, unknown> = {
    userId: params.userId,
    levelName: params.levelName,
    ttlInSecs: params.ttlInSecs ?? 600,
  };
  if (params.email || params.phone) {
    bodyObj.applicantIdentifiers = {
      ...(params.email ? { email: params.email } : {}),
      ...(params.phone ? { phone: params.phone } : {}),
    };
  }
  const body = JSON.stringify(bodyObj);
  const ts = Math.floor(Date.now() / 1000);
  const sig = signRequest(params.secretKey, ts, "POST", path, body);

  const res = await fetch(`${params.baseUrl ?? DEFAULT_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-App-Token": params.appToken,
      "X-App-Access-Sig": sig,
      "X-App-Access-Ts": String(ts),
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sumsub access token request failed (HTTP ${res.status}): ${text}`);
  }
  return res.json();
}

const WEBHOOK_ALGO_MAP: Record<string, string> = {
  HMAC_SHA1_HEX: "sha1",
  HMAC_SHA256_HEX: "sha256",
  HMAC_SHA512_HEX: "sha512",
};

// Sumsub signs the RAW request bytes (not a re-serialized JSON.stringify,
// which can legitimately differ in whitespace/key order from what they
// actually sent) - the caller must pass the untouched Buffer captured
// before any body-parsing/re-encoding happens. See main.ts's `rawBody:
// true` option and VerificationController's webhook handler.
export function verifyWebhookSignature(
  rawBody: Buffer,
  digestHeader: string | undefined,
  algHeader: string | undefined,
  secretKey: string,
): boolean {
  if (!digestHeader || !algHeader || !secretKey) return false;
  const algo = WEBHOOK_ALGO_MAP[algHeader.toUpperCase()];
  if (!algo) return false;
  const computed = createHmac(algo, secretKey).update(rawBody).digest("hex");
  return computed === digestHeader;
}

// Only the fields VerificationService actually reads from an
// applicantReviewed webhook - Sumsub's real payload has more (inspectionId,
// correlationId, createdAtMs, clientId, applicantType, etc.), all of which
// still land in rawResponse on the VerificationCheck row for audit purposes.
export interface SumsubWebhookPayload {
  type: string;
  applicantId?: string;
  externalUserId?: string;
  reviewStatus?: string;
  reviewResult?: {
    reviewAnswer?: "GREEN" | "RED";
  };
}
