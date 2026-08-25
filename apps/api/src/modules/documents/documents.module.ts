import { Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { LocalStorageService } from "./local-storage.service";
import { S3StorageService } from "./s3-storage.service";
import { DOCUMENT_STORAGE } from "./storage.interface";
import { AccessGrantsModule } from "../access-grants/access-grants.module";

const storageLogger = new Logger("DocumentsModule");

@Module({
  imports: [AccessGrantsModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    LocalStorageService,
    // Real S3 storage kicks in automatically once all four AWS_S3_* vars
    // are set (see .env.example) - otherwise this falls back to disk, same
    // fail-safe philosophy as NotificationsService/VerificationService.
    // No other file in the app needs to know which one is active.
    {
      provide: DOCUMENT_STORAGE,
      inject: [ConfigService, LocalStorageService],
      useFactory: (config: ConfigService, local: LocalStorageService) => {
        const bucket = config.get<string>("AWS_S3_BUCKET");
        const region = config.get<string>("AWS_REGION");
        const accessKeyId = config.get<string>("AWS_S3_ACCESS_KEY_ID");
        const secretAccessKey = config.get<string>("AWS_S3_SECRET_ACCESS_KEY");
        if (bucket && region && accessKeyId && secretAccessKey) {
          return new S3StorageService(bucket, region, accessKeyId, secretAccessKey);
        }
        storageLogger.warn(
          "AWS_S3_* not fully configured - documents will be stored on local disk. See .env.example.",
        );
        return local;
      },
    },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
