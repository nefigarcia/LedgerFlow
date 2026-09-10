"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrgAccess } from "@/lib/auth/session";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/validation/result";
import { PaymentMethod } from "@prisma/client";
import { recordPayment, reversePayment } from "@/services/payment-service";

const paymentSchema = z.object({
  invoiceId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  amount: z.coerce.number().positive(),
  date: z.string().min(1),
  method: z.nativeEnum(PaymentMethod).default("OTHER"),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function recordPaymentAction(
  organizationSlug: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrgAccess(organizationSlug, "payments:write");
  const raw = Object.fromEntries(formData);
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);
  const data = parsed.data;
  try {
    const payment = await recordPayment({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      invoiceId: data.invoiceId || null,
      clientId: data.clientId || null,
      amount: data.amount,
      date: new Date(data.date),
      method: data.method,
      reference: data.reference,
      notes: data.notes,
    });
    revalidatePath(`/app/${organizationSlug}/payments`);
    revalidatePath(`/app/${organizationSlug}/invoices`);
    revalidatePath(`/app/${organizationSlug}/dashboard`);
    return ok({ id: payment.id });
  } catch (err) {
    return fail("PAYMENT_ERROR", (err as Error).message);
  }
}

export async function reversePaymentAction(
  organizationSlug: string,
  paymentId: string,
): Promise<ActionResult<{ ok: true }>> {
  const ctx = await requireOrgAccess(organizationSlug, "payments:write");
  try {
    await reversePayment(ctx.organizationId, paymentId, ctx.userId);
    revalidatePath(`/app/${organizationSlug}/payments`);
    revalidatePath(`/app/${organizationSlug}/invoices`);
    return ok({ ok: true });
  } catch (err) {
    return fail("PAYMENT_ERROR", (err as Error).message);
  }
}
