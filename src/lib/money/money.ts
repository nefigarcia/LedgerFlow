import { Decimal } from "decimal.js";
import type { Prisma } from "@prisma/client";

// Configure Decimal for financial safety.
Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput =
  | number
  | string
  | Decimal
  | Prisma.Decimal
  | null
  | undefined;

export function toDecimal(value: MoneyInput): Decimal {
  if (value == null) return new Decimal(0);
  if (value instanceof Decimal) return value;
  if (typeof value === "object" && "toFixed" in value) {
    return new Decimal(value.toString());
  }
  return new Decimal(value);
}

export function moneyAdd(a: MoneyInput, b: MoneyInput): Decimal {
  return toDecimal(a).plus(toDecimal(b));
}

export function moneySubtract(a: MoneyInput, b: MoneyInput): Decimal {
  return toDecimal(a).minus(toDecimal(b));
}

export function moneyMultiply(a: MoneyInput, b: MoneyInput): Decimal {
  return toDecimal(a).times(toDecimal(b));
}

export function moneyDivide(a: MoneyInput, b: MoneyInput): Decimal {
  const bd = toDecimal(b);
  if (bd.isZero()) return new Decimal(0);
  return toDecimal(a).dividedBy(bd);
}

export function moneyRound(a: MoneyInput, decimals = 2): Decimal {
  return toDecimal(a).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}

export function moneyMax(a: MoneyInput, b: MoneyInput): Decimal {
  const ad = toDecimal(a);
  const bd = toDecimal(b);
  return ad.gt(bd) ? ad : bd;
}

export function moneyMin(a: MoneyInput, b: MoneyInput): Decimal {
  const ad = toDecimal(a);
  const bd = toDecimal(b);
  return ad.lt(bd) ? ad : bd;
}

export function moneySum(values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>(
    (acc, v) => acc.plus(toDecimal(v)),
    new Decimal(0),
  );
}

export function isZero(value: MoneyInput): boolean {
  return toDecimal(value).isZero();
}

export function isPositive(value: MoneyInput): boolean {
  return toDecimal(value).gt(0);
}

export function isNegative(value: MoneyInput): boolean {
  return toDecimal(value).lt(0);
}

export function toNumber(value: MoneyInput): number {
  return toDecimal(value).toNumber();
}

export function toFixed(value: MoneyInput, decimals = 2): string {
  return moneyRound(value, decimals).toFixed(decimals);
}

const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US",
  EUR: "en-IE",
  GBP: "en-GB",
  CAD: "en-CA",
  AUD: "en-AU",
  MXN: "es-MX",
};

export function formatMoney(
  value: MoneyInput,
  currency = "USD",
  options?: Intl.NumberFormatOptions,
): string {
  const locale = CURRENCY_LOCALES[currency] ?? "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(toNumber(value));
}

export function formatPercent(
  value: MoneyInput,
  decimals = 1,
): string {
  return `${moneyRound(value, decimals).toFixed(decimals)}%`;
}

/**
 * Allocate an amount across weights (e.g. ownership percentages)
 * with remainder distributed to first bucket to keep totals exact.
 */
export function allocateByWeights(
  amount: MoneyInput,
  weights: MoneyInput[],
): Decimal[] {
  const total = toDecimal(amount);
  const totalWeight = moneySum(weights);
  if (totalWeight.isZero()) {
    return weights.map(() => new Decimal(0));
  }
  const raw = weights.map((w) =>
    total.times(toDecimal(w)).dividedBy(totalWeight),
  );
  const rounded = raw.map((v) => moneyRound(v, 2));
  const sumRounded = moneySum(rounded);
  const drift = total.minus(sumRounded);
  if (!drift.isZero() && rounded.length > 0) {
    rounded[0] = rounded[0].plus(drift);
  }
  return rounded;
}
