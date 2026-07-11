import { Module } from "@nestjs/common";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";
import { AccessGrantsModule } from "../access-grants/access-grants.module";
import { ComplianceModule } from "../compliance/compliance.module";

@Module({
  imports: [AccessGrantsModule, ComplianceModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
