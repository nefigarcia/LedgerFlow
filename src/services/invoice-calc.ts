import { Decimal } from "decimal.js";
import {
  moneyAdd,
  moneyMax,
  moneyMultiply,
  moneyRound,
  moneySubtract,
  moneySum,
  toDecimal,
  type MoneyInput,
} from "@/lib/money/money";
import type { InvoiceStatus } from "@prisma/client";

/**
 * Pure invoice calculation helpers. No database or "server-only" imports —
 * safe to import from client components for previews.
 */
export function computeItemAmount(qty: MoneyInput, rate: MoneyInput): Decimal {
  return moneyRound(moneyMultiply(qty, rate));
}

export function computeInvoiceTotals(
  items: { amount: MoneyInput }[],
  discount: MoneyInput = 0,
  taxRate: MoneyInput = 0,
) {
  const subtotal = moneySum(items.map((i) => i.amount));
  const discountAmount = toDecimal(discount);
  const taxableBase = moneyMax(0, moneySubtract(subtotal, discountAmount));
  const taxAmount = moneyRound(moneyMultiply(taxableBase, toDecimal(taxRate).div(100)));
  const total = moneyRound(moneyAdd(taxableBase, taxAmount));
  return {
    subtotal: moneyRound(subtotal),
    discount: moneyRound(discountAmount),
    taxAmount,
    total,
  };
}

export function recomputeInvoiceStatus(
  invoiceTotal: MoneyInput,
  amountPaid: MoneyInput,
  dueDate: Date,
  currentStatus: InvoiceStatus,
): InvoiceStatus {
  if (currentStatus === "VOID" || currentStatus === "DRAFT") return currentStatus;
  const total = toDecimal(invoiceTotal);
  const paid = toDecimal(amountPaid);
  if (paid.gte(total) && total.gt(0)) return "PAID";
  if (paid.gt(0)) return "PARTIALLY_PAID";
  if (dueDate < new Date()) return "OVERDUE";
  return currentStatus;
}
