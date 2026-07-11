import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { LocalStorageService } from "./local-storage.service";

// Epic: Broker onboarding (document upload) / Security (Section 3).
// Milestone 3: real upload flow against local disk (see
// LocalStorageService) - metadata-only storage from Milestone 1 is gone.
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
  ) {}

  async uploadForBroker(input: {
    brokerId: string;
    docType: string;
    uploadedByUserId: string;
    originalFilename: string;
    mimeType: string;
    buffer: Buffer;
  }) {
    if (!input.buffer || input.buffer.length === 0) {
      throw new BadRequestException("Uploaded file is empty");
    }
    const storageKey = this.storage.put(input.brokerId, input.originalFilename, input.buffer);
    return this.prisma.document.create({
      data: {
        brokerId: input.brokerId,
        docType: input.docType,
        storageKey,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        fileSizeBytes: input.buffer.length,
        uploadedByUserId: input.uploadedByUserId,
      },
    });
  }

  async listForBroker(brokerId: string) {
    return this.prisma.document.findMany({ where: { brokerId }, orderBy: { uploadedAt: "desc" } });
  }

  async getById(documentId: string) {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException("Document not found");
    return doc;
  }

  async getFileBuffer(documentId: string) {
    const doc = await this.getById(documentId);
    return { doc, buffer: this.storage.get(doc.storageKey) };
  }

  async setReviewStatus(
    documentId: string,
    reviewStatus: "APPROVED" | "REJECTED",
    reviewedByUserId: string,
    reviewNotes?: string,
  ) {
    await this.getById(documentId);
    return this.prisma.document.update({
      where: { id: documentId },
      data: { reviewStatus, reviewedByUserId, reviewedAt: new Date(), reviewNotes },
    });
  }
}
