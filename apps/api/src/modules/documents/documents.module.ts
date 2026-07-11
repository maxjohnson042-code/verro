import { Module } from "@nestjs/common";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { LocalStorageService } from "./local-storage.service";
import { AccessGrantsModule } from "../access-grants/access-grants.module";

@Module({
  imports: [AccessGrantsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, LocalStorageService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
