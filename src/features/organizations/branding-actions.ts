"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireOrgAccess } from "@/lib/auth/session";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/validation/result";
import { recordActivity, recordAudit } from "@/lib/audit/audit";
import { getStorage, StorageNotConfiguredError } from "@/lib/storage/storage";
import { buildObjectKey, keyBelongsToOrganization } from "@/lib/storage/keys";
import { detectLogoImageType, MAX_LOGO_BYTES } from "@/lib/storage/image-type";

function revalidateBranding(slug: string) {
  // The logo appears in the sidebar on every page of the workspace.
  revalidatePath(`/app/${slug}`, "layout");
}

export async function uploadLogoAction(
  organizationSlug: string,
  formData: FormData,
): Promise<ActionResult<{ logoUpdatedAt: string }>> {
  const ctx = await requireOrgAccess(organizationSlug, "org:manage");

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return fail("VALIDATION_ERROR", "Choose a PNG or JPEG image to upload.");
  }
  if (file.size > MAX_LOGO_BYTES) {
    return fail("VALIDATION_ERROR", "Logo must be 2 MB or smaller.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const type = detectLogoImageType(bytes);
  if (!type) {
    return fail("VALIDATION_ERROR", "Logo must be a PNG or JPEG image.");
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
    select: { logoKey: true },
  });

  const key = buildObjectKey(ctx.organizationId, "logo", `logo.${type.extension}`);
  try {
    const storage = getStorage();
    await storage.put(bytes, {
      key,
      contentType: type.mimeType,
      // Keys are unique per upload, so objects never change and can be cached.
      cacheControl: "private, max-age=31536000, immutable",
    });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return fail("STORAGE_NOT_CONFIGURED", err.message);
    console.error("logo upload failed", err);
    return fail("STORAGE_ERROR", "Could not upload the logo. Please try again.");
  }

  const now = new Date();
  await prisma.organization.update({
    where: { id: ctx.organizationId },
    data: { logoKey: key, logoMimeType: type.mimeType, logoUpdatedAt: now },
  });

  // Remove the previous object only after the new one is saved.
  if (org.logoKey && keyBelongsToOrganization(org.logoKey, ctx.organizationId)) {
    await getStorage().delete(org.logoKey).catch((err) => console.error("old logo delete failed", err));
  }

  await recordActivity({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "org.logo.update",
    entityType: "Organization",
    entityId: ctx.organizationId,
    message: "Workspace logo updated",
  });
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "UPDATE",
    entityType: "OrganizationLogo",
    entityId: ctx.organizationId,
    before: { hadLogo: Boolean(org.logoKey) },
    after: { mimeType: type.mimeType, size: bytes.length },
  });

  revalidateBranding(organizationSlug);
  return ok({ logoUpdatedAt: now.toISOString() });
}

export async function removeLogoAction(organizationSlug: string): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireOrgAccess(organizationSlug, "org:manage");
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
    select: { logoKey: true },
  });
  if (!org.logoKey) return ok({ ok: true });

  await prisma.organization.update({
    where: { id: ctx.organizationId },
    data: { logoKey: null, logoMimeType: null, logoUpdatedAt: new Date() },
  });
  if (keyBelongsToOrganization(org.logoKey, ctx.organizationId)) {
    try {
      await getStorage().delete(org.logoKey);
    } catch (err) {
      console.error("logo delete failed", err);
    }
  }
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "DELETE",
    entityType: "OrganizationLogo",
    entityId: ctx.organizationId,
  });
  revalidateBranding(organizationSlug);
  return ok({ ok: true });
}

const optionalText = (max: number) =>
  z.string().max(max).optional().nullable().transform((v) => (v && v.trim() ? v.trim() : null));

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter a business name").max(120),
  legalName: optionalText(200),
  taxIdLastFour: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v && v.trim() ? v.trim() : null))
    .refine((v) => v == null || /^\d{4}$/.test(v), "Use the last four digits only"),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  addressCity: optionalText(120),
  addressState: optionalText(80),
  addressPostalCode: optionalText(20),
  addressCountry: optionalText(80),
  phone: optionalText(40),
  website: optionalText(200),
});

export async function updateOrganizationProfileAction(
  organizationSlug: string,
  formData: FormData,
): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireOrgAccess(organizationSlug, "org:manage");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const before = await prisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
    select: { name: true, legalName: true, addressLine1: true, addressCity: true, phone: true, website: true },
  });
  // The slug is intentionally not changed so existing links keep working.
  await prisma.organization.update({ where: { id: ctx.organizationId }, data: parsed.data });
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "UPDATE",
    entityType: "OrganizationProfile",
    entityId: ctx.organizationId,
    before,
    after: parsed.data,
  });
  revalidateBranding(organizationSlug);
  return ok({ ok: true });
}
