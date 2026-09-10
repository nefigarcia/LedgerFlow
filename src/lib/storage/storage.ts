import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";

/**
 * Storage abstraction. Local filesystem for development;
 * swap to S3/R2 for production by implementing the same interface.
 */
export interface StorageDriver {
  put(buffer: Buffer, opts: { fileName: string; mimeType: string; organizationId: string }): Promise<{
    storageDriver: string;
    storagePath: string;
    fileName: string;
  }>;
  get(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}

class LocalStorageDriver implements StorageDriver {
  private baseDir = process.env.STORAGE_LOCAL_DIR ?? path.join(process.cwd(), "storage", "uploads");

  async put(buffer: Buffer, opts: { fileName: string; mimeType: string; organizationId: string }) {
    const safeName = opts.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${opts.organizationId}/${createId()}-${safeName}`;
    const abs = path.join(this.baseDir, key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buffer);
    return {
      storageDriver: "local",
      storagePath: key,
      fileName: safeName,
    };
  }

  async get(storagePath: string): Promise<Buffer> {
    const abs = path.join(this.baseDir, storagePath);
    return fs.readFile(abs);
  }

  async delete(storagePath: string): Promise<void> {
    const abs = path.join(this.baseDir, storagePath);
    await fs.unlink(abs).catch(() => {});
  }
}

let cached: StorageDriver | null = null;
export function getStorage(): StorageDriver {
  if (!cached) {
    cached = new LocalStorageDriver();
  }
  return cached;
}
