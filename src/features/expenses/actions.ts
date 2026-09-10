"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireOrgAccess } from "@/lib/auth/session";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/validation/result";
import { ExpensePaymentMethod } from "@prisma/client";
import { recordActivity, recordAudit } from "@/lib/audit/audit";

const expenseSchema = z.object({
  categoryId: z.string().optional().nullable(),
  vendorName: z.string().max(120).optional().nullable(),
  clientId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  description: z.string().min(1).max(1000),
  amount: z.coerce.number().positive(),
  date: z.string().min(1),
  paymentMethod: z.nativeEnum(ExpensePaymentMethod).default("OTHER"),
  taxDeductible: z.coerce.boolean().default(true),
  reimbursable: z.coerce.boolean().default(false),
  isPersonal: z.coerce.boolean().default(false),
  notes: z.string().max(2000).optional().nullable(),
});

export async function createExpenseAction(
  organizationSlug: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgAccess(organizationSlug, "expenses:write");
  const raw = Object.fromEntries(formData);
  raw.taxDeductible = raw.taxDeductible ? "true" : "false";
  raw.reimbursable = raw.reimbursable ? "true" : "false";
  raw.isPersonal = raw.isPersonal ? "true" : "false";
  const parsed = expenseSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);
  const data = parsed.data;

  // Validate category belongs to org if provided.
  if (data.categoryId) {
    const cat = await prisma.expenseCategory.findFirst({
      where: { id: data.categoryId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!cat) return fail("NOT_FOUND", "Category not found.");
  }
  if (data.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!client) return fail("NOT_FOUND", "Client not found.");
  }
  if (data.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!project) return fail("NOT_FOUND", "Project not found.");
  }

  let vendorId: string | null = null;
  if (data.vendorName && data.vendorName.trim().length > 0) {
    const existing = await prisma.vendor.findFirst({
      where: { organizationId: ctx.organizationId, name: data.vendorName.trim() },
    });
    vendorId = existing
      ? existing.id
      : (
          await prisma.vendor.create({
            data: { organizationId: ctx.organizationId, name: data.vendorName.trim() },
          })
        ).id;
  }

  const created = await prisma.expense.create({
    data: {
      organizationId: ctx.organizationId,
      categoryId: data.categoryId || null,
      vendorId,
      clientId: data.clientId || null,
      projectId: data.projectId || null,
      description: data.description.trim(),
      amount: data.amount.toString(),
      date: new Date(data.date),
      paymentMethod: data.paymentMethod,
      taxDeductible: data.taxDeductible,
      reimbursable: data.reimbursable,
      isPersonal: data.isPersonal,
      notes: data.notes || null,
      createdByUserId: ctx.userId,
    },
  });
  await recordActivity({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "expense.create",
    entityType: "Expense",
    entityId: created.id,
    message: `Expense of ${data.amount.toFixed(2)} recorded`,
  });
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "CREATE",
    entityType: "Expense",
    entityId: created.id,
    after: { amount: data.amount.toString(), description: data.description },
  });
  revalidatePath(`/app/${organizationSlug}/expenses`);
  revalidatePath(`/app/${organizationSlug}/dashboard`);
  return ok({ id: created.id });
}

export async function deleteExpenseAction(
  organizationSlug: string,
  expenseId: string,
): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireOrgAccess(organizationSlug, "expenses:write");
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, organizationId: ctx.organizationId },
  });
  if (!expense) return fail("NOT_FOUND", "Expense not found.");
  await prisma.expense.delete({ where: { id: expenseId } });
  await recordAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    action: "DELETE",
    entityType: "Expense",
    entityId: expenseId,
    before: { amount: expense.amount.toString() },
  });
  revalidatePath(`/app/${organizationSlug}/expenses`);
  return ok({ ok: true });
}
