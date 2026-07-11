/*
  Warnings:

  - A unique constraint covering the columns `[brokerId]` on the table `PortalUser` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PortalUser" ADD COLUMN     "brokerId" TEXT,
ADD COLUMN     "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PortalUser_brokerId_key" ON "PortalUser"("brokerId");

-- AddForeignKey
ALTER TABLE "PortalUser" ADD CONSTRAINT "PortalUser_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
