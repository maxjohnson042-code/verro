-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('AGGREGATOR', 'LENDER', 'ASSOCIATION', 'INTERNAL');

-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('INVITED', 'DRAFT', 'SUBMITTED', 'IDV_PENDING', 'SCREENING_PENDING', 'DOC_REVIEW_PENDING', 'PENDING_ADMIN_APPROVAL', 'ACTIVE', 'FLAGGED', 'SUSPENDED', 'DECLINED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CheckType" AS ENUM ('IDV', 'AML', 'CREDIT', 'POLICE', 'ASIC', 'ABN');

-- CreateEnum
CREATE TYPE "CheckResult" AS ENUM ('PENDING', 'PASS', 'FAIL', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "DocReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AccessGrantOrigin" AS ENUM ('BROKER_INITIATED', 'ORG_REQUESTED');

-- CreateEnum
CREATE TYPE "AccessGrantStatus" AS ENUM ('PENDING', 'GRANTED', 'DENIED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PortalRole" AS ENUM ('BROKER', 'CLIENT_STAFF', 'CLIENT_ADMIN', 'INTERNAL_ADMIN', 'INTERNAL_REVIEWER');

-- CreateEnum
CREATE TYPE "BusinessEntityType" AS ENUM ('SOLE_TRADER', 'COMPANY', 'PARTNERSHIP', 'TRUST');

-- CreateEnum
CREATE TYPE "AclHolderType" AS ENUM ('OWN_ACL', 'CREDIT_REPRESENTATIVE');

-- CreateEnum
CREATE TYPE "BrokerBusinessMemberRole" AS ENUM ('PRINCIPAL', 'DIRECTOR', 'CREDIT_REPRESENTATIVE', 'EMPLOYEE', 'OTHER');

-- CreateEnum
CREATE TYPE "NoteVisibility" AS ENUM ('PRIVATE_TO_ORG', 'NETWORK_VISIBLE');

-- CreateEnum
CREATE TYPE "FlagCategory" AS ENUM ('CONDUCT', 'FRAUD', 'DOCUMENTATION', 'LICENCE', 'COMPLAINT', 'OTHER');

-- CreateEnum
CREATE TYPE "FlagSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FlagStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "Broker" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "otherNames" TEXT,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "state" TEXT,
    "personalCrn" TEXT,
    "associationName" TEXT,
    "associationMembershipNumber" TEXT,
    "attestedAt" TIMESTAMP(3),
    "overallStatus" "RelationshipStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerBusiness" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradingName" TEXT,
    "entityType" "BusinessEntityType" NOT NULL,
    "abnAcn" TEXT,
    "website" TEXT,
    "aclHolderType" "AclHolderType" NOT NULL,
    "aclNumber" TEXT,
    "creditRepresentativeNumber" TEXT,
    "aclHolderOrganizationId" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerBusiness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerBusinessMembership" (
    "id" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "brokerBusinessId" TEXT NOT NULL,
    "role" "BrokerBusinessMemberRole" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerBusinessMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerBusinessRelationship" (
    "id" TEXT NOT NULL,
    "brokerBusinessId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "RelationshipStatus" NOT NULL DEFAULT 'DRAFT',
    "accreditedDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerBusinessRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "orgType" "OrgType" NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradingName" TEXT,
    "abnAcn" TEXT,
    "primaryContactEmail" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "state" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerRelationship" (
    "id" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "brokerBusinessId" TEXT,
    "status" "RelationshipStatus" NOT NULL DEFAULT 'DRAFT',
    "accreditedDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCheck" (
    "id" TEXT NOT NULL,
    "brokerId" TEXT,
    "brokerBusinessId" TEXT,
    "checkType" "CheckType" NOT NULL,
    "vendor" TEXT,
    "result" "CheckResult" NOT NULL DEFAULT 'PENDING',
    "rawResponse" JSONB,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "brokerId" TEXT,
    "brokerBusinessId" TEXT,
    "docType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "reviewStatus" "DocReviewStatus" NOT NULL DEFAULT 'PENDING',
    "verificationCheckId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRecord" (
    "id" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "trainingName" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedDate" TIMESTAMP(3),
    "markedByUserId" TEXT,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusEvent" (
    "id" TEXT NOT NULL,
    "relationshipId" TEXT,
    "businessRelationshipId" TEXT,
    "fromStatus" "RelationshipStatus",
    "toStatus" "RelationshipStatus" NOT NULL,
    "actionedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalUser" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "role" "PortalRole" NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "jobTitle" TEXT,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGrant" (
    "id" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "origin" "AccessGrantOrigin" NOT NULL,
    "status" "AccessGrantStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT,
    "decidedByBrokerId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceNote" (
    "id" TEXT NOT NULL,
    "brokerId" TEXT,
    "brokerBusinessId" TEXT,
    "organizationId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "NoteVisibility" NOT NULL DEFAULT 'PRIVATE_TO_ORG',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceFlag" (
    "id" TEXT NOT NULL,
    "brokerId" TEXT,
    "brokerBusinessId" TEXT,
    "raisedByOrganizationId" TEXT NOT NULL,
    "raisedByUserId" TEXT NOT NULL,
    "category" "FlagCategory" NOT NULL,
    "severity" "FlagSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "FlagStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Broker_email_key" ON "Broker"("email");

-- CreateIndex
CREATE INDEX "Broker_lastName_firstName_idx" ON "Broker"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "BrokerBusiness_abnAcn_idx" ON "BrokerBusiness"("abnAcn");

-- CreateIndex
CREATE INDEX "BrokerBusinessMembership_brokerId_idx" ON "BrokerBusinessMembership"("brokerId");

-- CreateIndex
CREATE INDEX "BrokerBusinessMembership_brokerBusinessId_idx" ON "BrokerBusinessMembership"("brokerBusinessId");

-- CreateIndex
CREATE INDEX "BrokerBusinessRelationship_organizationId_status_idx" ON "BrokerBusinessRelationship"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerBusinessRelationship_brokerBusinessId_organizationId_key" ON "BrokerBusinessRelationship"("brokerBusinessId", "organizationId");

-- CreateIndex
CREATE INDEX "Organization_orgType_idx" ON "Organization"("orgType");

-- CreateIndex
CREATE INDEX "BrokerRelationship_organizationId_status_idx" ON "BrokerRelationship"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerRelationship_brokerId_organizationId_key" ON "BrokerRelationship"("brokerId", "organizationId");

-- CreateIndex
CREATE INDEX "VerificationCheck_brokerId_checkType_idx" ON "VerificationCheck"("brokerId", "checkType");

-- CreateIndex
CREATE INDEX "VerificationCheck_brokerBusinessId_checkType_idx" ON "VerificationCheck"("brokerBusinessId", "checkType");

-- CreateIndex
CREATE INDEX "VerificationCheck_expiresAt_idx" ON "VerificationCheck"("expiresAt");

-- CreateIndex
CREATE INDEX "Document_brokerId_docType_idx" ON "Document"("brokerId", "docType");

-- CreateIndex
CREATE INDEX "Document_brokerBusinessId_docType_idx" ON "Document"("brokerBusinessId", "docType");

-- CreateIndex
CREATE INDEX "TrainingRecord_relationshipId_idx" ON "TrainingRecord"("relationshipId");

-- CreateIndex
CREATE INDEX "StatusEvent_relationshipId_createdAt_idx" ON "StatusEvent"("relationshipId", "createdAt");

-- CreateIndex
CREATE INDEX "StatusEvent_businessRelationshipId_createdAt_idx" ON "StatusEvent"("businessRelationshipId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortalUser_email_key" ON "PortalUser"("email");

-- CreateIndex
CREATE INDEX "PortalUser_organizationId_idx" ON "PortalUser"("organizationId");

-- CreateIndex
CREATE INDEX "AccessGrant_organizationId_status_idx" ON "AccessGrant"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGrant_brokerId_organizationId_key" ON "AccessGrant"("brokerId", "organizationId");

-- CreateIndex
CREATE INDEX "ComplianceNote_brokerId_idx" ON "ComplianceNote"("brokerId");

-- CreateIndex
CREATE INDEX "ComplianceNote_brokerBusinessId_idx" ON "ComplianceNote"("brokerBusinessId");

-- CreateIndex
CREATE INDEX "ComplianceFlag_brokerId_status_idx" ON "ComplianceFlag"("brokerId", "status");

-- CreateIndex
CREATE INDEX "ComplianceFlag_brokerBusinessId_status_idx" ON "ComplianceFlag"("brokerBusinessId", "status");

-- AddForeignKey
ALTER TABLE "BrokerBusiness" ADD CONSTRAINT "BrokerBusiness_aclHolderOrganizationId_fkey" FOREIGN KEY ("aclHolderOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerBusinessMembership" ADD CONSTRAINT "BrokerBusinessMembership_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerBusinessMembership" ADD CONSTRAINT "BrokerBusinessMembership_brokerBusinessId_fkey" FOREIGN KEY ("brokerBusinessId") REFERENCES "BrokerBusiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerBusinessRelationship" ADD CONSTRAINT "BrokerBusinessRelationship_brokerBusinessId_fkey" FOREIGN KEY ("brokerBusinessId") REFERENCES "BrokerBusiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerBusinessRelationship" ADD CONSTRAINT "BrokerBusinessRelationship_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerRelationship" ADD CONSTRAINT "BrokerRelationship_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerRelationship" ADD CONSTRAINT "BrokerRelationship_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerRelationship" ADD CONSTRAINT "BrokerRelationship_brokerBusinessId_fkey" FOREIGN KEY ("brokerBusinessId") REFERENCES "BrokerBusiness"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCheck" ADD CONSTRAINT "VerificationCheck_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCheck" ADD CONSTRAINT "VerificationCheck_brokerBusinessId_fkey" FOREIGN KEY ("brokerBusinessId") REFERENCES "BrokerBusiness"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_brokerBusinessId_fkey" FOREIGN KEY ("brokerBusinessId") REFERENCES "BrokerBusiness"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_verificationCheckId_fkey" FOREIGN KEY ("verificationCheckId") REFERENCES "VerificationCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "BrokerRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "BrokerRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_businessRelationshipId_fkey" FOREIGN KEY ("businessRelationshipId") REFERENCES "BrokerBusinessRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_actionedBy_fkey" FOREIGN KEY ("actionedBy") REFERENCES "PortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalUser" ADD CONSTRAINT "PortalUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceNote" ADD CONSTRAINT "ComplianceNote_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceNote" ADD CONSTRAINT "ComplianceNote_brokerBusinessId_fkey" FOREIGN KEY ("brokerBusinessId") REFERENCES "BrokerBusiness"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceNote" ADD CONSTRAINT "ComplianceNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceNote" ADD CONSTRAINT "ComplianceNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "PortalUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFlag" ADD CONSTRAINT "ComplianceFlag_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFlag" ADD CONSTRAINT "ComplianceFlag_brokerBusinessId_fkey" FOREIGN KEY ("brokerBusinessId") REFERENCES "BrokerBusiness"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFlag" ADD CONSTRAINT "ComplianceFlag_raisedByOrganizationId_fkey" FOREIGN KEY ("raisedByOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFlag" ADD CONSTRAINT "ComplianceFlag_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "PortalUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFlag" ADD CONSTRAINT "ComplianceFlag_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "PortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
