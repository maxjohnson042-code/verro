import { Module } from "@nestjs/common";
import { ComplianceController } from "./compliance.controller";
import { ComplianceService } from "./compliance.service";
import { BrokerVerificationService } from "./broker-verification.service";
import { ComplianceNotesController } from "./compliance-notes.controller";
import { ComplianceNotesService } from "./compliance-notes.service";
import { ComplianceFlagsController } from "./compliance-flags.controller";
import { ComplianceFlagsService } from "./compliance-flags.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { AccessGrantsModule } from "../access-grants/access-grants.module";

// "Compliance" here covers both state machines from Section 2 (reworked):
// BrokerVerificationService for the broker's one global verification
// pipeline, ComplianceService for the thin per-organization relationship
// status - plus the note/flag capability for FBAA/MFAA/lenders/aggregators.
@Module({
  imports: [NotificationsModule, AccessGrantsModule],
  controllers: [ComplianceController, ComplianceNotesController, ComplianceFlagsController],
  providers: [ComplianceService, BrokerVerificationService, ComplianceNotesService, ComplianceFlagsService],
  exports: [ComplianceService, BrokerVerificationService, ComplianceNotesService, ComplianceFlagsService],
})
export class ComplianceModule {}
