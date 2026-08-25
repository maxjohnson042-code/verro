import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { DocumentStorage } from "./storage.interface";

// Milestone 3: document upload flow. Files live on local disk under
// apps/api/uploads/ (gitignored) so the whole stack runs without any
// cloud account. This is now the dev-only fallback - DocumentsModule picks
// this over S3StorageService automatically whenever AWS_S3_* isn't fully
// configured, same fail-safe philosophy as email/ABR (see storage.interface.ts).
// storageKey is a relative path within UPLOAD_ROOT.
//
// __dirname here is apps/api/{src,dist}/modules/documents at runtime
// either way (ts-node dev or compiled dist) - three levels up lands on
// apps/api regardless of which one is running.
const UPLOAD_ROOT = join(__dirname, "..", "..", "..", "uploads");

@Injectable()
export class LocalStorageService implements DocumentStorage {
  async put(scope: string, originalFilename: string, buffer: Buffer): Promise<string> {
    const dir = join(UPLOAD_ROOT, scope);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const safeName = originalFilename.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
    const key = `${scope}/${randomUUID()}__${safeName}`;
    writeFileSync(join(UPLOAD_ROOT, key), buffer);
    return key;
  }

  async get(storageKey: string): Promise<Buffer> {
    return readFileSync(join(UPLOAD_ROOT, storageKey));
  }
}
