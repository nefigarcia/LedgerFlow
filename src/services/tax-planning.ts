import "server-only";
import { Decimal } from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import {
  moneyAdd,
  moneyMax,
  moneyMultiply,
  moneyRound,
  moneySubtract,
  moneySum,
  toDecimal,
  toNumber,
} from "@/lib/money/money";
import { startOfYear, endOfYear } from "@/lib/dates/dates";
import { getOperatingProfitYTD } from "./financial-metrics";

/**
 * Tax Planning Service
 * ─────────────────────
 * Owner-centric planning built on top of the deterministic profit calculation.
 *
 * Key invariants:
 *  • Sales tax on invoices is NOT the same as owner income-tax reserve.
 *  • Distributions do NOT determine taxable profit — allocation of profit is
 *    driven by ownershipPercentage.
 *  • Every number returned is a PLANNING ESTIMATE, not tax advice.
 *  • Tax payments recorded by the user are the authoritative "paid" number,
 *    not the reserve balance.
 */

interface OrgIdArg {
  organizationId: string;
  year?: number;
}

/**
 * Effective planning reserve rate for a single owner (percent).
 * Simple mode:   owner.taxReserveOverride ?? org.defaultTaxReserveRate
 * Advanced mode: same as simple unless additional state rate exists;
 *   the calculator adds owner.stateReserveRate on top.
 *
 * We DO NOT synthesize federal brackets here — a repository-audited statutory
 * layer would be required for that, and it's the caller's responsibility to
 * supply advanced assumptions.
 */
export function effectiveOwnerReserveRate(
  owner: { taxReserveOverride: Decimal | string | null; stateReserveRate?: Decimal | string | null },
  orgDefaultRate: Decimal | string,
  mode: "SIMPLE" | "ADVANCED",
): Decimal {
  const base = toDecimal(owner.taxReserveOverride ?? orgDefaultRate);
  if (mode === "ADVANCED" && owner.stateReserveRate) {
    return base.plus(toDecimal(owner.stateReserveRate));
  }
  return base;
}

/**
 * Per-owner planning: what portion of business profit is allocated to each
 * owner, what reserve target that implies, what they've already paid, and
 * what remains unfunded.
 *
 * Terminology in the shape:
 *  - allocatedProfit  = owner's share of estimated business profit
 *  - reserveRate      = the effective planning rate (%)
 *  - reserveTarget    = allocated profit × reserve rate
 *  - taxesPaid        = tax payments recorded for THIS owner this year
 *  - remainingReserve = max(0, target − paid)
 *  - distributionsYtd = cash distributions recorded for THIS owner this year
 */
export interface OwnerTaxSnapshot {
  ownerId: string;
  name: string;
  ownershipPercentage: number;
  distributionPercentage: number;
  filingStatus: string | null;
  residenceState: string | null;
  reserveRate: number;
  allocatedProfit: number;
  reserveTarget: number;
  taxesPaid: number;
  remainingReserve: number;
  distributionsYtd: number;
}

