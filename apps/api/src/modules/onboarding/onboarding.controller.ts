import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { OnboardingService } from "./onboarding.service";
import { BrokerVerificationService } from "../compliance/broker-verification.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.service";
import type { BrokerVerificationStatus } from "@verro/db";

// Broker self-registration (POST) moved to AuthController
// (/auth/register/broker) since it now creates both a Broker row and a
// PortalUser login together and returns a token - see auth.service.ts.
//
// Every mutating route below requires the caller's JWT to be for the
// broker they're targeting - assertOwnBroker() throws otherwise, so a
// valid token for broker A can't be used to edit broker B's profile just
// by changing the :id in the URL.
@Controller("brokers")
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly brokerVerificationService: BrokerVerificationService,
  ) {}

  private assertOwnBroker(user: AuthenticatedUser, brokerId: string) {
    if (user.brokerId !== brokerId) {
      throw new ForbiddenException("You can only manage your own broker profile");
    }
  }

  // GET /brokers/:id stays unguarded for now - used by Admin and, later,
  // by an organization that holds a GRANTED AccessGrant for this broker
  // (Section 1.1). Real row-level scoping for those consumers is a
  // follow-up once org/admin auth grows beyond the review queue.
  @Get(":id")
  getProfile(@Param("id") id: string) {
    return this.onboardingService.getBrokerProfile(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me/profile")
  getOwnProfile(@CurrentUser() user: AuthenticatedUser) {
    if (!user.brokerId) throw new ForbiddenException("This account has no broker profile");
    return this.onboardingService.getBrokerProfile(user.brokerId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/association")
  setAssociation(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { associationName: string; associationMembershipNumber: string },
  ) {
    this.assertOwnBroker(user, id);
    return this.onboardingService.setAssociation(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/qualifications")
  setQualifications(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      certIvCompletedAt?: string;
      diplomaCompletedAt?: string;
      cpdHoursCurrentYear?: number;
      piInsurancePolicyNumber?: string;
      piInsuranceExpiryAt?: string;
    },
  ) {
    this.assertOwnBroker(user, id);
    return this.onboardingService.setQualifications(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/attest")
  attest(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    this.assertOwnBroker(user, id);
    return this.onboardingService.attest(id);
  }

  // Section 2 (further reworked) - what a broker can connect to next,
  // given the chain of trust: associations if verification is ACTIVE,
  // aggregators once an association relationship is ACTIVE, and only the
  // current aggregator's panel lenders once an aggregator relationship is
  // ACTIVE. Drives the staged /broker/connect UI.
  @UseGuards(JwtAuthGuard)
  @Get(":id/connect-options")
  getConnectOptions(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    this.assertOwnBroker(user, id);
    return this.onboardingService.getConnectOptions(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/relationships")
  addRelationship(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { organizationId: string },
  ) {
    this.assertOwnBroker(user, id);
    return this.onboardingService.addRelationship(id, body.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("relationships/:relationshipId")
  async removeRelationship(@Param("relationshipId") relationshipId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.onboardingService.assertRelationshipOwnedBy(relationshipId, user.brokerId);
    return this.onboardingService.removeRelationship(relationshipId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/submit")
  submit(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    this.assertOwnBroker(user, id);
    return this.onboardingService.submitOnboarding(id);
  }

  // Admin-only: advances the broker's own verification pipeline (Section
  // 2, reworked) - IDV -> screening -> doc review -> admin approval. This
  // is what Admin's verification queue (one row per broker) calls.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("INTERNAL_ADMIN", "INTERNAL_REVIEWER")
  @Post(":id/transition")
  transitionVerification(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { toStatus: BrokerVerificationStatus; reason?: string },
  ) {
    return this.brokerVerificationService.transition(id, body.toStatus, user.id, body.reason);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("INTERNAL_ADMIN", "INTERNAL_REVIEWER")
  @Get(":id/history")
  verificationHistory(@Param("id") id: string) {
    return this.brokerVerificationService.history(id);
  }
}
