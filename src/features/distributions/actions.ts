"use server";
import { parseDateOnly } from "@/lib/dates/dates";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireOrgAccess } from "@/lib/auth/session";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/validation/result";
import { recordActivity, recordAudit } from "@/lib/audit/audit";
import { getAvailableToDistribute } from "@/services/financial-metrics";
import { moneyRound, toDecimal, toNumber } from "@/lib/money/money";

const distributionSchema = z.object({
  ownerId: z.string().min(1),
  date: z.string().min(1),
  amount: z.coerce.number().positive(),
  memo: z.string().max(300).optional().nullable(),
  method: z.string().max(50).optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
  /// Set by the UI after the user confirms the "exceeds safe" warning.
  confirmOverSafe: z.union([z.coerce.boolean(), z.literal("true"), z.literal("on")]).optional(),
});

/**
 * Distribution outcomes:
 *  - success: distribution recorded
 *  - OVER_SAFE_CONFIRMATION_REQUIRED: amount exceeds current safe-to-distribute;
 *    front-end shows confirmation dialog with reserved-cash context and can
 *    re-submit with confirmOverSafe=true to proceed.
 */
export type DistributionResult =
  | { success: true; data: { id: string } }
  | {
      success: false;
      error: {
        code: "OVER_SAFE_CONFIRMATION_REQUIRED";
        message: string;
        overSafe: { safeAvailable: number; attempted: number; wouldExceedBy: number };
      };
    }
  | { success: false; error: { code: string; message: string; fieldErrors?: Record<string, string[]> } };

export async function recordDistributionAction(
  organizationSlug: string,
  formData: FormData,
): Promise<DistributionResult> {
  const ctx = await requireOrgAccess(organizationSlug, "distributions:write");
  const raw = Object.fromEntries(formData);
  const parsed = distributionSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);
  const data = parsed.data;

  const owner = await prisma.owner.findFirst({
    where: { id: data.ownerId, organizationId: ctx.organizationId },
  });
  if (!owner) return fail("NOT_FOUND", "Owner not found.");

  // Safety guard: warn (but don't silently block) if the amount exceeds
  // LedgerFlow's currently-calculated safe-to-distribute figure. Admins
  // can proceed by setting confirmOverSafe. Legitimate accounting
  // corrections must be possible.
  if (!data.confirmOverSafe) {
    const available = await getAvailableToDistribute({ organizationId: ctx.organizationId });
    const attempted = toDecimal(data.amount);
    const safe = toDecimal(available.available);
    if (attempted.gt(safe.plus("0.01"))) {
      return {
        success: false,
        error: {
          code: "OVER_SAFE_CONFIRMATION_REQUIRED",
          message: `This distribution (${attempted.toFixed(2)}) exceeds LedgerFlow's currently calculated safe-to-distribute amount (${moneyRound(safe).toFixed(2)}). It may use cash reserved for taxes or operations.`,
          overSafe: {
            safeAvailable: toNumber(safe),
            attempted: toNumber(attempted),
            wouldExceedBy: toNumber(attempted.minus(safe)),
          },
        },
      };
    }
  }

  const created = await prisma.distribution.create({
    data: {
      organizationId: ctx.organizationId,
      ownerId: data.ownerId,
      date: parseDateOnly(data.date),
      amount: data.amount.toString(),
      memo: data.memo || null,
      method: data.method || null,
      reference: data.reference || null,
      createdByUserId: ctx.userId,
    },
  });
  await recordActivity({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "distribution.create",
    entityType: "Distribution",
    entityId: created.id,
    message: `Distribution of ${data.amount.toFixed(2)} to ${owner.name}${data.confirmOverSafe ? " (over-safe confirmed)" : ""}`,
  });
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "CREATE",
    entityType: "Distribution",
    entityId: created.id,
    after: {
      amount: data.amount.toString(),
      ownerId: data.ownerId,
      overSafeConfirmed: Boolean(data.confirmOverSafe),
    },
  });
  revalidateDistributionPaths(organizationSlug);
  return ok({ id: created.id });
}

