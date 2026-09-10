import "server-only";
import { prisma } from "@/lib/db/prisma";
import { Decimal } from "decimal.js";
import {
  moneyAdd,
  moneyMax,
  moneyMultiply,
  moneyRound,
  moneySubtract,
  moneySum,
  toDecimal,
  toNumber,
  allocateByWeights,
} from "@/lib/money/money";
import {
  endOfMonth,
  endOfYear,
  format,
  startOfMonth,
  startOfYear,
  subMonths,
} from "date-fns";

type OrgIdArg = { organizationId: string };

async function getOrganization(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      currency: true,
      openingBalance: true,
      minimumOperatingReserve: true,
      defaultTaxReserveRate: true,
    },
  });
  if (!org) throw new Error("Organization not found");
  return org;
}

export async function getRevenueYTD({ organizationId }: OrgIdArg) {
  const now = new Date();
  const start = startOfYear(now);
  const end = endOfYear(now);
  const agg = await prisma.payment.aggregate({
    where: { organizationId, date: { gte: start, lte: end } },
    _sum: { amount: true },
  });
  return toDecimal(agg._sum.amount ?? 0);
}

export async function getRevenueThisMonth({ organizationId }: OrgIdArg) {
  const now = new Date();
  const agg = await prisma.payment.aggregate({
    where: {
      organizationId,
      date: { gte: startOfMonth(now), lte: endOfMonth(now) },
    },
    _sum: { amount: true },
  });
  return toDecimal(agg._sum.amount ?? 0);
}

export async function getExpensesYTD({ organizationId }: OrgIdArg) {
  const now = new Date();
  const agg = await prisma.expense.aggregate({
    where: {
      organizationId,
      isPersonal: false,
      date: { gte: startOfYear(now), lte: endOfYear(now) },
    },
    _sum: { amount: true },
  });
  return toDecimal(agg._sum.amount ?? 0);
}

export async function getExpensesThisMonth({ organizationId }: OrgIdArg) {
  const now = new Date();
  const agg = await prisma.expense.aggregate({
    where: {
      organizationId,
      isPersonal: false,
      date: { gte: startOfMonth(now), lte: endOfMonth(now) },
    },
    _sum: { amount: true },
  });
  return toDecimal(agg._sum.amount ?? 0);
}

export async function getTotalPayments({ organizationId }: OrgIdArg) {
  const agg = await prisma.payment.aggregate({
    where: { organizationId },
    _sum: { amount: true },
  });
  return toDecimal(agg._sum.amount ?? 0);
}

export async function getTotalExpensesAllTime({ organizationId }: OrgIdArg) {
  const agg = await prisma.expense.aggregate({
    where: { organizationId, isPersonal: false },
    _sum: { amount: true },
  });
  return toDecimal(agg._sum.amount ?? 0);
}

export async function getTotalDistributions({ organizationId }: OrgIdArg) {
  const agg = await prisma.distribution.aggregate({
    where: { organizationId },
    _sum: { amount: true },
  });
  return toDecimal(agg._sum.amount ?? 0);
}

export async function getTotalTaxPayments({ organizationId }: OrgIdArg) {
  const agg = await prisma.taxPayment.aggregate({
    where: { organizationId },
    _sum: { amountPaid: true },
  });
  return toDecimal(agg._sum.amountPaid ?? 0);
}

/**
 * Recorded cash =
 *   openingBalance + payments − expenses − distributions − tax payments
 */
export async function getRecordedCash({ organizationId }: OrgIdArg) {
  const org = await getOrganization(organizationId);
  const [payments, expenses, distributions, taxes] = await Promise.all([
    getTotalPayments({ organizationId }),
    getTotalExpensesAllTime({ organizationId }),
    getTotalDistributions({ organizationId }),
    getTotalTaxPayments({ organizationId }),
  ]);
  return moneyRound(
    moneySubtract(
      moneySubtract(
        moneySubtract(
          moneyAdd(org.openingBalance, payments),
          expenses,
        ),
        distributions,
      ),
      taxes,
    ),
  );
}

export async function getAccountsReceivable({ organizationId }: OrgIdArg) {
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] },
    },
    select: { balanceDue: true, dueDate: true, id: true, total: true },
  });
  const balance = moneySum(invoices.map((i) => i.balanceDue));
  const overdue = moneySum(
    invoices.filter((i) => i.dueDate < new Date()).map((i) => i.balanceDue),
  );
  return {
    outstanding: moneyRound(balance),
    overdue: moneyRound(overdue),
    openInvoiceCount: invoices.length,
    overdueCount: invoices.filter((i) => i.dueDate < new Date()).length,
  };
}

