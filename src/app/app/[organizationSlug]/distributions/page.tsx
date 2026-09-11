import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getOwnerDistributionSummary, getAvailableToDistribute } from "@/services/financial-metrics";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatPercent, toNumber } from "@/lib/money/money";
import { formatDate } from "@/lib/dates/dates";
import { DistributionDialog } from "./distribution-dialog";
import { HandCoins } from "lucide-react";

export const dynamic = "force-dynamic";

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
  return (
    <div>
      <PageHeader
        title="Owner distributions"
        description="Track and plan distributions across owners."
        actions={
          <DistributionDialog
            organizationSlug={organizationSlug}
            owners={owners.map((o) => ({ id: o.id, name: o.name }))}
            defaultOpen={Boolean(openNew)}
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Recommended distributable pool"
          value={formatMoney(available.available, org.currency)}
          hint="Recorded cash − tax reserve − operating reserve"
        />
        <MetricCard label="Active owners" value={String(owners.length)} />
        <MetricCard
          label="Distributed YTD"
          value={formatMoney(
            summary.reduce((s, o) => s + o.actualYtd, 0),
            org.currency,
          )}
        />
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Recommended allocation</CardTitle></CardHeader>
        <CardContent>
          {summary.length === 0 ? (
            <EmptyState title="No owners yet" description="Add owners in Settings to see recommended allocations." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>Distribution %</TableHead>
                  <TableHead className="text-right">Recommended</TableHead>
                  <TableHead className="text-right">Actual YTD</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((o) => (
                  <TableRow key={o.ownerId}>
                    <TableCell>{o.name}</TableCell>
                    <TableCell><Badge variant="muted">{formatPercent(o.distributionPercentage, 1)}</Badge></TableCell>
                    <TableCell className="text-right num">{formatMoney(o.recommendedDistribution, org.currency)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(o.actualYtd, org.currency)}</TableCell>
                    <TableCell className={`text-right num ${o.variance < 0 ? "text-warning" : ""}`}>
                      {formatMoney(o.variance, org.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Distribution history</CardTitle></CardHeader>
        <CardContent>
          {distributions.length === 0 ? (
            <EmptyState
              icon={<HandCoins className="h-8 w-8" />}
              title="No distributions yet"
              description="Record a distribution to owners."
            />
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
                    <TableCell className="text-xs text-muted-foreground">{d.memo ?? "—"}</TableCell>
                    <TableCell className="text-right num">{formatMoney(d.amount, org.currency)}</TableCell>
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
