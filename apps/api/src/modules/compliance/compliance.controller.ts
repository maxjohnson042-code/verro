import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ComplianceService } from "./compliance.service";
import { RelationshipStatus } from "@verro/db";

@Controller("relationships")
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Post(":id/transition")
  transition(
    @Param("id") id: string,
    @Body() body: { toStatus: RelationshipStatus; actionedBy?: string; reason?: string },
  ) {
    return this.complianceService.transition(id, body.toStatus, body.actionedBy, body.reason);
  }

  @Get(":id/history")
  history(@Param("id") id: string) {
    return this.complianceService.history(id);
  }
}
