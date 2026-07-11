import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { ComplianceModule } from "../compliance/compliance.module";
import { VerificationModule } from "../verification/verification.module";

@Module({
  imports: [OnboardingModule, ComplianceModule, VerificationModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
