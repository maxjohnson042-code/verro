// Shared contract between LocalStorageService (dev, no cloud account
// needed) and S3StorageService (production - real AWS bucket). Every layer
// above this (DocumentsService and up) only ever deals with a storageKey
// string, so which implementation is actually in use is decided once, in
// DocumentsModule's factory provider, and nowhere else in the app needs to
// know or care. See DOCUMENT_STORAGE token below.
export interface DocumentStorage {
  put(scope: string, originalFilename: string, buffer: Buffer, mimeType?: string): Promise<string>;
  get(storageKey: string): Promise<Buffer>;
}

export const DOCUMENT_STORAGE = "DOCUMENT_STORAGE";
