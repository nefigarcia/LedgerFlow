"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrgAccess } from "@/lib/auth/session";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/validation/result";
import { InvoiceItemUnit } from "@prisma/client";
import {
  createInvoice,
  deleteDraftInvoice,
  markInvoiceSent,
  voidInvoice,
} from "@/services/invoice-service";

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().min(0),
  unit: z.nativeEnum(InvoiceItemUnit).default("HOURS"),
  rate: z.coerce.number().min(0),
  projectId: z.string().optional().nullable(),
});

const invoiceSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  issueDate: z.string().min(1),
  dueDate: z.string().optional().nullable(),
  poNumber: z.string().max(50).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  terms: z.string().max(2000).optional().nullable(),
  discount: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  items: z.array(itemSchema).min(1),
});

export async function createInvoiceAction(
  organizationSlug: string,
  payload: unknown,
): Promise<ActionResult<{ id: string; invoiceNumber: string }>> {
  const ctx = await requireOrgAccess(organizationSlug, "invoices:write");
  const parsed = invoiceSchema.safeParse(payload);
  if (!parsed.success) return fromZodError(parsed.error);
  const p = parsed.data;
  try {
    const invoice = await createInvoice({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      clientId: p.clientId,
      projectId: p.projectId ?? null,
      issueDate: new Date(p.issueDate),
      dueDate: p.dueDate ? new Date(p.dueDate) : null,
      poNumber: p.poNumber ?? null,
      notes: p.notes ?? null,
      terms: p.terms ?? null,
      discount: p.discount,
      taxRate: p.taxRate,
      items: p.items,
    });
    revalidatePath(`/app/${organizationSlug}/invoices`);
    return ok({ id: invoice.id, invoiceNumber: invoice.invoiceNumber });
  } catch (err) {
    return fail("INVOICE_ERROR", (err as Error).message);
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
    return fail("INVOICE_ERROR", (err as Error).message);
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
    return ok({ ok: true });
  } catch (err) {
    return fail("INVOICE_ERROR", (err as Error).message);
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
    return fail("INVOICE_ERROR", (err as Error).message);
  }
}
