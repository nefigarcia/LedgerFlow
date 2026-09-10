"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireOrgAccess } from "@/lib/auth/session";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/validation/result";
import { BillingMethod, ProjectStatus } from "@prisma/client";
import { recordActivity, recordAudit } from "@/lib/audit/audit";

const projectSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  status: z.nativeEnum(ProjectStatus).default("ACTIVE"),
  billingMethod: z.nativeEnum(BillingMethod).default("HOURLY"),
  hourlyRate: z.coerce.number().min(0).optional().nullable(),
  fixedFee: z.coerce.number().min(0).optional().nullable(),
  retainerAmount: z.coerce.number().min(0).optional().nullable(),
  budget: z.coerce.number().min(0).optional().nullable(),
  estimatedHours: z.coerce.number().min(0).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

function toDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

export async function createProjectAction(
  organizationSlug: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgAccess(organizationSlug, "projects:write");
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const data = parsed.data;
  const client = await prisma.client.findFirst({
    where: { id: data.clientId, organizationId: ctx.organizationId },
  });
  if (!client) return fail("NOT_FOUND", "Client not found in this workspace.");
  const created = await prisma.project.create({
    data: {
      organizationId: ctx.organizationId,
      clientId: data.clientId,
      name: data.name.trim(),
      description: data.description || null,
      status: data.status,
      billingMethod: data.billingMethod,
      hourlyRate: data.hourlyRate != null ? data.hourlyRate.toString() : null,
      fixedFee: data.fixedFee != null ? data.fixedFee.toString() : null,
      retainerAmount: data.retainerAmount != null ? data.retainerAmount.toString() : null,
      budget: data.budget != null ? data.budget.toString() : null,
      estimatedHours: data.estimatedHours != null ? data.estimatedHours.toString() : null,
      startDate: toDate(data.startDate),
      endDate: toDate(data.endDate),
    },
  });
  await recordActivity({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "project.create",
    entityType: "Project",
    entityId: created.id,
    message: `Project ${created.name} created`,
  });
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "CREATE",
    entityType: "Project",
    entityId: created.id,
    after: { name: created.name },
  });
  revalidatePath(`/app/${organizationSlug}/projects`);
  return ok({ id: created.id });
}
