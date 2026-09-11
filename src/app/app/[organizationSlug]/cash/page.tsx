import Link from "next/link";
import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  getAvailableToDistribute,
  getTaxReserveStatus,
  getTotalDistributions,
  getTotalExpensesAllTime,
  getTotalPayments,
  getTotalTaxPayments,
} from "@/services/financial-metrics";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { FinancialClarityHero } from "@/components/financial-clarity-hero";
import { MetricTile } from "@/components/ui/metric-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { formatMoney, toNumber } from "@/lib/money/money";
import { formatDate } from "@/lib/dates/dates";
import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function CashPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const ctx = await requireOrgAccess(organizationSlug);
  const [
    org,
    available,
    tax,
    payments,
    expenses,
    distributions,
    taxes,
    recentPayments,
    recentExpenses,
    recentTax,
    recentDistributions,
  ] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: {
        currency: true,
        openingBalance: true,
        minimumOperatingReserve: true,
      },
    }),
    getAvailableToDistribute({ organizationId: ctx.organizationId }),
    getTaxReserveStatus({ organizationId: ctx.organizationId }),
    getTotalPayments({ organizationId: ctx.organizationId }),
    getTotalExpensesAllTime({ organizationId: ctx.organizationId }),
    getTotalDistributions({ organizationId: ctx.organizationId }),
    getTotalTaxPayments({ organizationId: ctx.organizationId }),
    prisma.payment.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { date: "desc" }, take: 5,
      include: { client: { select: { companyName: true } }, invoice: { select: { invoiceNumber: true } } },
    }),
    prisma.expense.findMany({
      where: { organizationId: ctx.organizationId, isPersonal: false },
      orderBy: { date: "desc" }, take: 5,
    }),
    prisma.taxPayment.findMany({
      where: { organizationId: ctx.organizationId, amountPaid: { gt: 0 } },
      orderBy: { paidDate: "desc" }, take: 3,
    }),
    prisma.distribution.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { date: "desc" }, take: 3,
      include: { owner: { select: { name: true } } },
    }),
  ]);

  type FeedRow = {
    id: string;
    date: Date;
    kind: "in" | "out";
    label: string;
    detail?: string;
    amount: number;
  };
  const feed: FeedRow[] = [
    ...recentPayments.map((p) => ({
      id: `p-${p.id}`, date: p.date, kind: "in" as const,
      label: p.invoice ? `Payment · ${p.invoice.invoiceNumber}` : "Payment received",
      detail: p.client?.companyName ?? undefined,
      amount: toNumber(p.amount),
    })),
    ...recentExpenses.map((e) => ({
      id: `e-${e.id}`, date: e.date, kind: "out" as const,
      label: e.description, amount: toNumber(e.amount),
    })),
    ...recentTax.map((t) => ({
      id: `t-${t.id}`, date: t.paidDate ?? t.dueDate, kind: "out" as const,
      label: `Tax payment · ${t.authority}`, detail: t.description ?? undefined,
      amount: toNumber(t.amountPaid),
    })),
    ...recentDistributions.map((d) => ({
      id: `d-${d.id}`, date: d.date, kind: "out" as const,
      label: `Distribution · ${d.owner.name}`,
      amount: toNumber(d.amount),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 12);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cash clarity"
        title="What you actually have to spend"
        description="A recorded cash view — bank sync is not connected."
      />

      <FinancialClarityHero
        currency={org.currency}
        recordedCash={toNumber(available.recordedCash)}
        taxReserveRemaining={toNumber(available.taxReserveRemaining)}
        operatingReserve={toNumber(available.operatingReserve)}
        available={toNumber(available.available)}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recorded cash breakdown</CardTitle>
            <p className="text-xs text-muted-foreground">All-time inflows minus outflows against your opening balance.</p>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <FormulaLine label="Opening balance" amount={toNumber(org.openingBalance)} currency={org.currency} kind="neutral" />
              <FormulaLine label="Payments received" amount={toNumber(payments)} currency={org.currency} kind="in" />
              <FormulaLine label="Business expenses" amount={toNumber(expenses)} currency={org.currency} kind="out" />
              <FormulaLine label="Owner distributions" amount={toNumber(distributions)} currency={org.currency} kind="out" />
              <FormulaLine label="Tax payments" amount={toNumber(taxes)} currency={org.currency} kind="out" />
              <div className="flex items-baseline justify-between pt-3">
                <div className="text-sm font-semibold">Recorded cash</div>
                <Money value={available.recordedCash} currency={org.currency} size="lg" />
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <MetricTile
            label="Tax reserve remaining"
            value={formatMoney(tax.remaining, org.currency)}
            subValue={`Reserve rate ${tax.reserveRate.toString()}%`}
            emphasis={toNumber(tax.remaining) > 0 ? "warning" : "positive"}
          />
          <MetricTile
            label="Operating reserve"
            value={formatMoney(org.minimumOperatingReserve, org.currency)}
            subValue={
              <Link className="text-primary hover:underline" href="../settings">
                Configure in settings →
              </Link>
            }
          />
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Recorded cash is derived from what you&apos;ve entered in LedgerFlow. Connect a bank feed later to reconcile automatically.
            </AlertDescription>
          </Alert>
        </div>
      </div>

      <div>
        <SectionHeader title="Cash activity" description="Recent inflows and outflows recorded in LedgerFlow." />
        <Card>
          <CardContent className="p-0">
            {feed.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No cash activity recorded yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {feed.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 px-5 py-3">
                    <div
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                        row.kind === "in" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {row.kind === "in" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{row.label}</div>
                      {row.detail ? <div className="truncate text-2xs text-muted-foreground">{row.detail}</div> : null}
                    </div>
                    <div className="text-right">
                      <Money
                        value={row.amount}
                        currency={org.currency}
                        tone={row.kind === "in" ? "positive" : "negative"}
                        signed
                      />
                      <div className="text-2xs text-muted-foreground">{formatDate(row.date)}</div>
                    </div>
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

function FormulaLine({
  label,
  amount,
  currency,
  kind,
}: {
  label: string;
  amount: number;
  currency: string;
  kind: "in" | "out" | "neutral";
}) {
  const prefix = kind === "in" ? "+" : kind === "out" ? "−" : "";
  return (
    <div className="flex items-baseline justify-between py-2.5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`num text-sm font-medium ${kind === "out" ? "text-muted-foreground" : "text-foreground"}`}>
        {prefix} {formatMoney(amount, currency)}
      </div>
    </div>
  );
}
