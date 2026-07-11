import { Module } from "@nestjs/common";
import { BrokerBusinessController } from "./broker-business.controller";
import { BrokerBusinessService } from "./broker-business.service";
import { VerificationModule } from "../verification/verification.module";

@Module({
  imports: [VerificationModule],
  controllers: [BrokerBusinessController],
  providers: [BrokerBusinessService],
  exports: [BrokerBusinessService],
})
export class BrokerBusinessModule {}
