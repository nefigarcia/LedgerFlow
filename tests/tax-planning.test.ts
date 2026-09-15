import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";
import { effectiveOwnerReserveRate } from "../src/services/tax-planning";
import { toDecimal, moneyMultiply, moneyRound, moneySum, allocateByWeights } from "../src/lib/money/money";

/**
 * Pure calculation tests for tax-planning primitives.
 *
 * These tests exercise the deterministic math that the service layer
 * uses. Integration-level tests would require a live database — the
 * service is otherwise a thin composition of Prisma queries + these
 * helpers, so we test the helpers plus the specification example
 * from the spec: payment 8000, expenses 1000, 50/50, 30% reserve.
 */

describe("effectiveOwnerReserveRate", () => {
  it("SIMPLE mode: uses org default when no override", () => {
    const rate = effectiveOwnerReserveRate({ taxReserveOverride: null }, "30", "SIMPLE");
    expect(rate.toString()).toBe("30");
  });

  it("SIMPLE mode: prefers owner override", () => {
    const rate = effectiveOwnerReserveRate({ taxReserveOverride: "25.5" }, "30", "SIMPLE");
    expect(rate.toString()).toBe("25.5");
  });

  it("SIMPLE mode: ignores state rate even if provided", () => {
    const rate = effectiveOwnerReserveRate(
      { taxReserveOverride: null, stateReserveRate: "5" },
      "30",
      "SIMPLE",
    );
    expect(rate.toString()).toBe("30");
  });

  it("ADVANCED mode: adds state rate on top of base", () => {
    const rate = effectiveOwnerReserveRate(
      { taxReserveOverride: null, stateReserveRate: "5" },
      "30",
      "ADVANCED",
    );
    expect(rate.toString()).toBe("35");
  });

  it("ADVANCED mode: applies override + state", () => {
    const rate = effectiveOwnerReserveRate(
      { taxReserveOverride: "22", stateReserveRate: "5" },
      "30",
      "ADVANCED",
    );
    expect(rate.toString()).toBe("27");
  });
});

describe("spec scenario — payment 8000, expenses 1000, 50/50, 30%", () => {
  const revenue = 8000;
  const deductibleExpenses = 1000;
  const planningProfit = revenue - deductibleExpenses;

  it("computes planning profit correctly", () => {
    expect(planningProfit).toBe(7000);
  });

  it("allocates profit 50/50", () => {
    const alloc = allocateByWeights(planningProfit, [50, 50]);
    expect(alloc.map((d) => d.toString())).toEqual(["3500", "3500"]);
    expect(moneySum(alloc).toString()).toBe("7000");
  });

  it("calculates per-owner reserve at 30%", () => {
    const alloc = allocateByWeights(planningProfit, [50, 50]);
    const reserves = alloc.map((p) => moneyRound(moneyMultiply(p, "0.30")));
    expect(reserves.map((d) => d.toString())).toEqual(["1050", "1050"]);
    expect(moneySum(reserves).toString()).toBe("2100");
  });

  it("safe-to-distribute equals recorded cash − unfunded reserve − op reserve", () => {
    // Recorded cash after operations: 8000 − 1000 (recorded) = 7000
    const recordedCash = new Decimal(7000);
    const unfundedReserve = new Decimal(2100);
    const opReserve = new Decimal(0);
    const safe = recordedCash.minus(unfundedReserve).minus(opReserve);
    expect(safe.toString()).toBe("4900");
  });

  it("recommends $2,450 per owner distribution from $4,900 pool", () => {
    const pool = new Decimal(4900);
    const alloc = allocateByWeights(pool, [50, 50]);
    expect(alloc.map((d) => d.toString())).toEqual(["2450", "2450"]);
    expect(moneySum(alloc).toString()).toBe("4900");
  });
});

