import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getConsolidatedTaxReserveStatus, getOwnerTaxPlanning } from "@/services/tax-planning";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, taxStatusToBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { Money } from "@/components/ui/money";
import { MetricTile, MetricGroup } from "@/components/ui/metric-tile";
import { formatMoney, formatPercent } from "@/lib/money/money";
import { formatDate, usQuarterlyTaxDates, daysUntil } from "@/lib/dates/dates";
import { TaxPaymentDialog } from "./tax-payment-dialog";
import { ReserveRateDialog } from "./reserve-rate-dialog";
import { EarmarkedReserveDialog } from "./earmarked-reserve-dialog";
import { OwnerTaxCard } from "./owner-tax-card";
import { QuarterlyPlannerFilters } from "./quarterly-filters";
import { AlertTriangle, Calendar, Plus } from "lucide-react";
import { initials } from "@/lib/utils";
import type { TaxAuthority } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function TaxesPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ owner?: string; authority?: string; year?: string }>;
}) {
  const { organizationSlug } = await params;
  const { owner: ownerFilter, authority: authorityFilter, year: yearParam } = await searchParams;
  const ctx = await requireOrgAccess(organizationSlug, "taxes:read");
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();

  const [org, planning, consolidated, taxPayments, owners] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: {
        currency: true,
        defaultTaxReserveRate: true,
        taxPlanningMode: true,
        taxReserveEarmarked: true,
      },
    }),
    getOwnerTaxPlanning({ organizationId: ctx.organizationId, year }),
    getConsolidatedTaxReserveStatus({ organizationId: ctx.organizationId, year }),
    prisma.taxPayment.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(ownerFilter && ownerFilter !== "all"
          ? ownerFilter === "org"
            ? { ownerId: null }
            : { ownerId: ownerFilter }
          : {}),
        ...(authorityFilter && authorityFilter !== "all"
          ? { authority: authorityFilter as TaxAuthority }
          : {}),
      },
      orderBy: { dueDate: "asc" },
      include: { owner: { select: { id: true, name: true } } },
    }),
    prisma.owner.findMany({
      where: { organizationId: ctx.organizationId, active: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const fedQuarterly = usQuarterlyTaxDates(year);
  const upcoming = taxPayments
    .filter((t) => t.status !== "PAID")
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 4);

  const fundingPct = consolidated.reserveTarget > 0
    ? Math.min(100, ((consolidated.taxesPaid + consolidated.earmarkedCash) / consolidated.reserveTarget) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tax planning center"
        title="How much to keep aside — and what's due next"
        description="Estimates based on business profit, allocated per owner. Planning only, not tax advice."
      />

      <Alert variant="warning" className="border-warning/20 bg-warning-soft/30">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Planning estimate — not tax advice</AlertTitle>
        <AlertDescription className="text-xs">
          LedgerFlow does not file taxes, calculate exact liability, or replace a CPA.
          Distributions are cash transfers to owners — they do not determine an owner&apos;s taxable share of business profit.
        </AlertDescription>
      </Alert>

      <MetricGroup columns={4}>
        <MetricTile
          label="Estimated profit YTD"
          value={<Money value={consolidated.estimatedBusinessProfit} currency={org.currency} size="lg" />}
          subValue="Payments − deductible business expenses"
          tooltip="Planning basis for tax reserves. Not a filed-return taxable income figure."
        />
        <MetricTile
          label="Tax reserve target"
          value={<Money value={consolidated.reserveTarget} currency={org.currency} size="lg" />}
          subValue={<>Sum across owners at {formatPercent(consolidated.defaultReserveRate, 1)} default</>}
        />
        <MetricTile
          label="Estimated payments made"
          value={<Money value={consolidated.taxesPaid} currency={org.currency} size="lg" tone="positive" />}
          subValue={`For ${year}, across all owners`}
        />
        <MetricTile
          label="Remaining reserve"
          value={<Money value={consolidated.remainingReserve} currency={org.currency} size="lg" />}
          subValue="max(0, target − payments made)"
          emphasis={consolidated.remainingReserve > 0 ? "warning" : "positive"}
        />
      </MetricGroup>

      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:p-8">
          <div>
            <div className="metric-label">Reserve funding</div>
            <div className="mt-2 flex items-baseline gap-2">
              <Money
                value={consolidated.taxesPaid + consolidated.earmarkedCash}
                currency={org.currency}
                size="xl"
                tone={fundingPct >= 100 ? "positive" : "default"}
              />
              <span className="text-sm text-muted-foreground">of {formatMoney(consolidated.reserveTarget, org.currency)} target</span>
            </div>
            <div className="mt-3">
              <Progress
                value={fundingPct}
                indicatorClassName={fundingPct >= 100 ? "bg-success" : fundingPct >= 75 ? "bg-primary" : "bg-warning"}
              />
              <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>{fundingPct.toFixed(0)}% funded (paid + earmarked)</span>
                <span>
                  {consolidated.fundingGap >= 0
                    ? `${formatMoney(consolidated.fundingGap, org.currency)} gap`
                    : `${formatMoney(-consolidated.fundingGap, org.currency)} surplus earmarked`}
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-surface/60 p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="metric-label">Cash earmarked</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <Money value={consolidated.earmarkedCash} currency={org.currency} size="lg" />
                  <EarmarkedReserveDialog
                    organizationSlug={organizationSlug}
                    current={consolidated.earmarkedCash}
                  />
                </div>
                <div className="mt-1 text-2xs text-muted-foreground">
                  Earmarked cash stays in recorded cash but is protected from distribution.
                </div>
              </div>
              <div>
                <div className="metric-label">Unfunded reserve</div>
                <Money
                  value={consolidated.unfundedReserve}
                  currency={org.currency}
                  size="lg"
                  tone={consolidated.unfundedReserve > 0 ? "negative" : "positive"}
                  className="mt-1 block"
                />
                <div className="mt-1 text-2xs text-muted-foreground">
                  What reduces safe-to-distribute cash.
                </div>
              </div>
              <div>
                <div className="metric-label">Reserve rate (default)</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="num text-lg font-semibold">{formatPercent(consolidated.defaultReserveRate, 1)}</span>
                  <ReserveRateDialog organizationSlug={organizationSlug} current={consolidated.defaultReserveRate} />
                </div>
              </div>
              <div>
                <div className="metric-label">Planning mode</div>
                <div className="mt-1 text-sm font-semibold">
                  {consolidated.reserveMode === "ADVANCED" ? "Advanced" : "Simple"}
                </div>
                <div className="mt-0.5 text-2xs text-muted-foreground">
                  {consolidated.reserveMode === "ADVANCED"
                    ? "Per-owner state overrides in effect."
                    : "Single reserve rate with optional per-owner overrides."}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <SectionHeader
        title="Owner tax planning"
        description="Allocated profit and reserve calculated per owner. Ownership percentage drives allocation."
      />
      {planning.owners.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Add owners in Settings to see per-owner planning.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {planning.owners.map((o, i) => (
            <OwnerTaxCard
              key={o.ownerId}
              currency={org.currency}
              organizationSlug={organizationSlug}
              owner={o}
              colorIndex={i}
            />
          ))}
        </div>
      )}

      <SectionHeader
        title="Quarterly payment plan"
        description={`Suggested planning schedule for ${year}. Actual payment records are authoritative.`}
        actions={
          <TaxPaymentDialog
            organizationSlug={organizationSlug}
            owners={owners.map((o) => ({ id: o.id, name: o.name }))}
            currentYear={year}
            triggerLabel="Record payment"
          />
        }
      />
      <QuarterlyPlannerFilters
        basePath={`/app/${organizationSlug}/taxes`}
        owners={owners.map((o) => ({ id: o.id, name: o.name }))}
        activeOwner={ownerFilter ?? "all"}
        activeAuthority={authorityFilter ?? "all"}
        year={year}
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {fedQuarterly.map((d, i) => {
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

      {upcoming.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Upcoming payments</CardTitle></CardHeader>
          <CardContent>
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
                        <div className="mt-0.5 flex items-center gap-2 text-2xs text-muted-foreground">
                          <span>{formatDate(t.dueDate)}</span>
                          <span>·</span>
                          <span>{overdue ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today" : `In ${days} days`}</span>
                          {t.owner ? (
                            <>
                              <span>·</span>
                              <span className="chip chip-muted">
                                <span className="grid h-3 w-3 place-items-center rounded-full bg-primary/20 text-[8px] text-primary">
                                  {initials(t.owner.name)}
                                </span>
                                {t.owner.name}
                              </span>
                            </>
                          ) : (
                            <>
                              <span>·</span>
                              <span className="chip chip-muted">Organization</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {t.estimatedAmount ? (
                        <Money value={t.estimatedAmount} currency={org.currency} />
                      ) : (
                        <span className="text-2xs text-muted-foreground">Set amount</span>
                      )}
                      <div className="mt-1"><StatusBadge status={taxStatusToBadge(t.status)} size="sm" /></div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tax payments</CardTitle>
          <TaxPaymentDialog
            organizationSlug={organizationSlug}
            owners={owners.map((o) => ({ id: o.id, name: o.name }))}
            currentYear={year}
          />
        </CardHeader>
        <CardContent className="p-0">
          {taxPayments.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nothing recorded yet for this filter.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scope</TableHead>
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
                      {t.owner ? (
                        <span className="chip chip-primary">{t.owner.name}</span>
                      ) : (
                        <span className="chip chip-muted">Organization</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{t.authority}</div>
                      {t.jurisdiction ? <div className="text-2xs text-muted-foreground">{t.jurisdiction}</div> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div>{t.description ?? "—"}</div>
                      {t.taxYear ? <div className="text-2xs">{t.taxYear}{t.taxPeriod ? ` · ${t.taxPeriod}` : ""}</div> : null}
                    </TableCell>
                    <TableCell>{formatDate(t.dueDate)}</TableCell>
                    <TableCell>{t.paidDate ? formatDate(t.paidDate) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Money
                        value={Number(t.amountPaid) > 0 ? t.amountPaid : (t.estimatedAmount ?? 0)}
                        currency={org.currency}
                      />
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
