import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getOwnerDistributionSummary, getAvailableToDistribute } from "@/services/financial-metrics";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Money } from "@/components/ui/money";
import { CashAllocationBar } from "@/components/ui/cash-allocation-bar";
import { formatMoney, formatPercent, toNumber } from "@/lib/money/money";
import { formatDate } from "@/lib/dates/dates";
import { DistributionDialog } from "./distribution-dialog";
import { HandCoins } from "lucide-react";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

const OWNER_COLORS = ["bg-primary", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-chart-6"];

export default async function DistributionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { organizationSlug } = await params;
  const { new: openNew } = await searchParams;
  const ctx = await requireOrgAccess(organizationSlug, "distributions:read");
  const [org, owners, summary, available, distributions] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true },
    }),
    prisma.owner.findMany({
      where: { organizationId: ctx.organizationId, active: true },
      orderBy: { createdAt: "asc" },
    }),
    getOwnerDistributionSummary({ organizationId: ctx.organizationId }),
    getAvailableToDistribute({ organizationId: ctx.organizationId }),
    prisma.distribution.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { date: "desc" },
      include: { owner: { select: { name: true } } },
      take: 50,
    }),
  ]);

  const pool = toNumber(available.available);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Owner distributions"
        title="How much can owners safely take?"
        description="Recommended allocations from the shared distributable pool."
        actions={
          <DistributionDialog
            organizationSlug={organizationSlug}
            owners={owners.map((o) => ({ id: o.id, name: o.name }))}
            defaultOpen={Boolean(openNew)}
          />
        }
      />

      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:p-8">
          <div>
            <div className="metric-label">Distributable pool</div>
            <Money value={pool} currency={org.currency} size="hero" tone={pool > 0 ? "positive" : "default"} />
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Recorded cash minus tax reserve and operating reserve. Split by each owner&apos;s distribution percentage.
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-surface/60 p-5">
            <div className="metric-label mb-3">Recommended split</div>
            {summary.length > 0 ? (
              <CashAllocationBar
                currency={org.currency}
                segments={summary.map((o, i) => ({
                  key: o.ownerId,
                  label: o.name,
                  amount: o.recommendedDistribution,
                  color: OWNER_COLORS[i % OWNER_COLORS.length],
                }))}
                showLegend
              />
            ) : (
              <div className="text-sm text-muted-foreground">Add owners to see recommended splits.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <SectionHeader title="Allocation vs. actual YTD" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {summary.map((o, i) => {
          const target = o.recommendedDistribution;
          const gap = o.actualYtd - target;
          return (
            <Card key={o.ownerId} className="p-5">
              <div className="flex items-center gap-3">
                <div className={`grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white ${OWNER_COLORS[i % OWNER_COLORS.length]}`}>
                  {initials(o.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{o.name}</div>
                  <div className="text-2xs text-muted-foreground">
                    {formatPercent(o.distributionPercentage, 1)} distribution · {formatPercent(o.ownershipPercentage, 1)} ownership
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <Row label="Recommended" value={formatMoney(target, org.currency)} />
                <Row label="Actual YTD" value={formatMoney(o.actualYtd, org.currency)} />
                <Row
                  label="Variance"
                  value={
                    <span className={gap < 0 ? "text-warning" : gap > 0 ? "text-primary" : ""}>
                      {gap >= 0 ? "+" : "−"} {formatMoney(Math.abs(gap), org.currency)}
                    </span>
                  }
                />
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Distribution history</CardTitle></CardHeader>
        <CardContent className="p-0">
          {distributions.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<HandCoins className="h-6 w-6" />}
                title="No distributions yet"
                description="Record distributions to owners here. They'll reduce recorded cash and appear in the cash activity feed."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributions.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{formatDate(d.date)}</TableCell>
                    <TableCell>{d.owner.name}</TableCell>
                    <TableCell className="text-muted-foreground">{d.memo ?? "—"}</TableCell>
                    <TableCell className="text-right"><Money value={d.amount} currency={org.currency} /></TableCell>
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="num font-medium">{value}</span>
    </div>
  );
}
