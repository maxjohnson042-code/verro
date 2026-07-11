import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { DocumentsService } from "./documents.service";
import { AccessGrantsService } from "../access-grants/access-grants.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.service";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Multer's memoryStorage() (the default when FileInterceptor is given no
// storage option) puts the raw upload in file.buffer - no @types/multer
// needed since we only reference the handful of fields we actually use.
interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Epic: Broker onboarding (document upload) / Security (Section 3) / Data
// sharing & consent. Broker uploads and lists their own documents; any
// org holding a GRANTED AccessGrant for the broker (Section 1.1), or
// internal admin/reviewer, can view + download + set review status -
// same access pattern already applied to ComplianceNotes/ComplianceFlags.
@Controller("documents")
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly accessGrantsService: AccessGrantsService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("BROKER")
  @Post()
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedFileLike,
    @Body() body: { docType: string },
  ) {
    if (!user.brokerId) {
      throw new ForbiddenException("This account has no broker profile");
    }
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException("File exceeds the 10MB limit");
    }
    if (!body.docType) {
      throw new BadRequestException("docType is required");
    }

    return this.documentsService.uploadForBroker({
      brokerId: user.brokerId,
      docType: body.docType,
      uploadedByUserId: user.id,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("BROKER", "CLIENT_STAFF", "CLIENT_ADMIN", "INTERNAL_ADMIN", "INTERNAL_REVIEWER")
  @Get("broker/:brokerId")
  async listForBroker(@Param("brokerId") brokerId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.assertCanView(brokerId, user);
    return this.documentsService.listForBroker(brokerId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("BROKER", "CLIENT_STAFF", "CLIENT_ADMIN", "INTERNAL_ADMIN", "INTERNAL_REVIEWER")
  @Get("broker/:brokerId/photo")
  async downloadPhoto(@Param("brokerId") brokerId: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    await this.assertCanView(brokerId, user);
    const { doc, buffer } = await this.documentsService.getPhotoBuffer(brokerId);
    res.setHeader("Content-Type", doc.mimeType ?? "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=60");
    res.send(buffer);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("BROKER", "CLIENT_STAFF", "CLIENT_ADMIN", "INTERNAL_ADMIN", "INTERNAL_REVIEWER")
  @Get(":id/file")
  async downloadFile(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const { doc, buffer } = await this.documentsService.getFileBuffer(id);
    if (doc.brokerId) {
      await this.assertCanView(doc.brokerId, user);
    }
    res.setHeader("Content-Type", doc.mimeType ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${doc.originalFilename ?? "document"}"`);
    res.send(buffer);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("INTERNAL_ADMIN", "INTERNAL_REVIEWER")
  @Patch(":id/review-status")
  setReviewStatus(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { reviewStatus: "APPROVED" | "REJECTED"; reviewNotes?: string },
  ) {
    return this.documentsService.setReviewStatus(id, body.reviewStatus, user.id, body.reviewNotes);
  }

  private async assertCanView(brokerId: string, user: AuthenticatedUser) {
    if (user.role === "BROKER") {
      if (user.brokerId !== brokerId) {
        throw new ForbiddenException("You can only view your own documents");
      }
      return;
    }
    if (user.role === "INTERNAL_ADMIN" || user.role === "INTERNAL_REVIEWER") {
      return;
    }
    if (!user.organizationId) {
      throw new ForbiddenException("This account has no organization");
    }
    const granted = await this.accessGrantsService.hasGrantedAccess(brokerId, user.organizationId);
    if (!granted) {
      throw new ForbiddenException("You don't have access to this broker's information");
    }
  }
}
