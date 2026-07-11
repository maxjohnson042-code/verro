/*
  Warnings:

  - The values [DRAFT,SUBMITTED,IDV_PENDING,SCREENING_PENDING,DOC_REVIEW_PENDING,PENDING_ADMIN_APPROVAL] on the enum `RelationshipStatus` will be removed. If these variants are still used in the database, this will fail.
  - The `overallStatus` column on the `Broker` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "BrokerVerificationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IDV_PENDING', 'SCREENING_PENDING', 'DOC_REVIEW_PENDING', 'PENDING_ADMIN_APPROVAL', 'ACTIVE', 'DECLINED', 'SUSPENDED', 'REVOKED');

-- Move Broker.overallStatus onto the new enum FIRST, before the old
-- RelationshipStatus type gets dropped below - otherwise DROP TYPE fails
-- because this column still depends on it (Postgres won't drop a type
-- with live dependents). Hand-fixed from Prisma's auto-generated ordering.
ALTER TABLE "Broker" ALTER COLUMN "overallStatus" DROP DEFAULT;
ALTER TABLE "Broker" ALTER COLUMN "overallStatus" TYPE "BrokerVerificationStatus" USING ("overallStatus"::text::"BrokerVerificationStatus");
ALTER TABLE "Broker" ALTER COLUMN "overallStatus" SET DEFAULT 'DRAFT';

-- AlterEnum
BEGIN;
CREATE TYPE "RelationshipStatus_new" AS ENUM ('INVITED', 'PENDING_ACCEPTANCE', 'ACTIVE', 'DECLINED', 'FLAGGED', 'SUSPENDED', 'REVOKED');
ALTER TABLE "BrokerBusinessRelationship" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "BrokerRelationship" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "BrokerBusinessRelationship" ALTER COLUMN "status" TYPE "RelationshipStatus_new" USING ("status"::text::"RelationshipStatus_new");
ALTER TABLE "BrokerRelationship" ALTER COLUMN "status" TYPE "RelationshipStatus_new" USING ("status"::text::"RelationshipStatus_new");
ALTER TABLE "StatusEvent" ALTER COLUMN "fromStatus" TYPE "RelationshipStatus_new" USING ("fromStatus"::text::"RelationshipStatus_new");
ALTER TABLE "StatusEvent" ALTER COLUMN "toStatus" TYPE "RelationshipStatus_new" USING ("toStatus"::text::"RelationshipStatus_new");
ALTER TYPE "RelationshipStatus" RENAME TO "RelationshipStatus_old";
ALTER TYPE "RelationshipStatus_new" RENAME TO "RelationshipStatus";
DROP TYPE "RelationshipStatus_old";
ALTER TABLE "BrokerBusinessRelationship" ALTER COLUMN "status" SET DEFAULT 'PENDING_ACCEPTANCE';
ALTER TABLE "BrokerRelationship" ALTER COLUMN "status" SET DEFAULT 'PENDING_ACCEPTANCE';
COMMIT;

-- AlterTable
ALTER TABLE "BrokerBusinessRelationship" ALTER COLUMN "status" SET DEFAULT 'PENDING_ACCEPTANCE';

-- AlterTable
ALTER TABLE "BrokerRelationship" ALTER COLUMN "status" SET DEFAULT 'PENDING_ACCEPTANCE';

-- CreateTable
CREATE TABLE "BrokerStatusEvent" (
    "id" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "fromStatus" "BrokerVerificationStatus",
    "toStatus" "BrokerVerificationStatus" NOT NULL,
    "actionedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrokerStatusEvent_brokerId_createdAt_idx" ON "BrokerStatusEvent"("brokerId", "createdAt");

-- AddForeignKey
ALTER TABLE "BrokerStatusEvent" ADD CONSTRAINT "BrokerStatusEvent_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerStatusEvent" ADD CONSTRAINT "BrokerStatusEvent_actionedBy_fkey" FOREIGN KEY ("actionedBy") REFERENCES "PortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
