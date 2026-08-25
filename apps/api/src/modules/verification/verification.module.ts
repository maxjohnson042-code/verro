import { Module } from "@nestjs/common";
import { VerificationController } from "./verification.controller";
import { VerificationService } from "./verification.service";
import { ComplianceModule } from "../compliance/compliance.module";
import { AccessGrantsModule } from "../access-grants/access-grants.module";

@Module({
  imports: [ComplianceModule, AccessGrantsModule],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