export async function getARAging({ organizationId }: OrgIdArg) {
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] },
    },
    select: { balanceDue: true, dueDate: true },
  });
  const buckets = {
    current: new Decimal(0),
    "1_30": new Decimal(0),
    "31_60": new Decimal(0),
    "61_90": new Decimal(0),
    "90_plus": new Decimal(0),
  };
  const counts = { current: 0, "1_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 };
  const now = new Date();
  for (const inv of invoices) {
    const daysLate = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000);
    if (daysLate <= 0) {
      buckets.current = buckets.current.plus(toDecimal(inv.balanceDue));
      counts.current++;
    } else if (daysLate <= 30) {
      buckets["1_30"] = buckets["1_30"].plus(toDecimal(inv.balanceDue));
      counts["1_30"]++;
    } else if (daysLate <= 60) {
      buckets["31_60"] = buckets["31_60"].plus(toDecimal(inv.balanceDue));
      counts["31_60"]++;
    } else if (daysLate <= 90) {
      buckets["61_90"] = buckets["61_90"].plus(toDecimal(inv.balanceDue));
      counts["61_90"]++;
    } else {
      buckets["90_plus"] = buckets["90_plus"].plus(toDecimal(inv.balanceDue));
      counts["90_plus"]++;
    }
  }
  return { buckets, counts };
}

/**
 * Operating profit estimate = payments received − deductible expenses (YTD).
 */