export async function updateDistributionAction(
  organizationSlug: string,
  distributionId: string,
  formData: FormData,
): Promise<DistributionResult> {
  const ctx = await requireOrgAccess(organizationSlug, "distributions:write");
  const raw = Object.fromEntries(formData);
  const parsed = distributionSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);
  const data = parsed.data;

  const existing = await prisma.distribution.findFirst({
    where: { id: distributionId, organizationId: ctx.organizationId },
    include: { owner: { select: { name: true } } },
  });
  if (!existing) return fail("NOT_FOUND", "Distribution not found.");

  const owner = await prisma.owner.findFirst({
    where: { id: data.ownerId, organizationId: ctx.organizationId },
  });
  if (!owner) return fail("NOT_FOUND", "Owner not found.");

  // Same safety guard as create, but the existing amount is already out of
  // recorded cash, so add it back before comparing. Only increases can trip it.
  if (!data.confirmOverSafe) {
    const available = await getAvailableToDistribute({ organizationId: ctx.organizationId });
    const attempted = toDecimal(data.amount);
    const safe = toDecimal(available.available).plus(toDecimal(existing.amount));
    if (attempted.gt(safe.plus("0.01"))) {
      return {
        success: false,
        error: {
          code: "OVER_SAFE_CONFIRMATION_REQUIRED",
          message: `This distribution (${attempted.toFixed(2)}) exceeds LedgerFlow's currently calculated safe-to-distribute amount (${moneyRound(safe).toFixed(2)}). It may use cash reserved for taxes or operations.`,
          overSafe: {
            safeAvailable: toNumber(safe),
            attempted: toNumber(attempted),
            wouldExceedBy: toNumber(attempted.minus(safe)),
          },
        },
      };
    }
  }

  await prisma.distribution.update({
    where: { id: distributionId },
    data: {
      ownerId: data.ownerId,
      date: parseDateOnly(data.date),
      amount: data.amount.toString(),
      memo: data.memo || null,
      method: data.method || null,
      reference: data.reference || null,
    },
  });
  await recordActivity({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "distribution.update",
    entityType: "Distribution",
    entityId: distributionId,
    message: `Distribution updated: ${toDecimal(existing.amount).toFixed(2)} to ${existing.owner.name} → ${data.amount.toFixed(2)} to ${owner.name}${data.confirmOverSafe ? " (over-safe confirmed)" : ""}`,
  });
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "UPDATE",
    entityType: "Distribution",
    entityId: distributionId,
    before: {
      amount: existing.amount.toString(),
      ownerId: existing.ownerId,
      date: existing.date.toISOString(),
    },
    after: {
      amount: data.amount.toString(),
      ownerId: data.ownerId,
      date: parseDateOnly(data.date).toISOString(),
      overSafeConfirmed: Boolean(data.confirmOverSafe),
    },
  });
  revalidateDistributionPaths(organizationSlug);
  return ok({ id: distributionId });
}

export async function deleteDistributionAction(
  organizationSlug: string,
  distributionId: string,
): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireOrgAccess(organizationSlug, "distributions:write");
  const existing = await prisma.distribution.findFirst({
    where: { id: distributionId, organizationId: ctx.organizationId },
    include: { owner: { select: { name: true } } },
  });
  if (!existing) return fail("NOT_FOUND", "Distribution not found.");
  await prisma.distribution.delete({ where: { id: distributionId } });
  await recordActivity({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "distribution.delete",
    entityType: "Distribution",
    entityId: distributionId,
    message: `Distribution of ${toDecimal(existing.amount).toFixed(2)} to ${existing.owner.name} deleted`,
  });
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "DELETE",
    entityType: "Distribution",
    entityId: distributionId,
    before: {
      amount: existing.amount.toString(),
      ownerId: existing.ownerId,
      date: existing.date.toISOString(),
    },
  });
  revalidateDistributionPaths(organizationSlug);
  return ok({ ok: true });
}

function revalidateDistributionPaths(organizationSlug: string) {
  revalidatePath(`/app/${organizationSlug}/distributions`);
  revalidatePath(`/app/${organizationSlug}/dashboard`);
  revalidatePath(`/app/${organizationSlug}/cash`);
}
