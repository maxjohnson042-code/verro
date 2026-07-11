import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { OrgType } from "@verro/db";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.service";

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  private assertOwnOrg(user: AuthenticatedUser) {
    if (!user.organizationId) {
      throw new ForbiddenException("This account has no organization");
    }
    return user.organizationId;
  }

  @Get()
  list(@Query("type") type?: OrgType) {
    return this.organizationsService.list(type);
  }

  // Epic: Client dashboard - org's own view of the network, scoped by
  // GRANTED AccessGrant (Section 1.1). "me" here means the caller's own
  // organizationId from their JWT, same pattern as /brokers/me/profile.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CLIENT_STAFF", "CLIENT_ADMIN")
  @Get("me/dashboard")
  getOwnDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.getDashboardSummary(this.assertOwnOrg(user));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CLIENT_STAFF", "CLIENT_ADMIN")
  @Get("me/brokers")
  getOwnVisibleBrokers(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.getVisibleBrokers(this.assertOwnOrg(user));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CLIENT_STAFF", "CLIENT_ADMIN")
  @Get("me/brokers/:brokerId")
  getOwnBrokerDetail(@Param("brokerId") brokerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.getBrokerDetail(this.assertOwnOrg(user), brokerId);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.organizationsService.get(id);
  }

  @Post()
  create(
    @Body()
    body: {
      orgType: OrgType;
      legalName: string;
      tradingName?: string;
      abnAcn?: string;
      primaryContactEmail?: string;
    },
  ) {
    return this.organizationsService.create(body);
  }
}
