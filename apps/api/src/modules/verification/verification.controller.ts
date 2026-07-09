import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { VerificationService } from "./verification.service";

@Controller("verification")
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post("abn-lookup")
  runAbnLookup(@Body() body: { brokerId?: string; brokerBusinessId?: string; abn: string }) {
    return this.verificationService.runAbnLookup(body);
  }

  @Post("idv")
  runIdv(@Body() body: { brokerId: string }) {
    return this.verificationService.runIdv(body.brokerId);
  }

  @Get("broker/:brokerId")
  listForBroker(@Param("brokerId") brokerId: string) {
    return this.verificationService.listForBroker(brokerId);
  }

  @Get("stale")
  listStale() {
    return this.verificationService.listStale();
  }
}
