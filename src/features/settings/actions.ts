"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireOrgAccess } from "@/lib/auth/session";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/validation/result";
import { moneySum, toDecimal } from "@/lib/money/money";
import { recordAudit } from "@/lib/audit/audit";

const financialSettingsSchema = z.object({
  currency: z.string().min(3).max(3),
  openingBalance: z.coerce.number(),
  minimumOperatingReserve: z.coerce.number().min(0),
  defaultTaxReserveRate: z.coerce.number().min(0).max(100),
  fiscalYearStartMonth: z.coerce.number().min(1).max(12),
});

export async function updateFinancialSettingsAction(
  organizationSlug: string,
  formData: FormData,
): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireOrgAccess(organizationSlug, "settings:write");
  const parsed = financialSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  await prisma.organization.update({
    where: { id: ctx.organizationId },
    data: {
      currency: parsed.data.currency,
      openingBalance: parsed.data.openingBalance.toString(),
      minimumOperatingReserve: parsed.data.minimumOperatingReserve.toString(),
      defaultTaxReserveRate: parsed.data.defaultTaxReserveRate.toString(),
      fiscalYearStartMonth: parsed.data.fiscalYearStartMonth,
    },
  });
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "UPDATE",
    entityType: "OrganizationSettings",
    entityId: ctx.organizationId,
    after: parsed.data,
  });
  revalidatePath(`/app/${organizationSlug}/settings`);
  revalidatePath(`/app/${organizationSlug}/dashboard`);
  return ok({ ok: true });
}

const invoiceSettingsSchema = z.object({
  invoicePrefix: z.string().min(1).max(10),
  invoiceNextNumber: z.coerce.number().min(1),
  defaultPaymentTermsDays: z.coerce.number().min(0).max(365),
  paymentInstructions: z.string().max(2000).optional().nullable(),
});

export async function updateInvoiceSettingsAction(
  organizationSlug: string,
  formData: FormData,
): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireOrgAccess(organizationSlug, "settings:write");
  const parsed = invoiceSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  await prisma.organization.update({
    where: { id: ctx.organizationId },
    data: {
      invoicePrefix: parsed.data.invoicePrefix.toUpperCase(),
      invoiceNextNumber: parsed.data.invoiceNextNumber,
      defaultPaymentTermsDays: parsed.data.defaultPaymentTermsDays,
    },
  });
  revalidatePath(`/app/${organizationSlug}/settings`);
  return ok({ ok: true });
}

const ownerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  ownershipPercentage: z.coerce.number().min(0).max(100),
  distributionPercentage: z.coerce.number().min(0).max(100),
  taxReserveOverride: z.coerce.number().min(0).max(100).optional().nullable(),
  active: z.coerce.boolean().default(true),
});

export async function upsertOwnerAction(
  organizationSlug: string,
  ownerId: string | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgAccess(organizationSlug, "owners:manage");
  const raw = Object.fromEntries(formData);
  raw.active = raw.active ? "true" : "false";
  const parsed = ownerSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);
  const data = parsed.data;
  const record = ownerId
    ? await prisma.owner.update({
        where: { id: ownerId },
        data: {
          name: data.name,
          email: data.email ? data.email.toLowerCase() : null,
          ownershipPercentage: data.ownershipPercentage.toString(),
          distributionPercentage: data.distributionPercentage.toString(),
          taxReserveOverride:
            data.taxReserveOverride != null ? data.taxReserveOverride.toString() : null,
          active: data.active,
        },
      })
    : await prisma.owner.create({
        data: {
          organizationId: ctx.organizationId,
          name: data.name,
          email: data.email ? data.email.toLowerCase() : null,
          ownershipPercentage: data.ownershipPercentage.toString(),
          distributionPercentage: data.distributionPercentage.toString(),
          taxReserveOverride:
            data.taxReserveOverride != null ? data.taxReserveOverride.toString() : null,
          active: data.active,
        },
      });
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: ownerId ? "UPDATE" : "CREATE",
    entityType: "Owner",
    entityId: record.id,
    after: {
      name: data.name,
      ownershipPercentage: data.ownershipPercentage,
      distributionPercentage: data.distributionPercentage,
    },
  });
  revalidatePath(`/app/${organizationSlug}/settings`);
  revalidatePath(`/app/${organizationSlug}/distributions`);
  return ok({ id: record.id });
}
