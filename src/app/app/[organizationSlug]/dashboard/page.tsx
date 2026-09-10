import Link from "next/link";
import { requireOrgAccess } from "@/lib/auth/session";
import {
  getDashboardSummary,
  getRevenueVsExpensesSeries,
  getRevenueByClient,
  getExpenseBreakdown,
  getClientConcentration,
} from "@/services/financial-metrics";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { SafeToSpendCard } from "@/components/safe-to-spend-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RevenueExpenseChart } from "@/components/charts/revenue-expense-chart";
import { CategoryDonut } from "@/components/charts/category-donut";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatPercent } from "@/lib/money/money";
import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/dates/dates";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const ctx = await requireOrgAccess(organizationSlug);

  const [summary, revExp, revByClient, expBreakdown, concentration, recent] = await Promise.all([
    getDashboardSummary({ organizationId: ctx.organizationId }),
    getRevenueVsExpensesSeries({ organizationId: ctx.organizationId }, 12),
    getRevenueByClient({ organizationId: ctx.organizationId }),
    getExpenseBreakdown({ organizationId: ctx.organizationId }),
    getClientConcentration({ organizationId: ctx.organizationId }),
    prisma.activityLog.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const isEmpty =
    summary.revenue.ytd === 0 &&
    summary.expenses.ytd === 0 &&
    summary.accountsReceivable.outstanding === 0 &&
    summary.cash.recordedCash === 0;

  const currency = summary.currency;
  const base = `/app/${organizationSlug}`;

  const insights: { tone: "info" | "warning" | "destructive"; text: string }[] = [];
  if (summary.accountsReceivable.overdue > 0) {
    insights.push({
      tone: "destructive",
      text: `${formatMoney(summary.accountsReceivable.overdue, currency)} across ${summary.accountsReceivable.overdueCount} invoice(s) is overdue.`,
    });
  } else if (summary.accountsReceivable.outstanding > 0) {
    insights.push({
      tone: "info",
      text: `You have ${formatMoney(summary.accountsReceivable.outstanding, currency)} in outstanding invoices.`,
    });
  }
  if (summary.taxReserve.remaining > 0 && summary.cash.recordedCash < summary.taxReserve.remaining) {
    insights.push({
      tone: "warning",
      text: `Recorded cash (${formatMoney(summary.cash.recordedCash, currency)}) is below the remaining tax reserve target (${formatMoney(summary.taxReserve.remaining, currency)}).`,
    });
  }
  if (concentration.topClientShare >= 50) {
    insights.push({
      tone: "warning",
      text: `${concentration.topClientName} represents ${formatPercent(concentration.topClientShare)} of recorded YTD revenue.`,
    });
  }

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Where your money is, what belongs to taxes, and what is actually yours to spend."
        actions={
          <>
            <Button asChild variant="outline"><Link href={`${base}/assistant`}><Sparkles className="h-4 w-4" /> Ask assistant</Link></Button>
            <Button asChild><Link href={`${base}/invoices/new`}>New invoice</Link></Button>
          </>
        }
      />

      {isEmpty ? (
        <EmptyState
          title="Your dashboard will fill in as you record activity."
          description="Add a client, create an invoice, and record a payment to see cash, revenue, expenses, and tax planning in one place."
          action={
            <div className="flex gap-2">
              <Button asChild><Link href={`${base}/clients?new=1`}>Add client</Link></Button>
              <Button asChild variant="outline"><Link href={`${base}/invoices/new`}>Create invoice</Link></Button>
            </div>
          }
        />
      ) : null}

      {/* Top: Safe-to-spend + key numbers */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <SafeToSpendCard
            currency={currency}
            recordedCash={summary.cash.recordedCash}
            taxReserveRemaining={summary.cash.taxReserveRemaining}
            operatingReserve={summary.cash.operatingReserve}
            available={summary.cash.available}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <MetricCard
            label="Revenue YTD"
            value={formatMoney(summary.revenue.ytd, currency)}
            hint={`${formatMoney(summary.revenue.thisMonth, currency)} this month`}
            tooltip="Sum of payments recorded this calendar year."
          />
          <MetricCard
            label="Expenses YTD"
            value={formatMoney(summary.expenses.ytd, currency)}
            hint={`${formatMoney(summary.expenses.thisMonth, currency)} this month`}
            tooltip="Recorded business expenses (excluding personal)."
          />
          <MetricCard
            label="Estimated profit YTD"
            value={formatMoney(summary.profitYtd, currency)}
            hint="Payments minus deductible expenses"
            emphasis={summary.profitYtd >= 0 ? "positive" : "danger"}
            tooltip={`Estimated profit YTD
= YTD payments received
− YTD deductible business expenses

This is a planning estimate, not a GAAP financial statement.`}
          />
          <MetricCard
            label="Outstanding invoices"
            value={formatMoney(summary.accountsReceivable.outstanding, currency)}
            hint={`${summary.accountsReceivable.openInvoiceCount} open, ${summary.accountsReceivable.overdueCount} overdue`}
            emphasis={summary.accountsReceivable.overdue > 0 ? "warning" : "default"}
            tooltip="Sum of balance due across invoices not yet fully paid."
          />
          <MetricCard
            label="Tax reserve target"
            value={formatMoney(summary.taxReserve.reserveTarget, currency)}
            hint={`Rate ${formatPercent(summary.taxReserve.reserveRate, 1)} · paid ${formatMoney(summary.taxReserve.taxesPaid, currency)}`}
            tooltip={`Tax reserve target
= max(0, estimated profit × reserve %).

Planning estimate. Not tax advice.`}
          />
          <MetricCard
            label="Tax reserve remaining"
            value={formatMoney(summary.taxReserve.remaining, currency)}
            emphasis={summary.taxReserve.remaining > 0 ? "warning" : "positive"}
            hint="Amount still to set aside for estimated taxes"
            tooltip="max(0, reserve target − estimated tax payments recorded)."
          />
        </div>
      </div>

      {insights.length > 0 && (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {insights.map((i, idx) => (
            <Alert key={idx} variant={i.tone === "destructive" ? "destructive" : i.tone === "warning" ? "warning" : "info"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{i.text}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue vs. expenses — last 12 months</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueExpenseChart data={revExp} currency={currency} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expenses by category (YTD)</CardTitle>
          </CardHeader>
          <CardContent>
            {expBreakdown.length ? (
              <CategoryDonut data={expBreakdown} currency={currency} />
            ) : (
              <p className="text-sm text-muted-foreground">No expenses yet this year.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Revenue by client (YTD)</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href={`${base}/reports`}>All reports <ArrowRight className="h-4 w-4" /></Link></Button>
          </CardHeader>
          <CardContent>
            {revByClient.length === 0 ? (
              <p className="text-sm text-muted-foreground">No revenue recorded this year yet.</p>
            ) : (
              <ul className="space-y-2">
                {revByClient.slice(0, 6).map((c) => (
                  <li key={c.clientId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.companyName}</span>
                      <Badge variant="muted">{formatPercent(c.share)}</Badge>
                    </div>
                    <span className="num">{formatMoney(c.revenue, currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Activity will appear here as you use the app.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {recent.map((r) => (
                  <li key={r.id} className="border-b pb-2 last:border-none">
                    <div>{r.message}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(r.createdAt, "MMM d, h:mm a")}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
