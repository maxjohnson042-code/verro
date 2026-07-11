// Thin client for the Australian Business Register's free ABN Lookup web
// service (https://abr.business.gov.au/Tools/WebServices). Registration for
// an authentication GUID is free - see ABR_ABN_LOOKUP_GUID in .env.example.
// No SDK dependency: the JSON endpoint is a plain GET returning a JSONP
// payload (`callback({...})`), so this just uses the platform fetch (Node
// 20+, per package.json engines) and strips the wrapper by hand.
//
// Reference (verified against ABR's documented web service methods, July
// 2026): GET https://abr.business.gov.au/json/AbnDetails.aspx
//   ?abn={abn}&guid={guid}&callback=callback

const ABR_BASE_URL = "https://abr.business.gov.au/json/AbnDetails.aspx";

export interface AbrAbnDetails {
  abn: string;
  abnStatus: string;
  abnStatusEffectiveFrom: string | null;
  acn: string | null;
  entityName: string;
  entityTypeCode: string;
  entityTypeName: string;
  businessNames: string[];
  addressState: string | null;
  addressPostcode: string | null;
  gst: string | null;
}

export type AbrLookupOutcome =
  | { outcome: "FOUND"; details: AbrAbnDetails; raw: unknown }
  | { outcome: "NOT_FOUND"; message: string }
  | { outcome: "INVALID_GUID"; message: string }
  | { outcome: "ERROR"; message: string };

// ABN check-digit algorithm (published by the ATO): subtract 1 from the
// first digit, multiply all 11 digits by their weighting factors, sum, and
// the result must be divisible by 89. Lets us reject a malformed ABN
// without spending an API call on it.
const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

export function isValidAbnChecksum(rawAbn: string): boolean {
  const digits = rawAbn.replace(/\s+/g, "");
  if (!/^\d{11}$/.test(digits)) return false;
  const weighted = digits.split("").map((d, i) => {
    const value = i === 0 ? Number(d) - 1 : Number(d);
    return value * ABN_WEIGHTS[i];
  });
  const sum = weighted.reduce((a, b) => a + b, 0);
  return sum % 89 === 0;
}

function parseJsonp(body: string): Record<string, unknown> {
  const match = body.match(/^\s*callback\((.*)\)\s*;?\s*$/s);
  const jsonText = match ? match[1] : body;
  return JSON.parse(jsonText);
}

export async function lookupAbn(abn: string, guid: string): Promise<AbrLookupOutcome> {
  const digits = abn.replace(/\s+/g, "");
  const url = `${ABR_BASE_URL}?abn=${encodeURIComponent(digits)}&guid=${encodeURIComponent(guid)}&callback=callback`;

  const response = await fetch(url);
  if (!response.ok) {
    return { outcome: "ERROR", message: `ABR returned HTTP ${response.status}` };
  }
  const body = await response.text();

  let data: Record<string, unknown>;
  try {
    data = parseJsonp(body);
  } catch {
    return { outcome: "ERROR", message: "ABR returned an unparseable response" };
  }

  const message = typeof data.Message === "string" ? data.Message : "";

  if (message) {
    if (/no record found|abn not found/i.test(message)) {
      return { outcome: "NOT_FOUND", message };
    }
    if (/guid.*not recognised|not a registered party/i.test(message)) {
      return { outcome: "INVALID_GUID", message };
    }
    // Any other non-empty Message from the ABR (e.g. "Search text is not a
    // valid ABN or ACN") is treated as a lookup failure rather than a
    // successful record.
    return { outcome: "ERROR", message };
  }

  const businessNames = Array.isArray(data.BusinessName)
    ? (data.BusinessName as unknown[]).filter((n): n is string => typeof n === "string")
    : [];

  return {
    outcome: "FOUND",
    raw: data,
    details: {
      abn: String(data.Abn ?? digits),
      abnStatus: String(data.AbnStatus ?? "Unknown"),
      abnStatusEffectiveFrom: typeof data.AbnStatusEffectiveFrom === "string" ? data.AbnStatusEffectiveFrom : null,
      acn: typeof data.Acn === "string" && data.Acn ? data.Acn : null,
      entityName: String(data.EntityName ?? ""),
      entityTypeCode: String(data.EntityTypeCode ?? ""),
      entityTypeName: String(data.EntityTypeName ?? ""),
      businessNames,
      addressState: typeof data.AddressState === "string" ? data.AddressState : null,
      addressPostcode: typeof data.AddressPostcode === "string" ? data.AddressPostcode : null,
      gst: typeof data.Gst === "string" && data.Gst ? data.Gst : null,
    },
  };
}
