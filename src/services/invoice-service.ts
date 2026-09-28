import "server-only";
import { prisma } from "@/lib/db/prisma";
import { addDays } from "date-fns";
import type { InvoiceItemUnit, Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/money/money";
import { AppError } from "@/lib/errors";
import { reserveInvoiceNumber } from "./invoice-numbering";
import { recordActivity, recordAudit } from "@/lib/audit/audit";
import {
  computeInvoiceTotals,
  computeItemAmount,
  planInvoiceItemChanges,
  recomputeInvoiceStatus,
} from "./invoice-calc";

export { computeInvoiceTotals, computeItemAmount, recomputeInvoiceStatus };

export interface InvoiceItemInput {
  /** Present when editing an existing line item on a draft. */
  id?: string | null;
  description: string;
  quantity: number | string;
  unit: InvoiceItemUnit;
  rate: number | string;
  projectId?: string | null;
  timeEntryIds?: string[];
}

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Tenant isolation for invoice references: the client and every referenced
 * project must belong to the organization. Never trust ids from the browser.
 */
async function assertInvoiceRefsBelongToOrg(
  db: Db,
  organizationId: string,
  clientId: string,
  projectIds: (string | null | undefined)[],
) {
  const client = await db.client.findFirst({
    where: { id: clientId, organizationId },
    select: { id: true },
  });
  if (!client) throw new AppError("NOT_FOUND", "Client not found in this workspace.");

  const unique = Array.from(new Set(projectIds.filter((p): p is string => Boolean(p))));
  if (unique.length > 0) {
    const count = await db.project.count({ where: { id: { in: unique }, organizationId } });
    if (count !== unique.length) throw new AppError("NOT_FOUND", "Project not found in this workspace.");
  }
}

function normalizeItems(items: InvoiceItemInput[]) {
  if (items.length === 0) throw new AppError("VALIDATION_ERROR", "Invoice must contain at least one line item.");
  return items.map((i) => {
    const quantity = toDecimal(i.quantity);
    const rate = toDecimal(i.rate);
    if (quantity.lt(0)) throw new AppError("VALIDATION_ERROR", "Invoice quantities must be non-negative.");
    if (rate.lt(0)) throw new AppError("VALIDATION_ERROR", "Invoice rates must be non-negative.");
    return {
      id: i.id ?? null,
      description: i.description.trim(),
      quantity,
      unit: i.unit,
      rate,
      amount: computeItemAmount(quantity, rate),
      projectId: i.projectId || null,
      timeEntryIds: i.timeEntryIds ?? [],
    };
  });
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
  const items = normalizeItems(input.items).map((i, sortOrder) => ({ ...i, sortOrder }));
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: {
      defaultPaymentTermsDays: true,
      currency: true,
      invoicePaymentInstructions: true,
      invoiceDefaultNotes: true,
      invoiceDefaultTerms: true,
    },
  });
  await assertInvoiceRefsBelongToOrg(prisma, input.organizationId, input.clientId, [
    input.projectId,
    ...items.map((i) => i.projectId),
  ]);

  const totals = computeInvoiceTotals(
    items.map((i) => ({ amount: i.amount })),
    input.discount ?? 0,
    input.taxRate ?? 0,
  );

  const dueDate = input.dueDate ?? addDays(input.issueDate, org.defaultPaymentTermsDays);
  // `undefined` = caller didn't specify → use the workspace default.
  // `null` / "" = caller explicitly left it blank.
  input = {
    ...input,
    notes: input.notes === undefined ? org.invoiceDefaultNotes : input.notes,
    terms: input.terms === undefined ? org.invoiceDefaultTerms : input.terms,
    paymentInstructions:
      input.paymentInstructions === undefined ? org.invoicePaymentInstructions : input.paymentInstructions,
  };

  return prisma.$transaction(async (tx) => {
    const invoiceNumber = await reserveInvoiceNumber(input.organizationId, tx, input.issueDate);
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


export interface UpdateDraftInvoiceInput extends Omit<CreateInvoiceInput, "currency"> {
  invoiceId: string;
}

/**
 * Edit a DRAFT invoice: header fields, line items (add / change / remove),
 * discount and sales tax. Totals are recomputed server-side.
 *
 * Existing line items are updated in place so linked time entries stay
 * attached; removed items release their time entries back to "unbilled".
 * Sent, paid, or void invoices are financial records and can't be edited.
 */
export async function updateDraftInvoice(input: UpdateDraftInvoiceInput) {
  const items = normalizeItems(input.items);

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: input.invoiceId, organizationId: input.organizationId },
      include: { items: { select: { id: true } }, _count: { select: { payments: true } } },
    });
    if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found.");
    if (invoice.status !== "DRAFT" || invoice._count.payments > 0) {
      throw new AppError("INVOICE_LOCKED", "Only draft invoices can be edited. Void it and create a new one instead.");
    }

    await assertInvoiceRefsBelongToOrg(tx, input.organizationId, input.clientId, [
      input.projectId,
      ...items.map((i) => i.projectId),
    ]);

    const plan = planInvoiceItemChanges(invoice.items.map((i) => i.id), items);

    if (plan.deleteIds.length > 0) {
      await tx.timeEntry.updateMany({
        where: { organizationId: input.organizationId, invoiceItemId: { in: plan.deleteIds } },
        data: { invoiceItemId: null },
      });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id, id: { in: plan.deleteIds } } });
    }
    for (const item of plan.update) {
      await tx.invoiceItem.update({
        where: { id: item.id },
        data: {
          description: item.description,
          quantity: item.quantity.toString(),
          unit: item.unit,
          rate: item.rate.toString(),
          amount: item.amount.toString(),
          projectId: item.projectId,
          sortOrder: item.sortOrder,
        },
      });
    }
    for (const item of plan.create) {
      await tx.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity.toString(),
          unit: item.unit,
          rate: item.rate.toString(),
          amount: item.amount.toString(),
          projectId: item.projectId,
          sortOrder: item.sortOrder,
        },
      });
    }

    const totals = computeInvoiceTotals(
      items.map((i) => ({ amount: i.amount })),
      input.discount ?? 0,
      input.taxRate ?? 0,
    );
    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        clientId: input.clientId,
        projectId: input.projectId ?? null,
        issueDate: input.issueDate,
        dueDate: input.dueDate ?? invoice.dueDate,
        poNumber: input.poNumber ?? null,
        notes: input.notes ?? null,
        terms: input.terms ?? null,
        paymentInstructions: input.paymentInstructions ?? null,
        subtotal: totals.subtotal.toString(),
        discount: totals.discount.toString(),
        taxRate: toDecimal(input.taxRate ?? 0).toString(),
        taxAmount: totals.taxAmount.toString(),
        total: totals.total.toString(),
        // Drafts can't have payments, so the balance is the full total.
        amountPaid: "0",
        balanceDue: totals.total.toString(),
      },
    });

    await recordActivity(
      {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "invoice.update",
        entityType: "Invoice",
        entityId: invoice.id,
        message: `Draft ${invoice.invoiceNumber} updated (${updated.total})`,
      },
      tx,
    );
    await recordAudit(
      {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "UPDATE",
        entityType: "Invoice",
        entityId: invoice.id,
        before: { total: invoice.total.toString(), itemCount: invoice.items.length, clientId: invoice.clientId },
        after: { total: totals.total.toString(), itemCount: items.length, clientId: input.clientId },
      },
      tx,
    );
    return updated;
  });
}

