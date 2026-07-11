import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { ComplianceModule } from "../compliance/compliance.module";

@Module({
  imports: [OnboardingModule, ComplianceModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
