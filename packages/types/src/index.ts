// Shared types for frontend (@verro/web) use. The NestJS API can import
// Prisma's generated types directly from @verro/db; the frontend
// shouldn't depend on @prisma/client, so these are hand-mirrored slim
// versions of the same enums/shapes defined in packages/db/prisma/schema.prisma.
// Keep these in sync manually until/unless we add a codegen step.

export type RelationshipStatus =
  | "INVITED"
  | "DRAFT"
  | "SUBMITTED"
  | "IDV_PENDING"
  | "SCREENING_PENDING"
  | "DOC_REVIEW_PENDING"
  | "PENDING_ADMIN_APPROVAL"
  | "ACTIVE"
  | "FLAGGED"
  | "SUSPENDED"
  | "DECLINED"
  | "REVOKED";

export type OrgType = "AGGREGATOR" | "LENDER" | "ASSOCIATION" | "INTERNAL";

export type AccessGrantOrigin = "BROKER_INITIATED" | "ORG_REQUESTED";
export type AccessGrantStatus = "PENDING" | "GRANTED" | "DENIED" | "REVOKED";

export interface BrokerSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  overallStatus: RelationshipStatus;
}

export interface BrokerRelationshipSummary {
  id: string;
  brokerId: string;
  organizationId: string;
  organizationName: string;
  status: RelationshipStatus;
  accreditedDate?: string;
  nextReviewDate?: string;
}

export interface AccessGrantSummary {
  id: string;
  brokerId: string;
  organizationId: string;
  organizationName: string;
  origin: AccessGrantOrigin;
  status: AccessGrantStatus;
  requestedAt: string;
  decidedAt?: string;
}
