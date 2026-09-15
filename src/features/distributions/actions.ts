"use server";
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
      date: new Date(data.date),
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
  revalidatePath(`/app/${organizationSlug}/distributions`);
  revalidatePath(`/app/${organizationSlug}/dashboard`);
  revalidatePath(`/app/${organizationSlug}/cash`);
  return ok({ id: created.id });
}
