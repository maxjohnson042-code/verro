import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ComplianceService } from "./compliance.service";
import { RelationshipStatus } from "@verro/db";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.service";

@Controller("relationships")
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  // State-machine transitions (Section 2) are an Admin action - reason is
  // still caller-supplied (useful context for a decline/flag/suspend),
  // but actionedBy now comes from the authenticated user rather than a
  // client-supplied field, so the audit trail (StatusEvent.actionedBy)
  // can't be spoofed.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("INTERNAL_ADMIN", "INTERNAL_REVIEWER")
  @Post(":id/transition")
  transition(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { toStatus: RelationshipStatus; reason?: string },
  ) {
    return this.complianceService.transition(id, body.toStatus, user.id, body.reason);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("INTERNAL_ADMIN", "INTERNAL_REVIEWER")
  @Get(":id/history")
  history(@Param("id") id: string) {
    return this.complianceService.history(id);
  }

  // Checklist rework - Section: Licensing structure. Admin-only for now
  // (stands in for the aggregator's own portal action, same pattern as the
  // rest of this controller - see the class-level comment).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("INTERNAL_ADMIN", "INTERNAL_REVIEWER")
  @Post(":id/credit-rep")
  recordCreditRep(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { creditRepNumber: string },
  ) {
    return this.complianceService.recordCreditRep(id, body.creditRepNumber, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("INTERNAL_ADMIN", "INTERNAL_REVIEWER")
  @Get(":id/training")
  listTraining(@Param("id") id: string) {
    return this.complianceService.listTrainingRecords(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("INTERNAL_ADMIN", "INTERNAL_REVIEWER")
  @Post("training/:trainingRecordId")
  setTrainingCompleted(
    @Param("trainingRecordId") trainingRecordId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { completed: boolean },
  ) {
    return this.complianceService.setTrainingRecordCompleted(trainingRecordId, body.completed, user.id);
  }
}
