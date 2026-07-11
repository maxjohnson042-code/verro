import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

// Epic: Verro 'admin' review (Section 3) - internal ops/compliance team
// only. Every route here requires a PortalUser with role INTERNAL_ADMIN
// or INTERNAL_REVIEWER (Milestone 2 auth).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("INTERNAL_ADMIN", "INTERNAL_REVIEWER")
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // One row per broker - the global verification pipeline (Section 2,
  // reworked). Renamed from the old per-relationship "review-queue" but
  // kept at the same URL to avoid an unnecessary breaking change for
  // anything else calling it.
  @Get("review-queue")
  getVerificationQueue() {
    return this.adminService.getVerificationQueue();
  }

  // One row per broker-organization pair awaiting the organization's
  // single lightweight accept (Section 2, reworked) - only reachable once
  // the broker's own verification is already ACTIVE.
  @Get("pending-acceptances")
  getPendingAcceptances() {
    return this.adminService.getPendingAcceptances();
  }

  @Get("flagged")
  getFlaggedAndSuspended() {
    return this.adminService.getFlaggedAndSuspended();
  }

  // Full cross-org profile for one broker - backs the new unified admin
  // broker-profile page (linked from the review queue).
  @Get("brokers/:id")
  getBrokerFullProfile(@Param("id") id: string) {
    return this.adminService.getBrokerFullProfile(id);
  }
}