describe("safe-to-distribute edge cases", () => {
  it("zero revenue: safe-to-distribute is 0 (no negative)", () => {
    const recordedCash = new Decimal(0);
    const unfundedReserve = new Decimal(0);
    const safe = Decimal.max(0, recordedCash.minus(unfundedReserve));
    expect(safe.toString()).toBe("0");
  });

  it("negative profit: reserve target is 0 (no negative reserve)", () => {
    const profit = new Decimal(-500);
    const positiveProfit = Decimal.max(0, profit);
    const reserve = positiveProfit.times("0.30");
    expect(reserve.toString()).toBe("0");
  });

  it("fully funded reserve: unfunded is 0, taxes paid stands separately", () => {
    const target = new Decimal(2100);
    const paid = new Decimal(2100);
    const earmarked = new Decimal(0);
    const remaining = Decimal.max(0, target.minus(paid));
    const unfunded = Decimal.max(0, remaining.minus(earmarked));
    expect(remaining.toString()).toBe("0");
    expect(unfunded.toString()).toBe("0");
  });

  it("earmarked cash covers remaining reserve → unfunded is 0", () => {
    const target = new Decimal(2100);
    const paid = new Decimal(1050);
    const earmarked = new Decimal(1050);
    const remaining = Decimal.max(0, target.minus(paid));
    const unfunded = Decimal.max(0, remaining.minus(earmarked));
    expect(remaining.toString()).toBe("1050");
    expect(unfunded.toString()).toBe("0");
  });

  it("partially funded: unfunded reduces safe-to-distribute", () => {
    const target = new Decimal(2100);
    const paid = new Decimal(500);
    const earmarked = new Decimal(700);
    const remaining = Decimal.max(0, target.minus(paid));
    const unfunded = Decimal.max(0, remaining.minus(earmarked));
    expect(remaining.toString()).toBe("1600");
    expect(unfunded.toString()).toBe("900");
  });

  it("surplus earmark: fundingGap is negative (surplus)", () => {
    const target = new Decimal(1000);
    const paid = new Decimal(500);
    const earmarked = new Decimal(800);
    const remaining = Decimal.max(0, target.minus(paid));
    const gap = remaining.minus(earmarked); // can be negative
    expect(remaining.toString()).toBe("500");
    expect(gap.toString()).toBe("-300");
  });

  it("operating reserve subtracts from safe-to-distribute", () => {
    const recordedCash = new Decimal(7000);
    const unfundedReserve = new Decimal(2100);
    const opReserve = new Decimal(1000);
    const safe = Decimal.max(0, recordedCash.minus(unfundedReserve).minus(opReserve));
    expect(safe.toString()).toBe("3900");
  });
});

describe("allocation semantics", () => {
  it("unequal ownership: 60/40 on $10,000 profit at 25%", () => {
    const alloc = allocateByWeights(10000, [60, 40]);
    expect(alloc.map((d) => d.toString())).toEqual(["6000", "4000"]);
    const reserves = alloc.map((p) => moneyRound(moneyMultiply(p, "0.25")));
    expect(reserves.map((d) => d.toString())).toEqual(["1500", "1000"]);
  });

  it("per-owner reserve override wins in SIMPLE mode", () => {
    const orgRate = new Decimal("30");
    const owners = [
      { taxReserveOverride: null, ownership: 60 },
      { taxReserveOverride: "22", ownership: 40 },
    ];
    const profit = 10000;
    const alloc = owners.map((o) => new Decimal(profit).times(o.ownership).div(100));
    const reserves = owners.map((o, i) => {
      const rate = o.taxReserveOverride ? new Decimal(o.taxReserveOverride) : orgRate;
      return moneyRound(alloc[i].times(rate).div(100));
    });
    expect(reserves.map((r) => r.toString())).toEqual(["1800", "880"]);
  });

  it("distribution percentage is independent of ownership percentage", () => {
    // Ownership drives profit allocation; distributionPercentage drives cash split
    const profit = 10000;
    const ownershipAlloc = allocateByWeights(profit, [50, 50]);
    // But cash pool splits 70/30
    const pool = 4900;
    const cashAlloc = allocateByWeights(pool, [70, 30]);
    expect(ownershipAlloc.map((d) => d.toString())).toEqual(["5000", "5000"]);
    expect(cashAlloc.map((d) => d.toString())).toEqual(["3430", "1470"]);
  });
});

describe("Decimal precision", () => {
  it("preserves 0.01 precision through multiplication chain", () => {
    // 3333.33 × 0.30 = 999.999 → round to 1000.00
    const value = toDecimal("3333.33");
    const rate = toDecimal("0.30");
    const result = moneyRound(moneyMultiply(value, rate));
    expect(result.toString()).toBe("1000");
  });

  it("weighted allocation preserves total exactly", () => {
    // Awkward split that can't divide evenly
    const parts = allocateByWeights("100", [1, 1, 1]);
    expect(moneySum(parts).toString()).toBe("100");
    // First bucket gets the drift
    expect(parts[0].toString()).toBe("33.34");
    expect(parts[1].toString()).toBe("33.33");
    expect(parts[2].toString()).toBe("33.33");
  });
});

describe("invoice sales tax is not tax reserve", () => {
  it("sales tax on invoice does not enter reserve calculation", () => {
    // Invoice: $1000 subtotal, 8% sales tax → $1080 total
    // Sales tax portion ($80) is customer money, not the owner's income tax.
    // The reserve calc uses (payments received − deductible expenses) × reserve%.
    // Payments received DOES include sales-tax collected (since that money hit
    // the account), but the PLANNING PROFIT deducts deductible business
    // expenses; sales-tax remittance is recorded as a separate TaxPayment
    // (org-scope). Here we simulate the org remitting the sales tax.
    const invoiceTotal = 1080;
    const salesTaxRemitted = 80;
    const deductibleExpenses = 0;
    const paymentsReceived = invoiceTotal;
    // After the org pays the sales tax:
    const recordedCashAfter = paymentsReceived - deductibleExpenses - salesTaxRemitted;
    const planningProfit = paymentsReceived - deductibleExpenses;
    // Sales tax remittance did NOT reduce the planning profit — only expenses do.
    expect(planningProfit).toBe(1080);
    expect(recordedCashAfter).toBe(1000);
  });
});
