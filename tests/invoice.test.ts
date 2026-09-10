import { describe, expect, it } from "vitest";
import {
  computeInvoiceTotals,
  computeItemAmount,
  recomputeInvoiceStatus,
} from "../src/services/invoice-calc";
import { addDays, subDays } from "date-fns";

describe("invoice totals", () => {
  it("computes item amount safely", () => {
    expect(computeItemAmount("2.5", "150").toString()).toBe("375");
  });

  it("computes totals with discount and tax", () => {
    const totals = computeInvoiceTotals(
      [{ amount: "100.00" }, { amount: "250.00" }, { amount: "50.00" }],
      "50",
      "8.5",
    );
    // subtotal 400, − 50 discount → 350 taxable base
    // tax = 350 * 0.085 = 29.75 → total = 379.75
    expect(totals.subtotal.toString()).toBe("400");
    expect(totals.discount.toString()).toBe("50");
    expect(totals.taxAmount.toString()).toBe("29.75");
    expect(totals.total.toString()).toBe("379.75");
  });

  it("does not go negative when discount exceeds subtotal", () => {
    const totals = computeInvoiceTotals([{ amount: "50" }], "999", "10");
    expect(totals.taxAmount.toString()).toBe("0");
    expect(totals.total.toString()).toBe("0");
  });
});

describe("invoice status recomputation", () => {
  const dueFuture = addDays(new Date(), 7);
  const duePast = subDays(new Date(), 7);

  it("keeps DRAFT and VOID unchanged", () => {
    expect(recomputeInvoiceStatus("100", "0", dueFuture, "DRAFT")).toBe("DRAFT");
    expect(recomputeInvoiceStatus("100", "100", duePast, "VOID")).toBe("VOID");
  });

  it("marks PAID when fully paid", () => {
    expect(recomputeInvoiceStatus("100", "100", duePast, "SENT")).toBe("PAID");
  });

  it("marks PARTIALLY_PAID when some but not all is paid", () => {
    expect(recomputeInvoiceStatus("100", "40", dueFuture, "SENT")).toBe("PARTIALLY_PAID");
  });

  it("marks OVERDUE when unpaid past due date", () => {
    expect(recomputeInvoiceStatus("100", "0", duePast, "SENT")).toBe("OVERDUE");
  });

  it("keeps SENT when unpaid and due in future", () => {
    expect(recomputeInvoiceStatus("100", "0", dueFuture, "SENT")).toBe("SENT");
  });
});
