"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireOrgAccess } from "@/lib/auth/session";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/validation/result";
import { TaxAuthority, TaxPaymentStatus, TaxPlanningMode, FilingStatus } from "@prisma/client";
import { recordActivity, recordAudit } from "@/lib/audit/audit";

// ---------- Tax payments (owner or organization scope) ----------

const taxPaymentSchema = z.object({
  ownerId: z.string().optional().nullable(),
  authority: z.nativeEnum(TaxAuthority).default("IRS"),
  jurisdiction: z.string().max(80).optional().nullable(),
  description: z.string().max(200).optional().nullable(),
  taxYear: z.coerce.number().int().min(1900).max(2999).optional().nullable(),
  taxPeriod: z.string().max(20).optional().nullable(),
  estimatedAmount: z.coerce.number().min(0).optional().nullable(),
  amountPaid: z.coerce.number().min(0).default(0),
  dueDate: z.string().min(1),
  paidDate: z.string().optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function upsertTaxPaymentAction(
  organizationSlug: string,
  formData: FormData,
  id?: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgAccess(organizationSlug, "taxes:write");
  const raw = Object.fromEntries(formData);
  const parsed = taxPaymentSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);
  const data = parsed.data;

  // Verify owner belongs to this org (never trust ownerId from browser).
  let ownerId: string | null = null;
  if (data.ownerId && data.ownerId !== "" && data.ownerId !== "ORG") {
    const owner = await prisma.owner.findFirst({
      where: { id: data.ownerId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!owner) return fail("NOT_FOUND", "Owner not found in this workspace.");
    ownerId = owner.id;
  }

  // Verify the existing record (if editing) belongs to this org.
  if (id) {
    const existing = await prisma.taxPayment.findFirst({
      where: { id, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!existing) return fail("NOT_FOUND", "Tax payment not found.");
  }

  const status: TaxPaymentStatus =
    data.paidDate || (data.amountPaid && data.amountPaid > 0)
      ? "PAID"
      : new Date(data.dueDate) < new Date()
        ? "OVERDUE"
        : "UPCOMING";

  const record = id
    ? await prisma.taxPayment.update({
        where: { id },
        data: {
          ownerId,
          authority: data.authority,
          jurisdiction: data.jurisdiction || null,
          description: data.description || null,
          taxYear: data.taxYear ?? null,
          taxPeriod: data.taxPeriod || null,
          estimatedAmount: data.estimatedAmount != null ? data.estimatedAmount.toString() : null,
          amountPaid: data.amountPaid.toString(),
          dueDate: new Date(data.dueDate),
          paidDate: data.paidDate ? new Date(data.paidDate) : null,
          reference: data.reference || null,
          notes: data.notes || null,
          status,
        },
      })
    : await prisma.taxPayment.create({
        data: {
          organizationId: ctx.organizationId,
          ownerId,
          authority: data.authority,
          jurisdiction: data.jurisdiction || null,
          description: data.description || null,
          taxYear: data.taxYear ?? null,
          taxPeriod: data.taxPeriod || null,
          estimatedAmount: data.estimatedAmount != null ? data.estimatedAmount.toString() : null,
          amountPaid: data.amountPaid.toString(),
          dueDate: new Date(data.dueDate),
          paidDate: data.paidDate ? new Date(data.paidDate) : null,
          reference: data.reference || null,
          notes: data.notes || null,
          status,
        },
      });

  await recordActivity({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: id ? "tax.update" : "tax.create",
    entityType: "TaxPayment",
    entityId: record.id,
    message: id ? "Tax payment updated" : "Tax payment added",
  });
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: id ? "UPDATE" : "CREATE",
    entityType: "TaxPayment",
    entityId: record.id,
    after: { amountPaid: data.amountPaid.toString(), status, ownerId, taxYear: data.taxYear ?? null },
  });
  revalidatePath(`/app/${organizationSlug}/taxes`);
  revalidatePath(`/app/${organizationSlug}/dashboard`);
  return ok({ id: record.id });
}

// ---------- Reserve rate (org-wide default) ----------

const reserveRateSchema = z.object({ reserveRate: z.coerce.number().min(0).max(100) });

export async function updateReserveRateAction(
  organizationSlug: string,
  formData: FormData,
): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireOrgAccess(organizationSlug, "taxes:write");
  const parsed = reserveRateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  await prisma.$transaction([
    prisma.taxProfile.upsert({
      where: { organizationId: ctx.organizationId },
      update: { reserveRate: parsed.data.reserveRate.toString() },
      create: {
        organizationId: ctx.organizationId,
        reserveRate: parsed.data.reserveRate.toString(),
      },
    }),
    prisma.organization.update({
      where: { id: ctx.organizationId },
      data: { defaultTaxReserveRate: parsed.data.reserveRate.toString() },
    }),
  ]);
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "UPDATE",
    entityType: "TaxProfile",
    entityId: ctx.organizationId,
    after: { reserveRate: parsed.data.reserveRate },
  });
  revalidatePath(`/app/${organizationSlug}/taxes`);
  revalidatePath(`/app/${organizationSlug}/dashboard`);
  return ok({ ok: true });
}

