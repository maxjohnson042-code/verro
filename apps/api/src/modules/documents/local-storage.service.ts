import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// Milestone 3: document upload flow. Files live on local disk under
// apps/api/uploads/ (gitignored) so the whole stack runs without any
// cloud account - see AWS_S3_* in .env.example for the eventual S3
// swap-in. storageKey is a relative path within UPLOAD_ROOT; every other
// layer of the app only ever deals with storageKey, so swapping this
// service for an S3-backed one later is a self-contained change.
//
// __dirname here is apps/api/{src,dist}/modules/documents at runtime
// either way (ts-node dev or compiled dist) - three levels up lands on
// apps/api regardless of which one is running.
const UPLOAD_ROOT = join(__dirname, "..", "..", "..", "uploads");

@Injectable()
export class LocalStorageService {
  put(scope: string, originalFilename: string, buffer: Buffer): string {
    const dir = join(UPLOAD_ROOT, scope);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const safeName = originalFilename.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
    const key = `${scope}/${randomUUID()}__${safeName}`;
    writeFileSync(join(UPLOAD_ROOT, key), buffer);
    return key;
  }

  get(storageKey: string): Buffer {
    return readFileSync(join(UPLOAD_ROOT, storageKey));
  }
}
