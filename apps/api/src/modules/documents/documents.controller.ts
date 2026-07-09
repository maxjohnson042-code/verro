import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { DocumentsService } from "./documents.service";

@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  recordUpload(@Body() body: { brokerId: string; docType: string; storageKey: string }) {
    return this.documentsService.recordUpload(body);
  }

  @Get("broker/:brokerId")
  listForBroker(@Param("brokerId") brokerId: string) {
    return this.documentsService.listForBroker(brokerId);
  }

  @Patch(":id/review-status")
  setReviewStatus(@Param("id") id: string, @Body() body: { reviewStatus: "APPROVED" | "REJECTED" }) {
    return this.documentsService.setReviewStatus(id, body.reviewStatus);
  }
}
