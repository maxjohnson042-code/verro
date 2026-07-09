import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { BrokerBusinessService } from "./broker-business.service";
import { AclHolderType, BrokerBusinessMemberRole, BusinessEntityType } from "@verro/db";

@Controller("broker-businesses")
export class BrokerBusinessController {
  constructor(private readonly brokerBusinessService: BrokerBusinessService) {}

  @Post()
  createBusiness(
    @Body()
    body: {
      legalName: string;
      tradingName?: string;
      entityType: BusinessEntityType;
      abnAcn?: string;
      website?: string;
      aclHolderType: AclHolderType;
      aclNumber?: string;
      creditRepresentativeNumber?: string;
      aclHolderOrganizationId?: string;
    },
  ) {
    return this.brokerBusinessService.createBusiness(body);
  }

  @Post(":id/members")
  addMember(
    @Param("id") brokerBusinessId: string,
    @Body() body: { brokerId: string; role: BrokerBusinessMemberRole; isPrimary?: boolean },
  ) {
    return this.brokerBusinessService.addMember({ ...body, brokerBusinessId });
  }

  @Patch("members/:membershipId/end")
  endMembership(@Param("membershipId") membershipId: string) {
    return this.brokerBusinessService.endMembership(membershipId);
  }

  @Get(":id")
  getBusiness(@Param("id") id: string) {
    return this.brokerBusinessService.getBusiness(id);
  }

  @Get("broker/:brokerId")
  listForBroker(@Param("brokerId") brokerId: string) {
    return this.brokerBusinessService.listForBroker(brokerId);
  }
}
