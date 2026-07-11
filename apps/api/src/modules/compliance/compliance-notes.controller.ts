import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ComplianceNotesService } from "./compliance-notes.service";
import { AccessGrantsService } from "../access-grants/access-grants.service";
import { NoteVisibility } from "@verro/db";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.service";

// Epic: Data sharing & consent / Client dashboard. Guarded to org staff
// (plus internal admin/reviewer, who see everything via the admin review
// queues regardless). organizationId/authorUserId now come from the
// authenticated caller, not the request body, so the audit trail can't be
// spoofed - same hardening pattern as ComplianceController.
@Controller("compliance-notes")
export class ComplianceNotesController {
  constructor(
    private readonly notesService: ComplianceNotesService,
    private readonly accessGrantsService: AccessGrantsService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CLIENT_STAFF", "CLIENT_ADMIN")
  @Post()
  async addNote(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { brokerId?: string; brokerBusinessId?: string; body: string; visibility?: NoteVisibility },
  ) {
    if (!user.organizationId) {
      throw new ForbiddenException("This account has no organization");
    }
    if (body.brokerId) {
      const granted = await this.accessGrantsService.hasGrantedAccess(body.brokerId, user.organizationId);
      if (!granted) {
        throw new ForbiddenException("You don't have access to this broker's information");
      }
    }
    return this.notesService.addNote({ ...body, organizationId: user.organizationId, authorUserId: user.id });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CLIENT_STAFF", "CLIENT_ADMIN", "INTERNAL_ADMIN", "INTERNAL_REVIEWER")
  @Get("broker/:brokerId")
  async listForBroker(@Param("brokerId") brokerId: string, @CurrentUser() user: AuthenticatedUser) {
    if (user.organizationId) {
      const granted = await this.accessGrantsService.hasGrantedAccess(brokerId, user.organizationId);
      if (!granted) {
        throw new ForbiddenException("You don't have access to this broker's information");
      }
    }
    // Internal admin/reviewer aren't org-scoped - pass a organizationId
    // that never matches a real org so the OR clause falls back to
    // NETWORK_VISIBLE-only, same as any outside org would see.
    return this.notesService.listForBroker(brokerId, user.organizationId ?? "internal-admin");
  }
}
