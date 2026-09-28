import { createId } from "@paralleldrive/cuid2";

/**
 * Object-key helpers shared by every storage driver.
 *
 * Layout:  orgs/{organizationId}/{category}/{cuid}-{safeName}
 *
 * Keys always start with the tenant's organizationId so a bucket policy,
 * lifecycle rule, or manual audit can be scoped per tenant, and a key taken
 * from the database can be checked against the tenant that asked for it.
 */
export type StorageCategory = "logo" | "documents" | "receipts";

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(-100);
  return cleaned.length > 0 && cleaned !== "." && cleaned !== ".." ? cleaned : "file";
}

export function buildObjectKey(organizationId: string, category: StorageCategory, fileName: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(organizationId)) {
    throw new Error("Invalid organization id for storage key");
  }
  return `orgs/${organizationId}/${category}/${createId()}-${sanitizeFileName(fileName)}`;
}

/** True when the key is well-formed and belongs to the given organization. */
export function keyBelongsToOrganization(key: string, organizationId: string): boolean {
  return isSafeKey(key) && key.startsWith(`orgs/${organizationId}/`);
}

/** Rejects absolute paths, traversal segments, and backslashes. */
export function isSafeKey(key: string): boolean {
  if (!key || key.length > 512) return false;
  if (key.startsWith("/") || key.includes("\\")) return false;
  return key.split("/").every((seg) => seg.length > 0 && seg !== "." && seg !== "..");
}
