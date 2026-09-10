"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireOrgAccess } from "@/lib/auth/session";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/validation/result";
import { recordActivity } from "@/lib/audit/audit";

const timeEntrySchema = z.object({
  projectId: z.string().min(1),
  date: z.string().min(1),
  description: z.string().max(1000).optional().nullable(),
  hours: z.coerce.number().positive().max(24),
  billable: z.coerce.boolean().default(true),
  hourlyRate: z.coerce.number().min(0).optional().nullable(),
});

export async function createTimeEntryAction(
  organizationSlug: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgAccess(organizationSlug, "time:write");
  const raw = Object.fromEntries(formData);
  // FormData booleans arrive as "on" or missing
  raw.billable = raw.billable ? "true" : "false";
  const parsed = timeEntrySchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);
  const data = parsed.data;
  const project = await prisma.project.findFirst({
    where: { id: data.projectId, organizationId: ctx.organizationId },
    select: { id: true, hourlyRate: true },
  });
  if (!project) return fail("NOT_FOUND", "Project not found.");
  const rate =
    data.hourlyRate != null
      ? data.hourlyRate.toString()
      : project.hourlyRate?.toString() ?? null;
  const created = await prisma.timeEntry.create({
    data: {
      organizationId: ctx.organizationId,
      projectId: data.projectId,
      userId: ctx.userId,
      date: new Date(data.date),
      description: data.description || null,
      hours: data.hours.toString(),
      billable: data.billable,
      hourlyRate: rate,
    },
  });
  await recordActivity({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "time.create",
    entityType: "TimeEntry",
    entityId: created.id,
    message: `Logged ${data.hours} hours`,
  });
  revalidatePath(`/app/${organizationSlug}/time`);
  return ok({ id: created.id });
}
