import { Module } from "@nestjs/common";
import { AccessGrantsController } from "./access-grants.controller";
import { AccessGrantsService } from "./access-grants.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  controllers: [AccessGrantsController],
  providers: [AccessGrantsService],
  exports: [AccessGrantsService],
})
export class AccessGrantsModule {}
