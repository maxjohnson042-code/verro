-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "originalFilename" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "fileSizeBytes" INTEGER,
ADD COLUMN     "uploadedByUserId" TEXT,
ADD COLUMN     "reviewedByUserId" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewNotes" TEXT;
