import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ComplianceFlagsService } from "./compliance-flags.service";
import { FlagCategory, FlagSeverity } from "@verro/db";

@Controller("compliance-flags")
export class ComplianceFlagsController {
  constructor(private readonly flagsService: ComplianceFlagsService) {}

  @Post()
  raiseFlag(
    @Body()
    body: {
      brokerId?: string;
      brokerBusinessId?: string;
      raisedByOrganizationId: string;
      raisedByUserId: string;
      category: FlagCategory;
      severity: FlagSeverity;
      description: string;
    },
  ) {
    return this.flagsService.raiseFlag(body);
  }

  @Patch(":id/resolve")
  resolve(@Param("id") id: string, @Body() body: { resolvedByUserId: string; resolutionNotes?: string }) {
    return this.flagsService.resolve(id, body.resolvedByUserId, body.resolutionNotes);
  }

  @Get("broker/:brokerId")
  listForBroker(@Param("brokerId") brokerId: string) {
    return this.flagsService.listForBroker(brokerId);
  }
}
