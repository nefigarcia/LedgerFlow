import Link from "next/link";
import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  getDashboardSummary,
  getRevenueVsExpensesSeries,
  getRevenueByClient,
  getExpenseBreakdown,
  getClientConcentration,
} from "@/services/financial-metrics";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { MetricTile, MetricGroup } from "@/components/ui/metric-tile";
import { FinancialClarityHero } from "@/components/financial-clarity-hero";
import { InsightCard } from "@/components/insight-card";
import { ActivityTimeline } from "@/components/activity-timeline";
import { BarList } from "@/components/bar-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { RevenueExpenseChart } from "@/components/charts/revenue-expense-chart";
import { CategoryDonut } from "@/components/charts/category-donut";
import { Progress } from "@/components/ui/progress";
import { formatMoney, formatPercent } from "@/lib/money/money";
import { ArrowRight, FileText, Sparkles } from "lucide-react";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const ctx = await requireOrgAccess(organizationSlug);
  const session = await getSession();
  const firstName = (session?.user?.name ?? "").split(" ")[0] || null;

  const [summary, revExp, revByClient, expBreakdown, concentration, recent, firstOverdue] = await Promise.all([
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
    prisma.invoice.findFirst({
      where: {
        organizationId: ctx.organizationId,
        status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] },
        dueDate: { lt: new Date() },
      },
      orderBy: { dueDate: "asc" },
      select: { id: true, invoiceNumber: true, dueDate: true },
    }),
  ]);

  const currency = summary.currency;
  const base = `/app/${organizationSlug}`;
  const isEmpty =
    summary.revenue.ytd === 0 &&
    summary.expenses.ytd === 0 &&
    summary.accountsReceivable.outstanding === 0 &&
    summary.cash.recordedCash === 0;

  const insights: Array<{ tone: "info" | "warning" | "danger" | "success"; title: string; description?: React.ReactNode; ctaLabel?: string; ctaHref?: string }> = [];

  if (summary.accountsReceivable.overdue > 0) {
    const title =
      summary.accountsReceivable.overdueCount === 1 && firstOverdue
        ? `Invoice ${firstOverdue.invoiceNumber} is overdue`
        : `${summary.accountsReceivable.overdueCount} invoices overdue`;
    insights.push({
      tone: "danger",
      title,
      description: `${formatMoney(summary.accountsReceivable.overdue, currency)} past due.`,
      ctaLabel: "Review invoices",
      ctaHref: firstOverdue ? `${base}/invoices/${firstOverdue.id}` : `${base}/invoices`,
    });
  }
  if (summary.taxReserve.remaining > 0 && summary.cash.recordedCash < summary.taxReserve.remaining) {
    insights.push({
      tone: "warning",
      title: "Recorded cash is below your tax reserve target",
      description: `Reserve ${formatMoney(summary.taxReserve.remaining, currency)} more before distributing.`,
      ctaLabel: "Open tax planning",
      ctaHref: `${base}/taxes`,
    });
  }
  if (concentration.topClientShare >= 50 && concentration.topClientName) {
    insights.push({
      tone: "info",
      title: `${concentration.topClientName} = ${formatPercent(concentration.topClientShare)} of YTD revenue`,
      description: "High client concentration can amplify revenue swings.",
      ctaLabel: "See revenue by client",
      ctaHref: `${base}/reports`,
    });
  }
  if (
    !isEmpty &&
    summary.accountsReceivable.overdue === 0 &&
    summary.taxReserve.remaining === 0 &&
    concentration.topClientShare < 50
  ) {
    insights.push({
      tone: "success",
      title: "Nothing needs your attention",
      description: "Reserves are funded and no invoices are overdue.",
    });
  }

  const taxProgress = summary.taxReserve.reserveTarget > 0
    ? Math.min(100, (summary.taxReserve.taxesPaid / summary.taxReserve.reserveTarget) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        title={firstName ? `${greeting()}, ${firstName}` : `${greeting()}`}
        description="Here's where your business stands today."
        actions={
          <>
            <Button asChild variant="outline" className="gap-1.5">
              <Link href={`${base}/assistant`}>
                <Sparkles className="h-4 w-4" /> Ask LedgerFlow
              </Link>
            </Button>
            <Button asChild className="gap-1.5">
              <Link href={`${base}/invoices/new`}>
                <FileText className="h-4 w-4" /> New invoice
              </Link>
            </Button>
          </>
        }
      />

      {isEmpty ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="Your dashboard fills in as you record activity"
          description="Add a client, create an invoice, and record a payment to see cash, revenue, expenses, and tax planning in one place."
          action={
            <Button asChild>
              <Link href={`${base}/clients?new=1`}>Add first client</Link>
            </Button>
          }
          secondary={
            <Button asChild variant="outline">
              <Link href={`${base}/invoices/new`}>Create invoice</Link>
            </Button>
          }
        />
      ) : (
        <>
          <FinancialClarityHero
            currency={currency}
            recordedCash={summary.cash.recordedCash}
            taxReserveRemaining={summary.cash.taxReserveRemaining}
            operatingReserve={summary.cash.operatingReserve}
            available={summary.cash.available}
            askHref={`${base}/assistant`}
          />

          <MetricGroup columns={4}>
            <MetricTile
              label="Revenue YTD"
              value={formatMoney(summary.revenue.ytd, currency)}
              subValue={<span>{formatMoney(summary.revenue.thisMonth, currency)} this month</span>}
              tooltip="Sum of payments recorded this calendar year."
            />
            <MetricTile
              label="Estimated profit"
              value={formatMoney(summary.profitYtd, currency)}
              subValue="Payments − deductible expenses"
              emphasis={summary.profitYtd >= 0 ? "positive" : "danger"}
              tooltip={`Estimated profit YTD
= YTD payments received − YTD deductible business expenses.

Planning estimate, not a GAAP financial statement.`}
            />
            <MetricTile
              label="Outstanding invoices"
              value={formatMoney(summary.accountsReceivable.outstanding, currency)}
              subValue={
                summary.accountsReceivable.overdue > 0 ? (
                  <span className="text-destructive">
                    {formatMoney(summary.accountsReceivable.overdue, currency)} overdue · {summary.accountsReceivable.overdueCount} invoice{summary.accountsReceivable.overdueCount === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span>{summary.accountsReceivable.openInvoiceCount} open</span>
                )
              }
              emphasis={summary.accountsReceivable.overdue > 0 ? "warning" : "default"}
            />
            <MetricTile
              label="Tax reserve"
              value={
                <span>
                  {formatMoney(summary.taxReserve.taxesPaid, currency)}
                  <span className="text-muted-foreground text-base font-normal"> / {formatMoney(summary.taxReserve.reserveTarget, currency)}</span>
                </span>
              }
              subValue={
                <div className="mt-1">
                  <Progress
                    value={taxProgress}
                    size="sm"
                    indicatorClassName={taxProgress >= 100 ? "bg-success" : "bg-primary"}
                  />
                  <div className="mt-1 text-2xs text-muted-foreground">
                    {taxProgress.toFixed(0)}% funded · {formatPercent(summary.taxReserve.reserveRate, 0)} rate
                  </div>
                </div>
              }
            />
          </MetricGroup>

          {insights.length > 0 && (
            <div>
              <SectionHeader title="Attention" description="What needs a look right now" />
              <div className="grid gap-3 md:grid-cols-2">
                {insights.map((i, idx) => (
                  <InsightCard key={idx} {...i} />
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Revenue vs. expenses</CardTitle>
                <p className="text-xs text-muted-foreground">Last 12 months</p>
              </CardHeader>
              <CardContent>
                <RevenueExpenseChart data={revExp} currency={currency} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Expenses by category</CardTitle>
                <p className="text-xs text-muted-foreground">Year to date</p>
              </CardHeader>
              <CardContent>
                {expBreakdown.length ? (
                  <CategoryDonut data={expBreakdown} currency={currency} />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">No expenses yet this year.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Revenue by client</CardTitle>
                  <p className="text-xs text-muted-foreground">Year to date</p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`${base}/reports`}>All reports <ArrowRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </CardHeader>
              <CardContent>
                {revByClient.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No revenue recorded this year yet.</p>
                ) : (
                  <BarList
                    rows={revByClient.map((c) => ({
                      key: c.clientId,
                      label: c.companyName,
                      value: c.revenue,
                      share: c.share,
                      href: `${base}/clients/${c.clientId}`,
                    }))}
                    currency={currency}
                    max={6}
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityTimeline
                  items={recent.map((r) => ({
                    id: r.id,
                    action: r.action,
                    entityType: r.entityType,
                    message: r.message,
                    createdAt: r.createdAt,
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
