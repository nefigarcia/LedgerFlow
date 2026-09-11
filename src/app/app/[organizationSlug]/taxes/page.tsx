import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getTaxReserveStatus, getOperatingProfitYTD } from "@/services/financial-metrics";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, taxStatusToBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { Money } from "@/components/ui/money";
import { formatMoney, formatPercent, toNumber } from "@/lib/money/money";
import { formatDate, usQuarterlyTaxDates, daysUntil } from "@/lib/dates/dates";
import { TaxPaymentDialog } from "./tax-payment-dialog";
import { ReserveRateDialog } from "./reserve-rate-dialog";
import { AlertTriangle, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TaxesPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const ctx = await requireOrgAccess(organizationSlug, "taxes:read");
  const [org, tax, profit, taxPayments, owners] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true, defaultTaxReserveRate: true },
    }),
    getTaxReserveStatus({ organizationId: ctx.organizationId }),
    getOperatingProfitYTD({ organizationId: ctx.organizationId }),
    prisma.taxPayment.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { dueDate: "asc" },
    }),
    prisma.owner.findMany({
      where: { organizationId: ctx.organizationId, active: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const year = new Date().getFullYear();
  const federalDefaults = usQuarterlyTaxDates(year);
  const pct = toNumber(tax.reserveTarget) > 0
    ? Math.min(100, (toNumber(tax.taxesPaid) / toNumber(tax.reserveTarget)) * 100)
    : 0;

  const upcoming = taxPayments
    .filter((t) => t.status !== "PAID")
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tax planning"
        title="How much to keep aside — and what's due next"
        description="Estimates based on the profit and reserve rate you've configured."
      />

      <Alert variant="warning" className="border-warning/20 bg-warning-soft/30">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Planning estimates only</AlertTitle>
        <AlertDescription className="text-xs">
          Not tax, legal, or accounting advice. Consult a qualified tax professional for filing decisions.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:p-8">
          <div>
            <div className="metric-label">Reserve status</div>
            <div className="mt-2 flex items-baseline gap-2">
              <Money value={tax.taxesPaid} currency={org.currency} size="xl" tone={pct >= 100 ? "positive" : "default"} />
              <span className="text-sm text-muted-foreground">of {formatMoney(tax.reserveTarget, org.currency)} target</span>
            </div>
            <div className="mt-3">
              <Progress
                value={pct}
                indicatorClassName={pct >= 100 ? "bg-success" : pct >= 75 ? "bg-primary" : "bg-warning"}
              />
              <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>{pct.toFixed(0)}% funded</span>
                <span>{formatMoney(tax.remaining, org.currency)} remaining</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="metric-label">Estimated profit YTD</div>
              <Money value={profit.profit} currency={org.currency} size="lg" className="mt-1 block" />
              <div className="mt-1 text-2xs text-muted-foreground">Payments − deductible expenses</div>
            </div>
            <div>
              <div className="metric-label">Reserve rate</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="num text-xl font-semibold">{formatPercent(tax.reserveRate, 1)}</span>
                <ReserveRateDialog organizationSlug={organizationSlug} current={Number(tax.reserveRate)} />
              </div>
              <div className="mt-1 text-2xs text-muted-foreground">Applied to estimated profit</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Owner reserve allocation</CardTitle></CardHeader>
          <CardContent>
            {owners.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add owners to see per-owner estimates.</p>
            ) : (
              <ul className="space-y-3">
                {owners.map((o) => {
                  const rate = Number(o.taxReserveOverride ?? tax.reserveRate);
                  const share = Number(o.ownershipPercentage) / 100;
                  const est = Math.max(0, Number(profit.profit) * share * (rate / 100));
                  return (
                    <li key={o.id} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{o.name}</div>
                        <div className="text-2xs text-muted-foreground">
                          {Number(o.ownershipPercentage)}% × {rate}%
                        </div>
                      </div>
                      <Money value={est} currency={org.currency} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming payments</CardTitle>
            <TaxPaymentDialog organizationSlug={organizationSlug} />
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No tracked upcoming payments. Add one from your quarterly schedule below.
              </div>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((t) => {
                  const days = daysUntil(t.dueDate);
                  const overdue = days < 0;
                  return (
                    <li key={t.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-surface p-3">
                      <div className="flex items-center gap-3">
                        <div className={`grid h-9 w-9 place-items-center rounded-md ${overdue ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">
                            {t.description ?? `${t.authority} estimated payment`}
                          </div>
                          <div className="text-2xs text-muted-foreground">
                            {formatDate(t.dueDate)} · {overdue ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today" : `In ${days} days`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {t.estimatedAmount ? (
                          <Money value={t.estimatedAmount} currency={org.currency} />
                        ) : <span className="text-2xs text-muted-foreground">Set amount</span>}
                        <div className="mt-1"><StatusBadge status={taxStatusToBadge(t.status)} size="sm" /></div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <SectionHeader title="US federal quarterly defaults" description={`Editable schedule for ${year}.`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {federalDefaults.map((d, i) => {
          const days = daysUntil(d);
          return (
            <div key={d.toISOString()} className="panel p-4">
              <div className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">Q{i + 1}</div>
              <div className="mt-1 text-sm font-semibold">{formatDate(d, "MMM d, yyyy")}</div>
              <div className="mt-0.5 text-2xs text-muted-foreground">
                {days < 0 ? "Past" : days === 0 ? "Today" : `In ${days} days`}
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All tax payments</CardTitle>
          <TaxPaymentDialog organizationSlug={organizationSlug} />
        </CardHeader>
        <CardContent className="p-0">
          {taxPayments.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nothing recorded yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Authority</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxPayments.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{t.authority}</div>
                      {t.jurisdiction ? <div className="text-2xs text-muted-foreground">{t.jurisdiction}</div> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.description ?? "—"}</TableCell>
                    <TableCell>{formatDate(t.dueDate)}</TableCell>
                    <TableCell>{t.paidDate ? formatDate(t.paidDate) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Money value={Number(t.amountPaid) > 0 ? t.amountPaid : (t.estimatedAmount ?? 0)} currency={org.currency} />
                    </TableCell>
                    <TableCell><StatusBadge status={taxStatusToBadge(t.status)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
