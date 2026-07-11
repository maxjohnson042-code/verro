-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RelationshipStatus" ADD VALUE 'CREDIT_REP_PENDING';
ALTER TYPE "RelationshipStatus" ADD VALUE 'ACCREDITATION_PENDING';

-- AlterTable
ALTER TABLE "Broker" ADD COLUMN     "certIvCompletedAt" TIMESTAMP(3),
ADD COLUMN     "cpdHoursCurrentYear" INTEGER,
ADD COLUMN     "diplomaCompletedAt" TIMESTAMP(3),
ADD COLUMN     "piInsuranceExpiryAt" TIMESTAMP(3),
ADD COLUMN     "piInsurancePolicyNumber" TEXT;

-- AlterTable
ALTER TABLE "BrokerRelationship" ADD COLUMN     "creditRepAuthorisedAt" TIMESTAMP(3),
ADD COLUMN     "creditRepNumber" TEXT;

-- CreateTable
CREATE TABLE "AggregatorLenderPanel" (
    "id" TEXT NOT NULL,
    "aggregatorOrgId" TEXT NOT NULL,
    "lenderOrgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AggregatorLenderPanel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AggregatorLenderPanel_aggregatorOrgId_idx" ON "AggregatorLenderPanel"("aggregatorOrgId");

-- CreateIndex
CREATE INDEX "AggregatorLenderPanel_lenderOrgId_idx" ON "AggregatorLenderPanel"("lenderOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "AggregatorLenderPanel_aggregatorOrgId_lenderOrgId_key" ON "AggregatorLenderPanel"("aggregatorOrgId", "lenderOrgId");

-- AddForeignKey
ALTER TABLE "AggregatorLenderPanel" ADD CONSTRAINT "AggregatorLenderPanel_aggregatorOrgId_fkey" FOREIGN KEY ("aggregatorOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggregatorLenderPanel" ADD CONSTRAINT "AggregatorLenderPanel_lenderOrgId_fkey" FOREIGN KEY ("lenderOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