export async function getOwnerTaxPlanning({
  organizationId,
  year,
}: OrgIdArg): Promise<{
  year: number;
  estimatedBusinessProfit: number;
  reserveMode: "SIMPLE" | "ADVANCED";
  owners: OwnerTaxSnapshot[];
  aggregate: {
    reserveTarget: number;
    taxesPaid: number;
    remainingReserve: number;
    totalDistributionsYtd: number;
  };
}> {
  const targetYear = year ?? new Date().getFullYear();
  const start = startOfYear(new Date(targetYear, 0, 1));
  const end = endOfYear(new Date(targetYear, 0, 1));

  const [org, profit, owners, ownerTaxPaymentsGrouped, ownerDistributionsGrouped] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        defaultTaxReserveRate: true,
        taxPlanningMode: true,
      },
    }),
    getOperatingProfitYTD({ organizationId }),
    prisma.owner.findMany({
      where: { organizationId, active: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.taxPayment.groupBy({
      by: ["ownerId"],
      where: {
        organizationId,
        ownerId: { not: null },
        OR: [
          { paidDate: { gte: start, lte: end } },
          { AND: [{ paidDate: null }, { dueDate: { gte: start, lte: end } }] },
        ],
      },
      _sum: { amountPaid: true },
    }),
    prisma.distribution.groupBy({
      by: ["ownerId"],
      where: {
        organizationId,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
  ]);

  const taxesByOwner = new Map<string, Decimal>();
  for (const row of ownerTaxPaymentsGrouped) {
    if (row.ownerId) taxesByOwner.set(row.ownerId, toDecimal(row._sum.amountPaid ?? 0));
  }
  const distributionsByOwner = new Map<string, Decimal>();
  for (const row of ownerDistributionsGrouped) {
    if (row.ownerId) distributionsByOwner.set(row.ownerId, toDecimal(row._sum.amount ?? 0));
  }

  // Only allocate a positive profit; a business loss doesn't create a tax reserve.
  const profitForAllocation = moneyMax(0, profit.profit);
  const mode = org.taxPlanningMode as "SIMPLE" | "ADVANCED";

  const snapshots: OwnerTaxSnapshot[] = owners.map((o) => {
    const ownership = toDecimal(o.ownershipPercentage).div(100);
    const allocatedProfit = moneyRound(moneyMultiply(profitForAllocation, ownership));
    const reserveRate = effectiveOwnerReserveRate(o, org.defaultTaxReserveRate, mode);
    const reserveTarget = moneyRound(moneyMultiply(allocatedProfit, reserveRate.div(100)));
    const taxesPaid = moneyRound(taxesByOwner.get(o.id) ?? new Decimal(0));
    const remaining = moneyMax(0, moneySubtract(reserveTarget, taxesPaid));
    const distributions = moneyRound(distributionsByOwner.get(o.id) ?? new Decimal(0));
    return {
      ownerId: o.id,
      name: o.name,
      ownershipPercentage: toNumber(o.ownershipPercentage),
      distributionPercentage: toNumber(o.distributionPercentage),
      filingStatus: o.filingStatus,
      residenceState: o.residenceState,
      reserveRate: toNumber(reserveRate),
      allocatedProfit: toNumber(allocatedProfit),
      reserveTarget: toNumber(reserveTarget),
      taxesPaid: toNumber(taxesPaid),
      remainingReserve: toNumber(remaining),
      distributionsYtd: toNumber(distributions),
    };
  });

  const aggregateTarget = moneySum(snapshots.map((s) => s.reserveTarget));
  const aggregateTaxesPaid = moneySum(snapshots.map((s) => s.taxesPaid));
  const aggregateRemaining = moneyMax(0, moneySubtract(aggregateTarget, aggregateTaxesPaid));
  const totalDist = moneySum(snapshots.map((s) => s.distributionsYtd));

  return {
    year: targetYear,
    estimatedBusinessProfit: toNumber(profit.profit),
    reserveMode: mode,
    owners: snapshots,
    aggregate: {
      reserveTarget: toNumber(aggregateTarget),
      taxesPaid: toNumber(aggregateTaxesPaid),
      remainingReserve: toNumber(aggregateRemaining),
      totalDistributionsYtd: toNumber(totalDist),
    },
  };
}

/**
 * Sum organization-level tax payments (ownerId IS NULL) for a given year.
 * These represent taxes that belong to the business itself (e.g. sales/use
 * tax, franchise tax) rather than pass-through owner estimated taxes.
 */
export async function getOrganizationLevelTaxPayments({
  organizationId,
  year,
}: OrgIdArg): Promise<number> {
  const targetYear = year ?? new Date().getFullYear();
  const start = startOfYear(new Date(targetYear, 0, 1));
  const end = endOfYear(new Date(targetYear, 0, 1));
  const agg = await prisma.taxPayment.aggregate({
    where: {
      organizationId,
      ownerId: null,
      OR: [
        { paidDate: { gte: start, lte: end } },
        { AND: [{ paidDate: null }, { dueDate: { gte: start, lte: end } }] },
      ],
    },
    _sum: { amountPaid: true },
  });
  return toNumber(agg._sum.amountPaid ?? 0);
}

/**
 * Consolidated tax reserve status combining:
 *  - aggregate owner-level target/paid/remaining
 *  - manual earmarked cash (Org.taxReserveEarmarked)
 *  - reserve funding gap (remaining reserve − earmarked cash)
 *
 * The `unfundedReserve` value is the number that reduces safe-to-distribute:
 *
 *     unfundedReserve = max(0, remainingReserve − earmarkedCash)
 *
 * That is: money the org still needs to set aside beyond what's already
 * been earmarked. Earmarked cash is already "protected" from distribution
 * because it stays in a reserve account (whether physically split or not).
 */
export async function getConsolidatedTaxReserveStatus({
  organizationId,
  year,
}: OrgIdArg) {
  const [planning, org] = await Promise.all([
    getOwnerTaxPlanning({ organizationId, year }),
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        taxReserveEarmarked: true,
        defaultTaxReserveRate: true,
      },
    }),
  ]);

  const earmarked = toDecimal(org.taxReserveEarmarked);
  const remaining = toDecimal(planning.aggregate.remainingReserve);
  const unfunded = moneyMax(0, moneySubtract(remaining, earmarked));
  const gap = moneySubtract(remaining, earmarked); // may be negative → surplus

  return {
    year: planning.year,
    reserveMode: planning.reserveMode,
    estimatedBusinessProfit: planning.estimatedBusinessProfit,
    reserveTarget: planning.aggregate.reserveTarget,
    taxesPaid: planning.aggregate.taxesPaid,
    remainingReserve: planning.aggregate.remainingReserve,
    earmarkedCash: toNumber(earmarked),
    unfundedReserve: toNumber(unfunded),
    // fundingGap > 0 = need to reserve more; fundingGap < 0 = surplus earmarked.
    fundingGap: toNumber(gap),
    fundingStatus:
      remaining.isZero() && earmarked.gt(0)
        ? "fully_funded"
        : unfunded.isZero()
          ? "fully_funded"
          : earmarked.gt(0)
            ? "partially_funded"
            : "unfunded",
    defaultReserveRate: toNumber(org.defaultTaxReserveRate),
    ownerBreakdown: planning.owners,
  };
}
