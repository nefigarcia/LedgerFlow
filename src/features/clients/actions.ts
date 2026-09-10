"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireOrgAccess } from "@/lib/auth/session";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/validation/result";
import { recordActivity, recordAudit } from "@/lib/audit/audit";

const clientSchema = z.object({
  companyName: z.string().min(1).max(200),
  contactName: z.string().max(200).optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().max(40).optional().nullable(),
  website: z.string().max(200).optional().nullable(),
  billingAddressLine1: z.string().max(200).optional().nullable(),
  billingAddressCity: z.string().max(120).optional().nullable(),
  billingAddressState: z.string().max(80).optional().nullable(),
  billingAddressPostalCode: z.string().max(20).optional().nullable(),
  billingAddressCountry: z.string().max(80).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  paymentTermsDaysOverride: z.coerce.number().min(0).max(365).optional().nullable(),
  currencyOverride: z.string().min(3).max(3).optional().nullable(),
});

export async function createClientAction(
  organizationSlug: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgAccess(organizationSlug, "clients:write");
  const raw = Object.fromEntries(formData);
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);
  const data = parsed.data;
  const created = await prisma.client.create({
    data: {
      organizationId: ctx.organizationId,
      companyName: data.companyName.trim(),
      contactName: data.contactName?.trim() || null,
      email: data.email ? data.email.trim().toLowerCase() : null,
      phone: data.phone?.trim() || null,
      website: data.website?.trim() || null,
      billingAddressLine1: data.billingAddressLine1 || null,
      billingAddressCity: data.billingAddressCity || null,
      billingAddressState: data.billingAddressState || null,
      billingAddressPostalCode: data.billingAddressPostalCode || null,
      billingAddressCountry: data.billingAddressCountry || null,
      notes: data.notes || null,
      paymentTermsDaysOverride: data.paymentTermsDaysOverride ?? null,
      currencyOverride: data.currencyOverride || null,
    },
  });
  await recordActivity({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "client.create",
    entityType: "Client",
    entityId: created.id,
    message: `Client ${created.companyName} added`,
  });
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "CREATE",
    entityType: "Client",
    entityId: created.id,
    after: { companyName: created.companyName },
  });
  revalidatePath(`/app/${organizationSlug}/clients`);
  return ok({ id: created.id });
}

export async function updateClientAction(
  organizationSlug: string,
  clientId: string,
  formData: FormData,
): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireOrgAccess(organizationSlug, "clients:write");
  const raw = Object.fromEntries(formData);
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: ctx.organizationId },
  });
  if (!client) return fail("NOT_FOUND", "Client not found.");
  const data = parsed.data;
  await prisma.client.update({
    where: { id: clientId },
    data: {
      companyName: data.companyName.trim(),
      contactName: data.contactName?.trim() || null,
      email: data.email ? data.email.trim().toLowerCase() : null,
      phone: data.phone?.trim() || null,
      website: data.website?.trim() || null,
      billingAddressLine1: data.billingAddressLine1 || null,
      billingAddressCity: data.billingAddressCity || null,
      billingAddressState: data.billingAddressState || null,
      billingAddressPostalCode: data.billingAddressPostalCode || null,
      billingAddressCountry: data.billingAddressCountry || null,
      notes: data.notes || null,
      paymentTermsDaysOverride: data.paymentTermsDaysOverride ?? null,
      currencyOverride: data.currencyOverride || null,
    },
  });
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "UPDATE",
    entityType: "Client",
    entityId: clientId,
    before: { companyName: client.companyName },
    after: { companyName: data.companyName },
  });
  revalidatePath(`/app/${organizationSlug}/clients`);
  revalidatePath(`/app/${organizationSlug}/clients/${clientId}`);
  return ok({ ok: true });
}

export async function archiveClientAction(
  organizationSlug: string,
  clientId: string,
): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireOrgAccess(organizationSlug, "clients:write");
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: ctx.organizationId },
  });
  if (!client) return fail("NOT_FOUND", "Client not found.");
  await prisma.client.update({
    where: { id: clientId },
    data: { active: false, archivedAt: new Date() },
  });
  await recordActivity({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "client.archive",
    entityType: "Client",
    entityId: clientId,
    message: `Client ${client.companyName} archived`,
  });
  revalidatePath(`/app/${organizationSlug}/clients`);
  return ok({ ok: true });
}