export async function getOperatingProfitYTD({ organizationId }: OrgIdArg) {
  const now = new Date();
  const start = startOfYear(now);
  const end = endOfYear(now);
  const [payAgg, expAgg] = await Promise.all([
    prisma.payment.aggregate({
      where: { organizationId, date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: {
        organizationId,
        isPersonal: false,
        taxDeductible: true,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
  ]);
  const payments = toDecimal(payAgg._sum.amount ?? 0);
  const expenses = toDecimal(expAgg._sum.amount ?? 0);
  return { payments, expenses, profit: moneyRound(moneySubtract(payments, expenses)) };
}

export async function getTaxReserveStatus({ organizationId }: OrgIdArg) {
  const org = await getOrganization(organizationId);
  const [{ profit }, taxProfile, taxesPaid] = await Promise.all([
    getOperatingProfitYTD({ organizationId }),
    prisma.taxProfile.findUnique({ where: { organizationId } }),
    getTotalTaxPayments({ organizationId }),
  ]);
  const reserveRate = toDecimal(taxProfile?.reserveRate ?? org.defaultTaxReserveRate);
  const reserveTarget = moneyMax(
    0,
    moneyMultiply(moneyMax(0, profit), moneyRound(reserveRate.div(100), 6)),
  );
  const remaining = moneyMax(0, moneySubtract(reserveTarget, taxesPaid));
  return {
    reserveRate,
    reserveTarget: moneyRound(reserveTarget),
    taxesPaid: moneyRound(taxesPaid),
    remaining: moneyRound(remaining),
    profit,
  };
}

/**
 * Available to distribute =
 *   max(0, recordedCash − remaining tax reserve − minimum operating reserve)
 */
export async function getAvailableToDistribute({ organizationId }: OrgIdArg) {
  const org = await getOrganization(organizationId);
  const [cash, tax] = await Promise.all([
    getRecordedCash({ organizationId }),
    getTaxReserveStatus({ organizationId }),
  ]);
  const operatingReserve = toDecimal(org.minimumOperatingReserve);
  const available = moneyMax(
    0,
    moneySubtract(moneySubtract(cash, tax.remaining), operatingReserve),
  );
  return {
    recordedCash: cash,
    taxReserveRemaining: tax.remaining,
    operatingReserve: moneyRound(operatingReserve),
    available: moneyRound(available),
  };
}

export async function getMonthlyRevenueSeries(
  { organizationId }: OrgIdArg,
  months = 12,
) {
  const now = new Date();
  const rows = await prisma.payment.findMany({
    where: {
      organizationId,
      date: { gte: startOfMonth(subMonths(now, months - 1)) },
    },
    select: { amount: true, date: true },
  });
  const map = new Map<string, Decimal>();
  for (let i = months - 1; i >= 0; i--) {
    map.set(format(startOfMonth(subMonths(now, i)), "yyyy-MM"), new Decimal(0));
  }
  for (const r of rows) {
    const k = format(startOfMonth(r.date), "yyyy-MM");
    if (map.has(k)) map.set(k, map.get(k)!.plus(toDecimal(r.amount)));
  }
  return Array.from(map.entries()).map(([month, value]) => ({
    month,
    label: format(new Date(month + "-01T12:00:00Z"), "MMM"),
    revenue: toNumber(value),
  }));
}

export async function getMonthlyExpenseSeries(
  { organizationId }: OrgIdArg,
  months = 12,
) {
  const now = new Date();
  const rows = await prisma.expense.findMany({
    where: {
      organizationId,
      isPersonal: false,
      date: { gte: startOfMonth(subMonths(now, months - 1)) },
    },
    select: { amount: true, date: true },
  });
  const map = new Map<string, Decimal>();
  for (let i = months - 1; i >= 0; i--) {
    map.set(format(startOfMonth(subMonths(now, i)), "yyyy-MM"), new Decimal(0));
  }
  for (const r of rows) {
    const k = format(startOfMonth(r.date), "yyyy-MM");
    if (map.has(k)) map.set(k, map.get(k)!.plus(toDecimal(r.amount)));
  }
  return Array.from(map.entries()).map(([month, value]) => ({
    month,
    label: format(new Date(month + "-01T12:00:00Z"), "MMM"),
    expenses: toNumber(value),
  }));
}

export async function getRevenueVsExpensesSeries(args: OrgIdArg, months = 12) {
  const [rev, exp] = await Promise.all([
    getMonthlyRevenueSeries(args, months),
    getMonthlyExpenseSeries(args, months),
  ]);
  return rev.map((r, i) => ({
    month: r.month,
    label: r.label,
    revenue: r.revenue,
    expenses: exp[i]?.expenses ?? 0,
    profit: Math.round((r.revenue - (exp[i]?.expenses ?? 0)) * 100) / 100,
  }));
}

export async function getRevenueByClient({ organizationId }: OrgIdArg) {
  const now = new Date();
  const rows = await prisma.payment.findMany({
    where: {
      organizationId,
      date: { gte: startOfYear(now), lte: endOfYear(now) },
    },
    select: {
      amount: true,
      invoice: { select: { clientId: true } },
      clientId: true,
    },
  });
  const map = new Map<string, Decimal>();
  for (const r of rows) {
    const clientId = r.clientId ?? r.invoice?.clientId;
    if (!clientId) continue;
    map.set(clientId, (map.get(clientId) ?? new Decimal(0)).plus(toDecimal(r.amount)));
  }
  if (map.size === 0) return [];
  const clients = await prisma.client.findMany({
    where: { organizationId, id: { in: Array.from(map.keys()) } },
    select: { id: true, companyName: true },
  });
  const total = moneySum(Array.from(map.values()));
  return clients
    .map((c) => ({
      clientId: c.id,
      companyName: c.companyName,
      revenue: toNumber(map.get(c.id) ?? new Decimal(0)),
      share: total.isZero() ? 0 : toNumber((map.get(c.id) ?? new Decimal(0)).div(total).times(100)),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getExpenseBreakdown({ organizationId }: OrgIdArg) {
  const now = new Date();
  const rows = await prisma.expense.findMany({
    where: {
      organizationId,
      isPersonal: false,
      date: { gte: startOfYear(now), lte: endOfYear(now) },
    },
    select: { amount: true, categoryId: true, category: { select: { name: true } } },
  });
  const map = new Map<string, { name: string; amount: Decimal }>();
  for (const r of rows) {
    const key = r.categoryId ?? "uncategorized";
    const name = r.category?.name ?? "Uncategorized";
    const bucket = map.get(key) ?? { name, amount: new Decimal(0) };
    bucket.amount = bucket.amount.plus(toDecimal(r.amount));
    map.set(key, bucket);
  }
  return Array.from(map.entries())
    .map(([id, b]) => ({ categoryId: id, name: b.name, amount: toNumber(b.amount) }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getOwnerDistributionSummary({ organizationId }: OrgIdArg) {
  const [owners, available] = await Promise.all([
    prisma.owner.findMany({
      where: { organizationId, active: true },
      orderBy: { createdAt: "asc" },
    }),
    getAvailableToDistribute({ organizationId }),
  ]);
  const now = new Date();
  const ytdDistributions = await prisma.distribution.groupBy({
    by: ["ownerId"],
    where: { organizationId, date: { gte: startOfYear(now), lte: endOfYear(now) } },
    _sum: { amount: true },
  });
  const ytdMap = new Map<string, Decimal>();
  for (const d of ytdDistributions) ytdMap.set(d.ownerId, toDecimal(d._sum.amount ?? 0));

  const weights = owners.map((o) => toDecimal(o.distributionPercentage));
  const recommended = allocateByWeights(available.available, weights);

  return owners.map((o, i) => {
    const distYtd = ytdMap.get(o.id) ?? new Decimal(0);
    return {
      ownerId: o.id,
      name: o.name,
      email: o.email,
      ownershipPercentage: toNumber(o.ownershipPercentage),
      distributionPercentage: toNumber(o.distributionPercentage),
      recommendedDistribution: toNumber(recommended[i] ?? new Decimal(0)),
      actualYtd: toNumber(distYtd),
      variance: toNumber(moneySubtract(distYtd, recommended[i] ?? new Decimal(0))),
    };
  });
}

export async function getForecast({ organizationId }: OrgIdArg) {
  const now = new Date();
  const [rev12, exp12] = await Promise.all([
    getMonthlyRevenueSeries({ organizationId }, 12),
    getMonthlyExpenseSeries({ organizationId }, 12),
  ]);
  // Use months with any activity to avoid understated averages.
  const activeRev = rev12.filter((m) => m.revenue > 0);
  const activeExp = exp12.filter((m) => m.expenses > 0);
  const avgRev = activeRev.length
    ? activeRev.reduce((s, m) => s + m.revenue, 0) / activeRev.length
    : 0;
  const avgExp = activeExp.length
    ? activeExp.reduce((s, m) => s + m.expenses, 0) / activeExp.length
    : 0;
  const monthsThroughYear = now.getMonth() + 1;
  const monthsRemaining = 12 - monthsThroughYear;

  const [ytdPay, ytdExp, tax] = await Promise.all([
    getRevenueYTD({ organizationId }),
    getExpensesYTD({ organizationId }),
    getTaxReserveStatus({ organizationId }),
  ]);
  const projectedRevenue = toNumber(ytdPay) + avgRev * monthsRemaining;
  const projectedExpenses = toNumber(ytdExp) + avgExp * monthsRemaining;
  const projectedProfit = projectedRevenue - projectedExpenses;
  const projectedTaxReserve = Math.max(0, projectedProfit * toNumber(tax.reserveRate) / 100);

  return {
    averageMonthlyRevenue: Math.round(avgRev * 100) / 100,
    averageMonthlyExpenses: Math.round(avgExp * 100) / 100,
    projectedRevenue: Math.round(projectedRevenue * 100) / 100,
    projectedExpenses: Math.round(projectedExpenses * 100) / 100,
    projectedProfit: Math.round(projectedProfit * 100) / 100,
    projectedTaxReserve: Math.round(projectedTaxReserve * 100) / 100,
    projectedNetAfterTax: Math.round((projectedProfit - projectedTaxReserve) * 100) / 100,
  };
}

export interface DashboardSummary {
  currency: string;
  cash: {
    recordedCash: number;
    taxReserveRemaining: number;
    operatingReserve: number;
    available: number;
  };
  revenue: {
    ytd: number;
    thisMonth: number;
  };
  expenses: {
    ytd: number;
    thisMonth: number;
  };
  profitYtd: number;
  accountsReceivable: {
    outstanding: number;
    overdue: number;
    openInvoiceCount: number;
    overdueCount: number;
  };
  taxReserve: {
    reserveRate: number;
    reserveTarget: number;
    taxesPaid: number;
    remaining: number;
  };
}

export async function getDashboardSummary(args: OrgIdArg): Promise<DashboardSummary> {
  const [org, cash, revYtd, revMonth, expYtd, expMonth, profit, ar, tax] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: args.organizationId },
      select: { currency: true, minimumOperatingReserve: true },
    }),
    getAvailableToDistribute(args),
    getRevenueYTD(args),
    getRevenueThisMonth(args),
    getExpensesYTD(args),
    getExpensesThisMonth(args),
    getOperatingProfitYTD(args),
    getAccountsReceivable(args),
    getTaxReserveStatus(args),
  ]);
  return {
    currency: org?.currency ?? "USD",
    cash: {
      recordedCash: toNumber(cash.recordedCash),
      taxReserveRemaining: toNumber(cash.taxReserveRemaining),
      operatingReserve: toNumber(cash.operatingReserve),
      available: toNumber(cash.available),
    },
    revenue: {
      ytd: toNumber(revYtd),
      thisMonth: toNumber(revMonth),
    },
    expenses: {
      ytd: toNumber(expYtd),
      thisMonth: toNumber(expMonth),
    },
    profitYtd: toNumber(profit.profit),
    accountsReceivable: ar as unknown as DashboardSummary["accountsReceivable"],
    taxReserve: {
      reserveRate: toNumber(tax.reserveRate),
      reserveTarget: toNumber(tax.reserveTarget),
      taxesPaid: toNumber(tax.taxesPaid),
      remaining: toNumber(tax.remaining),
    },
  };
}

export async function getClientConcentration(args: OrgIdArg) {
  const rows = await getRevenueByClient(args);
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  const top = rows[0];
  return {
    total,
    topClientName: top?.companyName ?? null,
    topClientRevenue: top?.revenue ?? 0,
    topClientShare: top?.share ?? 0,
    clients: rows,
  };
}
