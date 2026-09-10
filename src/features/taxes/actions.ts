"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireOrgAccess } from "@/lib/auth/session";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/validation/result";
import { TaxAuthority, TaxPaymentStatus } from "@prisma/client";
import { recordActivity, recordAudit } from "@/lib/audit/audit";

const taxPaymentSchema = z.object({
  authority: z.nativeEnum(TaxAuthority).default("IRS"),
  jurisdiction: z.string().max(80).optional().nullable(),
  description: z.string().max(200).optional().nullable(),
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
  const parsed = taxPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const data = parsed.data;
  const status: TaxPaymentStatus =
    data.paidDate || (data.amountPaid && data.amountPaid > 0)
      ? "PAID"
      : new Date(data.dueDate) < new Date()
        ? "OVERDUE"
        : "UPCOMING";

  const record = await prisma.taxPayment.upsert({
    where: { id: id ?? "__new__" },
    update: id
      ? {
          authority: data.authority,
          jurisdiction: data.jurisdiction || null,
          description: data.description || null,
          estimatedAmount: data.estimatedAmount != null ? data.estimatedAmount.toString() : null,
          amountPaid: data.amountPaid.toString(),
          dueDate: new Date(data.dueDate),
          paidDate: data.paidDate ? new Date(data.paidDate) : null,
          reference: data.reference || null,
          notes: data.notes || null,
          status,
        }
      : undefined as never,
    create: {
      organizationId: ctx.organizationId,
      authority: data.authority,
      jurisdiction: data.jurisdiction || null,
      description: data.description || null,
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
    after: { amountPaid: data.amountPaid.toString(), status },
  });
  revalidatePath(`/app/${organizationSlug}/taxes`);
  revalidatePath(`/app/${organizationSlug}/dashboard`);
  return ok({ id: record.id });
}

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