// ---------- Manual earmarked-cash balance ----------

const earmarkSchema = z.object({ earmarkedCash: z.coerce.number().min(0) });

export async function updateTaxReserveEarmarkedAction(
  organizationSlug: string,
  formData: FormData,
): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireOrgAccess(organizationSlug, "taxes:write");
  const parsed = earmarkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const before = await prisma.organization.findUnique({
    where: { id: ctx.organizationId },
    select: { taxReserveEarmarked: true },
  });
  await prisma.organization.update({
    where: { id: ctx.organizationId },
    data: { taxReserveEarmarked: parsed.data.earmarkedCash.toString() },
  });
  await recordActivity({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "tax.earmark.update",
    entityType: "Organization",
    entityId: ctx.organizationId,
    message: `Cash earmarked for taxes set to ${parsed.data.earmarkedCash.toFixed(2)}`,
  });
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "UPDATE",
    entityType: "TaxReserveEarmarked",
    entityId: ctx.organizationId,
    before: { taxReserveEarmarked: before?.taxReserveEarmarked?.toString() ?? "0" },
    after: { taxReserveEarmarked: parsed.data.earmarkedCash },
  });
  revalidatePath(`/app/${organizationSlug}/taxes`);
  revalidatePath(`/app/${organizationSlug}/cash`);
  revalidatePath(`/app/${organizationSlug}/dashboard`);
  revalidatePath(`/app/${organizationSlug}/distributions`);
  return ok({ ok: true });
}

// ---------- Planning mode (SIMPLE / ADVANCED) ----------

const modeSchema = z.object({ mode: z.nativeEnum(TaxPlanningMode) });

export async function updatePlanningModeAction(
  organizationSlug: string,
  formData: FormData,
): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireOrgAccess(organizationSlug, "taxes:write");
  const parsed = modeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: ctx.organizationId },
      data: { taxPlanningMode: parsed.data.mode },
    }),
    prisma.taxProfile.upsert({
      where: { organizationId: ctx.organizationId },
      update: { mode: parsed.data.mode },
      create: {
        organizationId: ctx.organizationId,
        mode: parsed.data.mode,
      },
    }),
  ]);
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "UPDATE",
    entityType: "TaxPlanningMode",
    entityId: ctx.organizationId,
    after: { mode: parsed.data.mode },
  });
  revalidatePath(`/app/${organizationSlug}/taxes`);
  revalidatePath(`/app/${organizationSlug}/settings`);
  return ok({ ok: true });
}

// ---------- Owner tax profile ----------

const ownerTaxProfileSchema = z.object({
  taxReserveOverride: z.union([z.coerce.number().min(0).max(100), z.literal("")]).optional().nullable(),
  stateReserveRate: z.union([z.coerce.number().min(0).max(100), z.literal("")]).optional().nullable(),
  residenceState: z.string().max(80).optional().nullable(),
  filingStatus: z.union([z.nativeEnum(FilingStatus), z.literal("")]).optional().nullable(),
});

export async function updateOwnerTaxProfileAction(
  organizationSlug: string,
  ownerId: string,
  formData: FormData,
): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireOrgAccess(organizationSlug, "owners:manage");
  const owner = await prisma.owner.findFirst({
    where: { id: ownerId, organizationId: ctx.organizationId },
  });
  if (!owner) return fail("NOT_FOUND", "Owner not found.");

  const parsed = ownerTaxProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const data = parsed.data;

  const asNumOrNull = (v: number | "" | null | undefined) =>
    v === "" || v == null ? null : Number(v);

  const taxReserveOverride = asNumOrNull(data.taxReserveOverride);
  const stateReserveRate = asNumOrNull(data.stateReserveRate);
  const filingStatus =
    data.filingStatus == null || data.filingStatus === ""
      ? null
      : (data.filingStatus as FilingStatus);

  await prisma.owner.update({
    where: { id: ownerId },
    data: {
      taxReserveOverride: taxReserveOverride == null ? null : taxReserveOverride.toString(),
      stateReserveRate: stateReserveRate == null ? null : stateReserveRate.toString(),
      residenceState: data.residenceState || null,
      filingStatus,
    },
  });
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "UPDATE",
    entityType: "OwnerTaxProfile",
    entityId: ownerId,
    before: {
      taxReserveOverride: owner.taxReserveOverride?.toString() ?? null,
      stateReserveRate: owner.stateReserveRate?.toString() ?? null,
      residenceState: owner.residenceState,
      filingStatus: owner.filingStatus,
    },
    after: {
      taxReserveOverride,
      stateReserveRate,
      residenceState: data.residenceState || null,
      filingStatus,
    },
  });
  revalidatePath(`/app/${organizationSlug}/taxes`);
  revalidatePath(`/app/${organizationSlug}/settings`);
  revalidatePath(`/app/${organizationSlug}/distributions`);
  return ok({ ok: true });
}
