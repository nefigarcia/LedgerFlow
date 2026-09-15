import "server-only";
import { prisma } from "@/lib/db/prisma";
import {
  getDashboardSummary,
  getForecast,
  getRevenueByClient,
  getExpenseBreakdown,
  getARAging,
  getOwnerDistributionSummary,
} from "@/services/financial-metrics";
import { getConsolidatedTaxReserveStatus, getOwnerTaxPlanning } from "@/services/tax-planning";
import { formatDate } from "@/lib/dates/dates";

/**
 * Build a compact, tenant-scoped context payload for the assistant.
 * The AI receives only pre-aggregated numbers for the current organization.
 *
 * Terminology (echoed in the system prompt):
 *   - Sales tax = customer-facing invoice tax (unrelated to income tax planning).
 *   - Tax reserve = internal cash-planning amount for future taxes.
 *   - Tax payment = money actually sent to a tax authority.
 *   - Distribution = cash paid to an owner.
 *   - Allocated profit = owner's share of estimated business profit.
 */
export async function buildFinancialContext(organizationId: string) {
  const [
    summary,
    forecast,
    byClient,
    expenseCats,
    aging,
    org,
    upcoming,
    recent,
    ownerTax,
    consolidatedTax,
    distributionSummary,
  ] = await Promise.all([
    getDashboardSummary({ organizationId }),
    getForecast({ organizationId }),
    getRevenueByClient({ organizationId }),
    getExpenseBreakdown({ organizationId }),
    getARAging({ organizationId }),
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        name: true,
        currency: true,
        businessType: true,
        country: true,
        openingBalance: true,
        minimumOperatingReserve: true,
        defaultTaxReserveRate: true,
        taxPlanningMode: true,
        taxReserveEarmarked: true,
      },
    }),
    prisma.taxPayment.findMany({
      where: { organizationId, status: { in: ["UPCOMING", "DUE_SOON", "OVERDUE"] } },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: { owner: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
      include: { client: { select: { companyName: true } } },
    }),
    getOwnerTaxPlanning({ organizationId }),
    getConsolidatedTaxReserveStatus({ organizationId }),
    getOwnerDistributionSummary({ organizationId }),
  ]);

  return {
    organization: {
      name: org.name,
      businessType: org.businessType,
      country: org.country,
      currency: org.currency,
      minimumOperatingReserve: Number(org.minimumOperatingReserve),
      defaultTaxReserveRate: Number(org.defaultTaxReserveRate),
      taxPlanningMode: org.taxPlanningMode,
    },
    period: { year: new Date().getFullYear(), asOf: new Date().toISOString().slice(0, 10) },

    // Cash breakdown — respect the new "earmarked vs unfunded" distinction.
    cash: {
      recordedCash: summary.cash.recordedCash,
      taxReserveTarget: consolidatedTax.reserveTarget,
      taxPaymentsMade: consolidatedTax.taxesPaid,
      taxReserveRemaining: consolidatedTax.remainingReserve,
      cashEarmarkedForTaxes: consolidatedTax.earmarkedCash,
      unfundedTaxReserve: consolidatedTax.unfundedReserve,
      operatingReserve: summary.cash.operatingReserve,
      safeToDistribute: summary.cash.available,
    },

    revenue: summary.revenue,
    expenses: summary.expenses,
    estimatedBusinessProfit: summary.profitYtd,
    accountsReceivable: summary.accountsReceivable,

    // Owner-level tax planning (allocated profit, reserve, payments, remaining)
    ownerTaxPlanning: {
      year: ownerTax.year,
      mode: ownerTax.reserveMode,
      owners: ownerTax.owners.map((o) => ({
        name: o.name,
        ownershipPercentage: o.ownershipPercentage,
        distributionPercentage: o.distributionPercentage,
        residenceState: o.residenceState,
        reserveRate: o.reserveRate,
        allocatedProfit: o.allocatedProfit,
        recommendedReserve: o.reserveTarget,
        estimatedTaxPaymentsMade: o.taxesPaid,
        remainingReserve: o.remainingReserve,
        distributionsYtd: o.distributionsYtd,
      })),
      aggregate: ownerTax.aggregate,
    },

    // Owner distributions (safe-to-distribute recommendation, not tax basis)
    ownerDistributionRecommendation: distributionSummary.map((d) => ({
      owner: d.name,
      distributionPercentage: d.distributionPercentage,
      recommendedDistribution: d.recommendedDistribution,
      actualYtd: d.actualYtd,
      variance: d.variance,
    })),

    forecast,
    topClientsYtd: byClient.slice(0, 8),
    expenseCategoriesYtd: expenseCats.slice(0, 8),
    receivablesAging: {
      buckets: Object.fromEntries(Object.entries(aging.buckets).map(([k, v]) => [k, Number(v)])),
      counts: aging.counts,
    },
    upcomingTaxPayments: upcoming.map((t) => ({
      scope: t.owner ? `owner:${t.owner.name}` : "organization",
      authority: t.authority,
      description: t.description,
      dueDate: formatDate(t.dueDate),
      estimatedAmount: t.estimatedAmount ? Number(t.estimatedAmount) : null,
      status: t.status,
    })),
    openInvoices: recent.map((i) => ({
      invoiceNumber: i.invoiceNumber,
      client: i.client.companyName,
      dueDate: formatDate(i.dueDate),
      balanceDue: Number(i.balanceDue),
      status: i.status,
    })),
  };
}
