import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// Epic: Broker onboarding (document upload) / Security (Section 3).
// Milestone 1: store metadata only. storageKey points at an S3 object -
// actual presigned-URL upload flow against a real bucket comes once AWS
// credentials exist (see .env.example / README).
@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordUpload(input: { brokerId: string; docType: string; storageKey: string }) {
    return this.prisma.document.create({ data: { ...input } });
  }

  async listForBroker(brokerId: string) {
    return this.prisma.document.findMany({ where: { brokerId }, orderBy: { uploadedAt: "desc" } });
  }

  async setReviewStatus(documentId: string, reviewStatus: "APPROVED" | "REJECTED") {
    return this.prisma.document.update({ where: { id: documentId }, data: { reviewStatus } });
  }
}
