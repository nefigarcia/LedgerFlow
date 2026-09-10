import { describe, expect, it } from "vitest";
import {
  allocateByWeights,
  formatMoney,
  moneyAdd,
  moneyDivide,
  moneyMultiply,
  moneyRound,
  moneySubtract,
  moneySum,
  toDecimal,
} from "../src/lib/money/money";

describe("money helpers", () => {
  it("adds without floating drift", () => {
    expect(moneyAdd("0.1", "0.2").toString()).toBe("0.3");
    expect(moneyAdd("1000000.10", "0.05").toString()).toBe("1000000.15");
  });

  it("subtracts safely", () => {
    expect(moneySubtract("1000.00", "0.01").toString()).toBe("999.99");
  });

  it("multiplies and rounds to 2 decimals HALF_UP", () => {
    expect(moneyRound(moneyMultiply("2.675", "1")).toFixed(2)).toBe("2.68");
  });

  it("divides safely and treats zero divisor as 0", () => {
    expect(moneyDivide("10", "3").toFixed(4)).toBe("3.3333");
    expect(moneyDivide("10", "0").toString()).toBe("0");
  });

  it("sums an array", () => {
    expect(moneySum(["1.10", "2.20", "3.30"]).toString()).toBe("6.6");
  });

  it("formats currency", () => {
    expect(formatMoney(1234.5, "USD")).toContain("1,234.50");
  });

  it("allocates by weights and preserves total exactly", () => {
    const parts = allocateByWeights("100", [1, 1, 1]);
    expect(parts.map((p) => p.toString())).toEqual(["33.34", "33.33", "33.33"]);
    expect(moneySum(parts).toString()).toBe("100");
  });

  it("allocates by uneven ownership weights", () => {
    const parts = allocateByWeights("1000", [60, 40]);
    expect(parts.map((p) => p.toFixed(2))).toEqual(["600.00", "400.00"]);
    expect(moneySum(parts).toString()).toBe("1000");
  });

  it("returns zero allocations when weights sum to zero", () => {
    const parts = allocateByWeights("500", [0, 0]);
    expect(parts.every((p) => p.isZero())).toBe(true);
  });

  it("toDecimal handles null/undefined/nan", () => {
    expect(toDecimal(null).toString()).toBe("0");
    expect(toDecimal(undefined).toString()).toBe("0");
  });
});
