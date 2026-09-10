import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { PaymentMethod } from "@prisma/client";
import { toDecimal, moneyAdd, moneySubtract, moneyRound } from "@/lib/money/money";
import { recomputeInvoiceStatus } from "./invoice-service";
import { recordActivity, recordAudit } from "@/lib/audit/audit";

export interface RecordPaymentInput {
  organizationId: string;
  actorUserId?: string | null;
  invoiceId?: string | null;
  clientId?: string | null;
  amount: number | string;
  date: Date;
  method: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
}

export async function recordPayment(input: RecordPaymentInput) {
  const amount = toDecimal(input.amount);
  if (amount.lte(0)) {
    throw new Error("Payment amount must be greater than zero.");
  }

  return prisma.$transaction(async (tx) => {
    let invoice = null as
      | Awaited<ReturnType<typeof tx.invoice.findFirst>>
      | null;

    if (input.invoiceId) {
      invoice = await tx.invoice.findFirst({
        where: { id: input.invoiceId, organizationId: input.organizationId },
      });
      if (!invoice) throw new Error("Invoice not found in this organization.");
      if (invoice.status === "VOID") throw new Error("Cannot pay a voided invoice.");
      const newPaid = moneyAdd(invoice.amountPaid, amount);
      if (newPaid.gt(toDecimal(invoice.total).plus(0.01))) {
        throw new Error(
          `Payment exceeds invoice balance. Balance due: ${invoice.balanceDue}`,
        );
      }
    }

    const payment = await tx.payment.create({
      data: {
        organizationId: input.organizationId,
        invoiceId: input.invoiceId ?? null,
        clientId:
          input.clientId ?? (invoice ? invoice.clientId : null),
        amount: amount.toString(),
        date: input.date,
        method: input.method,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        createdByUserId: input.actorUserId ?? null,
      },
    });

    if (invoice) {
      const newPaid = moneyRound(moneyAdd(invoice.amountPaid, amount));
      const newBalance = moneyRound(moneySubtract(invoice.total, newPaid));
      const newStatus = recomputeInvoiceStatus(
        invoice.total,
        newPaid,
        invoice.dueDate,
        invoice.status,
      );
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newPaid.toString(),
          balanceDue: newBalance.toString(),
          status: newStatus,
          paidAt: newStatus === "PAID" ? new Date() : invoice.paidAt,
        },
      });
    }

    await recordActivity(
      {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "payment.create",
        entityType: "Payment",
        entityId: payment.id,
        message: `Payment of ${amount.toFixed(2)} recorded${invoice ? ` for ${invoice.invoiceNumber}` : ""}`,
      },
      tx,
    );
    await recordAudit(
      {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "CREATE",
        entityType: "Payment",
        entityId: payment.id,
        after: { amount: amount.toString(), invoiceId: input.invoiceId ?? null },
      },
      tx,
    );

    return payment;
  });
}

export async function reversePayment(
  organizationId: string,
  paymentId: string,
  actorUserId?: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, organizationId },
    });
    if (!payment) throw new Error("Payment not found");

    if (payment.invoiceId) {
      const invoice = await tx.invoice.findFirstOrThrow({
        where: { id: payment.invoiceId, organizationId },
      });
      const newPaid = moneyRound(moneySubtract(invoice.amountPaid, payment.amount));
      const newBalance = moneyRound(moneySubtract(invoice.total, newPaid));
      const newStatus = recomputeInvoiceStatus(
        invoice.total,
        newPaid,
        invoice.dueDate,
        invoice.status === "PAID" ? "SENT" : invoice.status,
      );
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newPaid.toString(),
          balanceDue: newBalance.toString(),
          status: newStatus,
          paidAt: newStatus === "PAID" ? invoice.paidAt : null,
        },
      });
    }
    await tx.payment.delete({ where: { id: paymentId } });
    await recordActivity(
      {
        organizationId,
        actorUserId,
        action: "payment.reverse",
        entityType: "Payment",
        entityId: paymentId,
        message: `Payment of ${payment.amount} reversed`,
      },
      tx,
    );
    await recordAudit(
      {
        organizationId,
        actorUserId,
        action: "DELETE",
        entityType: "Payment",
        entityId: paymentId,
        before: { amount: payment.amount.toString(), invoiceId: payment.invoiceId },
      },
      tx,
    );
  });
}
