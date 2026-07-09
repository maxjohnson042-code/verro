import { Module } from "@nestjs/common";
import { ComplianceController } from "./compliance.controller";
import { ComplianceService } from "./compliance.service";
import { ComplianceNotesController } from "./compliance-notes.controller";
import { ComplianceNotesService } from "./compliance-notes.service";
import { ComplianceFlagsController } from "./compliance-flags.controller";
import { ComplianceFlagsService } from "./compliance-flags.service";

// "Compliance" here covers the status state machine (Section 2) plus the
// new note/flag capability for FBAA/MFAA/lenders/aggregators.
@Module({
  controllers: [ComplianceController, ComplianceNotesController, ComplianceFlagsController],
  providers: [ComplianceService, ComplianceNotesService, ComplianceFlagsService],
  exports: [ComplianceService, ComplianceNotesService, ComplianceFlagsService],
})
export class ComplianceModule {}
