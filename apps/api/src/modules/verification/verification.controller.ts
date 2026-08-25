import { Body, Controller, ForbiddenException, Get, Headers, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { VerificationService } from "./verification.service";
import { AccessGrantsService } from "../access-grants/access-grants.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.service";

// Previously this whole controller had zero auth guards - any caller could
// POST an arbitrary brokerId to /abn-lookup or /idv and create fake
// VerificationCheck rows, or read any broker's check history. Fixed here
// with the same guard/assertCanView pattern already used in
// DocumentsController for the same reason.
@Controller("verification")
export class VerificationController {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly accessGrantsService: AccessGrantsService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("INTERNAL_ADMIN", "INTERNAL_REVIEWER")
  @Post("abn-lookup")
  runAbnLookup(@Body() body: { brokerId?: string; brokerBusinessId?: string; abn: string }) {
    return this.verificationService.runAbnLookup(body);
  }

  // Broker-initiated: mints a Sumsub WebSDK access token for the LOGGED-IN
  // broker's own identity (brokerId always comes from the JWT, never from
  // the request body - nobody should be able to start an IDV session
  // against someone else's profile).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("BROKER")
  @Post("idv/token")
  async createIdvSession(@CurrentUser() user: AuthenticatedUser) {
    if (!user.brokerId) {
      throw new ForbiddenException("This account has no broker profile");
    }
    return this.verificationService.createIdvSession(user.brokerId);
  }

  // Called by Sumsub, not by our own frontend - no JWT to check, since
  // Sumsub isn't a logged-in user. Authenticity comes entirely from the
  // HMAC signature (see VerificationService.handleIdvWebhook), computed
  // over the exact raw bytes of this request - hence @Req() rather than
  // @Body(), and main.ts's `rawBody: true`.
  @Post("idv/webhook")
  handleIdvWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers("x-payload-digest") digest: string | undefined,
    @Headers("x-payload-digest-alg") alg: string | undefined,
  ) {
    return this.verificationService.handleIdvWebhook(req.rawBody ?? Buffer.alloc(0), digest, alg);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("BROKER", "CLIENT_STAFF", "CLIENT_ADMIN", "INTERNAL_ADMIN", "INTERNAL_REVIEWER")
  @Get("broker/:brokerId")
  async listForBroker(@Param("brokerId") brokerId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.assertCanView(brokerId, user);
    return this.verificationService.listForBroker(brokerId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("INTERNAL_ADMIN", "INTERNAL_REVIEWER")
  @Get("stale")
  listStale() {
    return this.verificationService.listStale();
  }

  // Mirrors DocumentsController.assertCanView - same audience should be
  // able to see check results as can see the documents backing them.
  private async assertCanView(brokerId: string, user: AuthenticatedUser) {
    if (user.role === "BROKER") {
      if (user.brokerId !== brokerId) {
        throw new ForbiddenException("You can only view your own verification checks");
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
