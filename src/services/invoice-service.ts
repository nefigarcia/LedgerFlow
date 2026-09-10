import "server-only";
import { prisma } from "@/lib/db/prisma";
import { Decimal } from "decimal.js";
import { addDays } from "date-fns";
import type { InvoiceItemUnit, Prisma } from "@prisma/client";
import { toDecimal, moneyAdd, moneyRound, moneySubtract } from "@/lib/money/money";
import { reserveInvoiceNumber } from "./invoice-numbering";
import { recordActivity, recordAudit } from "@/lib/audit/audit";
import { computeInvoiceTotals, computeItemAmount, recomputeInvoiceStatus } from "./invoice-calc";

export { computeInvoiceTotals, computeItemAmount, recomputeInvoiceStatus };

export interface InvoiceItemInput {
  description: string;
  quantity: number | string;
  unit: InvoiceItemUnit;
  rate: number | string;
  projectId?: string | null;
  timeEntryIds?: string[];
}

export interface CreateInvoiceInput {
  organizationId: string;
  actorUserId?: string | null;
  clientId: string;
  projectId?: string | null;
  issueDate: Date;
  dueDate?: Date | null;
  poNumber?: string | null;
  notes?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
  discount?: number | string;
  taxRate?: number | string;
  currency?: string;
  items: InvoiceItemInput[];
}

export async function createInvoice(input: CreateInvoiceInput) {
  if (input.items.length === 0) {
    throw new Error("Invoice must contain at least one line item.");
  }
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { defaultPaymentTermsDays: true, currency: true },
  });
  // Verify client belongs to organization (prevent cross-tenant access).
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, organizationId: input.organizationId },
    select: { id: true },
  });
  if (!client) throw new Error("Client not found in this organization");

  const items = input.items.map((i, idx) => ({
    description: i.description,
    quantity: toDecimal(i.quantity),
    unit: i.unit,
    rate: toDecimal(i.rate),
    amount: computeItemAmount(i.quantity, i.rate),
    projectId: i.projectId ?? null,
    sortOrder: idx,
    timeEntryIds: i.timeEntryIds ?? [],
  }));

  // Reject negative quantities unless explicitly used as a credit
  // (MVP: block outright).
  for (const it of items) {
    if (it.quantity.lt(0)) throw new Error("Invoice quantities must be non-negative.");
    if (it.rate.lt(0)) throw new Error("Invoice rates must be non-negative.");
  }

  const totals = computeInvoiceTotals(
    items.map((i) => ({ amount: i.amount })),
    input.discount ?? 0,
    input.taxRate ?? 0,
  );

  const dueDate = input.dueDate ?? addDays(input.issueDate, org.defaultPaymentTermsDays);

  return prisma.$transaction(async (tx) => {
    const invoiceNumber = await reserveInvoiceNumber(input.organizationId, tx);
    const invoice = await tx.invoice.create({
      data: {
        organizationId: input.organizationId,
        clientId: input.clientId,
        projectId: input.projectId ?? null,
        invoiceNumber,
        status: "DRAFT",
        issueDate: input.issueDate,
        dueDate,
        currency: input.currency ?? org.currency,
        poNumber: input.poNumber ?? null,
        notes: input.notes ?? null,
        terms: input.terms ?? null,
        paymentInstructions: input.paymentInstructions ?? null,
        subtotal: totals.subtotal.toString(),
        discount: totals.discount.toString(),
        taxRate: toDecimal(input.taxRate ?? 0).toString(),
        taxAmount: totals.taxAmount.toString(),
        total: totals.total.toString(),
        amountPaid: "0",
        balanceDue: totals.total.toString(),
        createdByUserId: input.actorUserId ?? null,
      },
    });
    for (const item of items) {
      const created = await tx.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          projectId: item.projectId,
          description: item.description,
          quantity: item.quantity.toString(),
          unit: item.unit,
          rate: item.rate.toString(),
          amount: item.amount.toString(),
          sortOrder: item.sortOrder,
        },
      });
      if (item.timeEntryIds.length > 0) {
        // Validate time entries belong to same organization and are unbilled.
        const entries = await tx.timeEntry.findMany({
          where: {
            id: { in: item.timeEntryIds },
            organizationId: input.organizationId,
            invoiceItemId: null,
          },
          select: { id: true },
        });
        if (entries.length !== item.timeEntryIds.length) {
          throw new Error("One or more time entries are invalid or already billed.");
        }
        await tx.timeEntry.updateMany({
          where: { id: { in: entries.map((e) => e.id) } },
          data: { invoiceItemId: created.id },
        });
      }
    }
    await recordActivity(
      {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "invoice.create",
        entityType: "Invoice",
        entityId: invoice.id,
        message: `Invoice ${invoice.invoiceNumber} created (${invoice.total})`,
      },
      tx,
    );
    await recordAudit(
      {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "CREATE",
        entityType: "Invoice",
        entityId: invoice.id,
        after: { invoiceNumber, total: totals.total.toString() },
      },
      tx,
    );
    return invoice;
  });
}

export async function markInvoiceSent(
  organizationId: string,
  invoiceId: string,
  actorUserId?: string | null,
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "PAID" || invoice.status === "VOID") return invoice;
  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: invoice.amountPaid.gt(0) ? "PARTIALLY_PAID" : "SENT",
      sentAt: invoice.sentAt ?? new Date(),
    },
  });
  await recordActivity({
    organizationId,
    actorUserId,
    action: "invoice.send",
    entityType: "Invoice",
    entityId: invoiceId,
    message: `Invoice ${invoice.invoiceNumber} marked sent`,
  });
  return updated;
}

export async function voidInvoice(
  organizationId: string,
  invoiceId: string,
  actorUserId?: string | null,
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    include: { payments: true },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.payments.length > 0) {
    throw new Error("Cannot void an invoice with payments. Reverse the payments first.");
  }
  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "VOID",
      voidedAt: new Date(),
      balanceDue: "0",
    },
  });
  await recordActivity({
    organizationId,
    actorUserId,
    action: "invoice.void",
    entityType: "Invoice",
    entityId: invoiceId,
    message: `Invoice ${invoice.invoiceNumber} voided`,
  });
  await recordAudit({
    organizationId,
    actorUserId,
    action: "VOID",
    entityType: "Invoice",
    entityId: invoiceId,
    before: { status: invoice.status },
    after: { status: "VOID" },
  });
  return updated;
}

export async function deleteDraftInvoice(
  organizationId: string,
  invoiceId: string,
  actorUserId?: string | null,
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== "DRAFT") {
    throw new Error("Only draft invoices may be deleted. Void this invoice instead.");
  }
  await prisma.$transaction(async (tx) => {
    // Unlink time entries from soon-deleted items.
    const items = await tx.invoiceItem.findMany({ where: { invoiceId } });
    if (items.length > 0) {
      await tx.timeEntry.updateMany({
        where: { invoiceItemId: { in: items.map((i) => i.id) } },
        data: { invoiceItemId: null },
      });
    }
    await tx.invoice.delete({ where: { id: invoiceId } });
    await recordAudit(
      {
        organizationId,
        actorUserId,
        action: "DELETE",
        entityType: "Invoice",
        entityId: invoiceId,
        before: { invoiceNumber: invoice.invoiceNumber, status: invoice.status },
      },
      tx,
    );
  });
}

