import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getTaxReserveStatus, getOperatingProfitYTD } from "@/services/financial-metrics";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatPercent } from "@/lib/money/money";
import { formatDate, usQuarterlyTaxDates } from "@/lib/dates/dates";
import { TaxPaymentDialog } from "./tax-payment-dialog";
import { ReserveRateDialog } from "./reserve-rate-dialog";
import { AlertTriangle } from "lucide-react";

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

  return (
    <div>
      <PageHeader title="Tax planning" description="Reserve estimates and payment tracking." />

      <Alert variant="info" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Not tax advice</AlertTitle>
        <AlertDescription>
          Tax estimates are for planning only and are not tax, legal, or accounting advice.
          Consult a qualified tax professional regarding your specific situation.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Estimated profit YTD"
          value={formatMoney(profit.profit, org.currency)}
          hint="Payments − deductible expenses"
        />
        <MetricCard
          label="Reserve rate"
          value={formatPercent(tax.reserveRate, 1)}
          hint={<ReserveRateDialog organizationSlug={organizationSlug} current={Number(tax.reserveRate)} />}
        />
        <MetricCard
          label="Reserve target"
          value={formatMoney(tax.reserveTarget, org.currency)}
        />
        <MetricCard
          label="Reserve remaining"
          value={formatMoney(tax.remaining, org.currency)}
          emphasis="warning"
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Owner reserve allocation</CardTitle></CardHeader>
          <CardContent>
            {owners.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add owners to see per-owner estimates.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {owners.map((o) => {
                  const rate = Number(o.taxReserveOverride ?? tax.reserveRate);
                  const share = Number(o.ownershipPercentage) / 100;
                  const est = Number(profit.profit) * share * (rate / 100);
                  return (
                    <li key={o.id} className="flex items-center justify-between">
                      <span>
                        {o.name} <Badge variant="muted">{Number(o.ownershipPercentage)}%</Badge>
                      </span>
                      <span className="num">{formatMoney(Math.max(0, est), org.currency)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Suggested federal quarterly dates ({year})</CardTitle>
            <TaxPaymentDialog organizationSlug={organizationSlug} />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              These are configurable defaults for US federal estimated payments. Edit or replace them as your jurisdiction requires.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-3">
              {federalDefaults.map((d) => (
                <li key={d.toISOString()} className="rounded-md border p-3 text-sm">
                  <div className="font-medium">{formatDate(d)}</div>
                  <div className="text-xs text-muted-foreground">IRS estimated payment</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Tax payments</CardTitle>
          <TaxPaymentDialog organizationSlug={organizationSlug} />
        </CardHeader>
        <CardContent>
          {taxPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
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
                    <TableCell>{t.authority}{t.jurisdiction ? ` · ${t.jurisdiction}` : ""}</TableCell>
                    <TableCell>{t.description ?? "—"}</TableCell>
                    <TableCell>{formatDate(t.dueDate)}</TableCell>
                    <TableCell>{t.paidDate ? formatDate(t.paidDate) : "—"}</TableCell>
                    <TableCell className="text-right num">
                      {formatMoney(Number(t.amountPaid) > 0 ? t.amountPaid : (t.estimatedAmount ?? 0), org.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.status === "PAID"
                            ? "success"
                            : t.status === "OVERDUE"
                              ? "destructive"
                              : t.status === "DUE_SOON"
                                ? "warning"
                                : "secondary"
                        }
                      >
                        {t.status}
                      </Badge>
                    </TableCell>
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
