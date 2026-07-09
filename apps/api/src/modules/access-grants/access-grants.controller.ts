import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { AccessGrantsService } from "./access-grants.service";

@Controller("access-grants")
export class AccessGrantsController {
  constructor(private readonly accessGrantsService: AccessGrantsService) {}

  @Get("broker/:brokerId")
  listForBroker(@Param("brokerId") brokerId: string) {
    return this.accessGrantsService.listForBroker(brokerId);
  }

  @Post("request")
  requestAccess(
    @Body() body: { brokerId: string; organizationId: string; requestedByUserId: string },
  ) {
    return this.accessGrantsService.requestAccess(
      body.brokerId,
      body.organizationId,
      body.requestedByUserId,
    );
  }

  @Patch(":id/decide")
  decide(@Param("id") id: string, @Body() body: { decision: "GRANTED" | "DENIED"; brokerId: string }) {
    return this.accessGrantsService.decide(id, body.decision, body.brokerId);
  }

  @Patch(":id/revoke")
  revoke(@Param("id") id: string, @Body() body: { brokerId: string }) {
    return this.accessGrantsService.revoke(id, body.brokerId);
  }
}
