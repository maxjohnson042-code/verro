import { Module } from "@nestjs/common";
import { BrokerBusinessController } from "./broker-business.controller";
import { BrokerBusinessService } from "./broker-business.service";

@Module({
  controllers: [BrokerBusinessController],
  providers: [BrokerBusinessService],
  exports: [BrokerBusinessService],
})
export class BrokerBusinessModule {}
