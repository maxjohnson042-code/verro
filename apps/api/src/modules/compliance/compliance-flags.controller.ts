import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ComplianceFlagsService } from "./compliance-flags.service";
import { AccessGrantsService } from "../access-grants/access-grants.service";
import { FlagCategory, FlagSeverity } from "@verro/db";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.service";

// Epic: Data sharing & consent / Client dashboard. Guarded to org staff
// (plus internal admin/reviewer for read access, who see everything via
// the admin review queues regardless). raisedByOrganizationId/
// raisedByUserId now come from the authenticated caller, not the request
// body - same hardening pattern as ComplianceController.
@Controller("compliance-flags")
export class ComplianceFlagsController {
  constructor(
    private readonly flagsService: ComplianceFlagsService,
    private readonly accessGrantsService: AccessGrantsService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CLIENT_STAFF", "CLIENT_ADMIN")
  @Post()
  async raiseFlag(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      brokerId?: string;
      brokerBusinessId?: string;
      category: FlagCategory;
      severity: FlagSeverity;
      description: string;
    },
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
    return this.flagsService.raiseFlag({
      ...body,
      raisedByOrganizationId: user.organizationId,
      raisedByUserId: user.id,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CLIENT_STAFF", "CLIENT_ADMIN", "INTERNAL_ADMIN", "INTERNAL_REVIEWER")
  @Patch(":id/resolve")
  resolve(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { resolutionNotes?: string },
  ) {
    return this.flagsService.resolve(id, user.id, body.resolutionNotes);
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
    return this.flagsService.listForBroker(brokerId);
  }
}
