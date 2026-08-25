import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DocumentStorage } from "./storage.interface";

// Real AWS S3-backed storage - see AWS_REGION / AWS_S3_BUCKET /
// AWS_S3_ACCESS_KEY_ID / AWS_S3_SECRET_ACCESS_KEY in .env.example.
// DocumentsModule only ever constructs this once all four are present
// (see the DOCUMENT_STORAGE factory provider); everything else in the app
// still just deals with an opaque storageKey string, same as before.
//
// storageKey doubles as the S3 object key, so it's namespaced the same way
// LocalStorageService namespaced its on-disk paths:
// "{scope}/{uuid}__{safe-original-filename}".
@Injectable()
export class S3StorageService implements DocumentStorage {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    this.client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
    this.logger.log(`S3StorageService active - bucket=${bucket} region=${region}`);
  }

  async put(scope: string, originalFilename: string, buffer: Buffer, mimeType?: string): Promise<string> {
    const safeName = originalFilename.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
    const key = `${scope}/${randomUUID()}__${safeName}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        // Documents are broker PII / compliance evidence - never public.
        // Every read still goes through DocumentsController's
        // assertCanView() check, same as local storage.
        ServerSideEncryption: "AES256",
      }),
    );
    return key;
  }

  async get(storageKey: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    if (!result.Body) {
      throw new Error(`S3 returned no body for key ${storageKey}`);
    }
    // result.Body is a Node.js Readable at runtime (this only ever runs
    // server-side) - read it into a Buffer by hand rather than relying on
    // the transformToByteArray() convenience helper, so this doesn't
    // depend on a specific @aws-sdk/client-s3 minor version.
    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as AsyncIterable<Buffer | Uint8Array>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
