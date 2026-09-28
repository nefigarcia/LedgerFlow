import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { isSafeKey } from "./keys";

/**
 * Storage abstraction.
 *
 *   STORAGE_DRIVER=s3     → private S3 bucket (or any S3-compatible store via S3_ENDPOINT)
 *   STORAGE_DRIVER=local  → ./storage/uploads (development only)
 *
 * Callers pass a fully-built key (see keys.ts). Objects are never public:
 * the app streams them back through authenticated routes.
 */
export interface PutOptions {
  key: string;
  contentType: string;
  cacheControl?: string;
}

export interface StorageDriver {
  readonly name: "local" | "s3";
  put(body: Buffer, opts: PutOptions): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export class StorageNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageNotConfiguredError";
  }
}

function assertKey(key: string) {
  if (!isSafeKey(key)) throw new Error("Invalid storage key");
}

class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;
  private baseDir = path.resolve(process.env.STORAGE_LOCAL_DIR ?? path.join(process.cwd(), "storage", "uploads"));

  private resolve(key: string) {
    assertKey(key);
    const abs = path.resolve(this.baseDir, key);
    // Defense in depth: never touch files outside the uploads directory.
    if (!abs.startsWith(this.baseDir + path.sep)) throw new Error("Invalid storage key");
    return abs;
  }

  async put(body: Buffer, opts: PutOptions) {
    const abs = this.resolve(opts.key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, body);
  }

  async get(key: string) {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string) {
    await fs.unlink(this.resolve(key)).catch(() => {});
  }
}

class S3StorageDriver implements StorageDriver {
  readonly name = "s3" as const;
  private client: S3Client;
  private bucket: string;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION;
    if (!bucket || !region) {
      throw new StorageNotConfiguredError("S3 storage requires S3_BUCKET and S3_REGION.");
    }
    this.bucket = bucket;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    this.client = new S3Client({
      region,
      // Explicit keys when provided (Vercel reserves AWS_* names, so we use S3_*).
      // Otherwise fall back to the default AWS credential chain (IAM role, SSO, etc.).
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    });
  }

  async put(body: Buffer, opts: PutOptions) {
    assertKey(opts.key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: opts.key,
        Body: body,
        ContentType: opts.contentType,
        CacheControl: opts.cacheControl,
        ServerSideEncryption: process.env.S3_ENDPOINT ? undefined : "AES256",
      }),
    );
  }

  async get(key: string) {
    assertKey(key);
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!res.Body) throw new Error("Empty object body");
    return Buffer.from(await res.Body.transformToByteArray());
  }

  async delete(key: string) {
    assertKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

function selectedDriver(): "local" | "s3" {
  const explicit = process.env.STORAGE_DRIVER?.toLowerCase();
  if (explicit === "s3" || explicit === "local") return explicit;
  return process.env.S3_BUCKET ? "s3" : "local";
}

let cached: StorageDriver | null = null;

/**
 * Returns the configured driver. Throws StorageNotConfiguredError when the
 * app runs on a serverless host (read-only filesystem) without S3 settings,
 * so uploads fail with a clear message instead of silently losing files.
 */
export function getStorage(): StorageDriver {
  if (cached) return cached;
  const driver = selectedDriver();
  if (driver === "s3") {
    cached = new S3StorageDriver();
  } else {
    if (process.env.VERCEL) {
      throw new StorageNotConfiguredError(
        "File storage is not configured. Set STORAGE_DRIVER=s3 with S3_BUCKET and S3_REGION.",
      );
    }
    cached = new LocalStorageDriver();
  }
  return cached;
}

/** Whether uploads can work in this environment (used to guide the UI). */
export function isStorageConfigured(): boolean {
  try {
    getStorage();
    return true;
  } catch {
    return false;
  }
}
