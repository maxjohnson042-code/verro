import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { OnboardingService } from "./onboarding.service";

@Controller("brokers")
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post()
  register(
    @Body()
    body: {
      firstName: string;
      lastName: string;
      email: string;
      dateOfBirth: string;
    },
  ) {
    return this.onboardingService.registerBroker({
      ...body,
      dateOfBirth: new Date(body.dateOfBirth),
    });
  }

  @Get(":id")
  getProfile(@Param("id") id: string) {
    return this.onboardingService.getBrokerProfile(id);
  }
}
