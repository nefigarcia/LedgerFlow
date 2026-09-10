"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireOrgAccess } from "@/lib/auth/session";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/validation/result";
import { recordActivity, recordAudit } from "@/lib/audit/audit";

const distributionSchema = z.object({
  ownerId: z.string().min(1),
  date: z.string().min(1),
  amount: z.coerce.number().positive(),
  memo: z.string().max(300).optional().nullable(),
  method: z.string().max(50).optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
});

export async function recordDistributionAction(
  organizationSlug: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgAccess(organizationSlug, "distributions:write");
  const parsed = distributionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const data = parsed.data;
  const owner = await prisma.owner.findFirst({
    where: { id: data.ownerId, organizationId: ctx.organizationId },
  });
  if (!owner) return fail("NOT_FOUND", "Owner not found.");
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
    message: `Distribution of ${data.amount.toFixed(2)} to ${owner.name}`,
  });
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "CREATE",
    entityType: "Distribution",
    entityId: created.id,
    after: { amount: data.amount.toString(), ownerId: data.ownerId },
  });
  revalidatePath(`/app/${organizationSlug}/distributions`);
  revalidatePath(`/app/${organizationSlug}/dashboard`);
  return ok({ id: created.id });
}
