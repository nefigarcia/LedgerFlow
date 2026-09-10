import "server-only";
import { prisma } from "@/lib/db/prisma";
import {
  getDashboardSummary,
  getForecast,
  getRevenueByClient,
  getExpenseBreakdown,
  getARAging,
} from "@/services/financial-metrics";
import { formatDate } from "@/lib/dates/dates";

/**
 * Build a compact, tenant-scoped context payload for the assistant.
 * The AI receives only pre-aggregated numbers for the current organization.
 */
export async function buildFinancialContext(organizationId: string) {
  const [summary, forecast, byClient, expenseCats, aging, org, upcoming, recent] = await Promise.all([
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
      },
    }),
    prisma.taxPayment.findMany({
      where: { organizationId, status: { in: ["UPCOMING", "DUE_SOON", "OVERDUE"] } },
      orderBy: { dueDate: "asc" },
      take: 5,
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
  ]);

  return {
    organization: {
      name: org.name,
      businessType: org.businessType,
      country: org.country,
      currency: org.currency,
      minimumOperatingReserve: Number(org.minimumOperatingReserve),
      defaultTaxReserveRate: Number(org.defaultTaxReserveRate),
    },
    period: { year: new Date().getFullYear(), asOf: new Date().toISOString().slice(0, 10) },
    cash: summary.cash,
    revenue: summary.revenue,
    expenses: summary.expenses,
    profitYtd: summary.profitYtd,
    accountsReceivable: summary.accountsReceivable,
    taxReserve: summary.taxReserve,
    forecast,
    topClientsYtd: byClient.slice(0, 8),
    expenseCategoriesYtd: expenseCats.slice(0, 8),
    receivablesAging: {
      buckets: Object.fromEntries(Object.entries(aging.buckets).map(([k, v]) => [k, Number(v)])),
      counts: aging.counts,
    },
    upcomingTaxPayments: upcoming.map((t) => ({
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
