// Curated evidence types matching the checklist rework fields (Broker:
// certIvCompletedAt/diplomaCompletedAt/piInsurance*, association
// membership) plus the standard business/identity checklist items.
// docType stays a free string on the Document model (no DB enum, so this
// list can grow without a migration) - this is just the UI-facing
// vocabulary, hand-mirrored on the frontend the same way
// STANDARD_LENDER_TRAINING is mirrored in seed.js.
export const BROKER_DOC_TYPES = [
  { value: "PHOTO_ID", label: "Photo ID (driver's licence / passport)" },
  { value: "POLICE_CHECK", label: "National police check" },
  { value: "CERT_IV", label: "Certificate IV in Finance & Mortgage Broking" },
  { value: "DIPLOMA", label: "Diploma of Finance & Mortgage Broking Management" },
  { value: "PI_INSURANCE", label: "Professional indemnity insurance certificate" },
  { value: "ASSOCIATION_MEMBERSHIP", label: "Association membership certificate (MFAA/FBAA)" },
  { value: "ASIC_EXTRACT", label: "ASIC company extract" },
  { value: "ABN_REGISTRATION", label: "ABN registration" },
  { value: "OTHER", label: "Other supporting document" },
] as const;

export type BrokerDocType = (typeof BROKER_DOC_TYPES)[number]["value"];