/**
 * Copy an invoice (any status) into a new DRAFT dated today with a fresh
 * number. Payments and time-entry links are not copied.
 */
export async function duplicateInvoice(organizationId: string, invoiceId: string, actorUserId?: string | null) {
  const source = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    include: { items: { orderBy: { sortOrder: "asc" } }, client: { select: { active: true } } },
  });
  if (!source) throw new AppError("NOT_FOUND", "Invoice not found.");
  if (!source.client.active) throw new AppError("VALIDATION_ERROR", "This client is archived. Restore it before duplicating.");

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { defaultPaymentTermsDays: true },
  });
  const now = new Date();
  const issueDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));

  return createInvoice({
    organizationId,
    actorUserId,
    clientId: source.clientId,
    projectId: source.projectId,
    issueDate,
    dueDate: addDays(issueDate, org.defaultPaymentTermsDays),
    poNumber: source.poNumber,
    notes: source.notes,
    terms: source.terms,
    paymentInstructions: source.paymentInstructions,
    discount: source.discount.toString(),
    taxRate: source.taxRate.toString(),
    currency: source.currency,
    items: source.items.map((i) => ({
      description: i.description,
      quantity: i.quantity.toString(),
      unit: i.unit,
      rate: i.rate.toString(),
      projectId: i.projectId,
    })),
  });
}
