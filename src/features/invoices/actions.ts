"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrgAccess } from "@/lib/auth/session";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/validation/result";
import { InvoiceItemUnit } from "@prisma/client";
import { parseDateOnly } from "@/lib/dates/dates";
import { toUserMessage } from "@/lib/errors";
import {
  createInvoice,
  deleteDraftInvoice,
  duplicateInvoice,
  markInvoiceSent,
  updateDraftInvoice,
  voidInvoice,
} from "@/services/invoice-service";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

const itemSchema = z.object({
  id: z.string().max(64).optional().nullable(),
  description: z.string().trim().min(1, "Each line item needs a description").max(2000),
  quantity: z.coerce.number().min(0).max(1_000_000),
  unit: z.nativeEnum(InvoiceItemUnit).default("HOURS"),
  rate: z.coerce.number().min(0).max(100_000_000),
  projectId: z.string().optional().nullable(),
});

const invoiceSchema = z
  .object({
    clientId: z.string().min(1, "Choose a client"),
    projectId: z.string().optional().nullable(),
    issueDate: dateOnly,
    dueDate: dateOnly.optional().nullable(),
    poNumber: z.string().max(50).optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
    terms: z.string().max(2000).optional().nullable(),
    paymentInstructions: z.string().max(2000).optional().nullable(),
    discount: z.coerce.number().min(0).default(0),
    taxRate: z.coerce.number().min(0).max(100).default(0),
    items: z.array(itemSchema).min(1, "Add at least one line item").max(200),
  })
  .refine((v) => !v.dueDate || v.dueDate >= v.issueDate, {
    message: "Due date can't be before the issue date",
    path: ["dueDate"],
  });

function toServiceInput(p: z.infer<typeof invoiceSchema>) {
  return {
    clientId: p.clientId,
    projectId: p.projectId || null,
    issueDate: parseDateOnly(p.issueDate),
    dueDate: p.dueDate ? parseDateOnly(p.dueDate) : null,
    poNumber: p.poNumber || null,
    notes: p.notes || null,
    terms: p.terms || null,
    paymentInstructions: p.paymentInstructions || null,
    discount: p.discount,
    taxRate: p.taxRate,
    items: p.items,
  };
}

export async function createInvoiceAction(
  organizationSlug: string,
  payload: unknown,
): Promise<ActionResult<{ id: string; invoiceNumber: string }>> {
  const ctx = await requireOrgAccess(organizationSlug, "invoices:write");
  const parsed = invoiceSchema.safeParse(payload);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const invoice = await createInvoice({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      ...toServiceInput(parsed.data),
    });
    revalidatePath(`/app/${organizationSlug}/invoices`);
    return ok({ id: invoice.id, invoiceNumber: invoice.invoiceNumber });
  } catch (err) {
    return fail("INVOICE_ERROR", toUserMessage(err, "Could not create the invoice."));
  }
}

export async function updateDraftInvoiceAction(
  organizationSlug: string,
  invoiceId: string,
  payload: unknown,
): Promise<ActionResult<{ id: string; invoiceNumber: string }>> {
  const ctx = await requireOrgAccess(organizationSlug, "invoices:write");
  const parsed = invoiceSchema.safeParse(payload);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const invoice = await updateDraftInvoice({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      invoiceId,
      ...toServiceInput(parsed.data),
    });
    revalidatePath(`/app/${organizationSlug}/invoices`);
    revalidatePath(`/app/${organizationSlug}/invoices/${invoiceId}`);
    return ok({ id: invoice.id, invoiceNumber: invoice.invoiceNumber });
  } catch (err) {
    return fail("INVOICE_ERROR", toUserMessage(err, "Could not save the invoice."));
  }
}

export async function duplicateInvoiceAction(
  organizationSlug: string,
  invoiceId: string,
): Promise<ActionResult<{ id: string; invoiceNumber: string }>> {
  const ctx = await requireOrgAccess(organizationSlug, "invoices:write");
  try {
    const invoice = await duplicateInvoice(ctx.organizationId, invoiceId, ctx.userId);
    revalidatePath(`/app/${organizationSlug}/invoices`);
    return ok({ id: invoice.id, invoiceNumber: invoice.invoiceNumber });
  } catch (err) {
    return fail("INVOICE_ERROR", toUserMessage(err, "Could not duplicate the invoice."));
  }
}

export async function markInvoiceSentAction(
  organizationSlug: string,
  invoiceId: string,
): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireOrgAccess(organizationSlug, "invoices:send");
  try {
    await markInvoiceSent(ctx.organizationId, invoiceId, ctx.userId);
    revalidatePath(`/app/${organizationSlug}/invoices`);
    revalidatePath(`/app/${organizationSlug}/invoices/${invoiceId}`);
    return ok({ ok: true });
  } catch (err) {
    return fail("INVOICE_ERROR", toUserMessage(err));
  }
}

export async function voidInvoiceAction(
  organizationSlug: string,
  invoiceId: string,
): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireOrgAccess(organizationSlug, "invoices:write");
  try {
    await voidInvoice(ctx.organizationId, invoiceId, ctx.userId);
    revalidatePath(`/app/${organizationSlug}/invoices`);
    revalidatePath(`/app/${organizationSlug}/invoices/${invoiceId}`);
    return ok({ ok: true });
  } catch (err) {
    return fail("INVOICE_ERROR", toUserMessage(err));
  }
}

export async function deleteDraftInvoiceAction(
  organizationSlug: string,
  invoiceId: string,
): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireOrgAccess(organizationSlug, "invoices:write");
  try {
    await deleteDraftInvoice(ctx.organizationId, invoiceId, ctx.userId);
    revalidatePath(`/app/${organizationSlug}/invoices`);
    return ok({ ok: true });
  } catch (err) {
    return fail("INVOICE_ERROR", toUserMessage(err));
  }
}
