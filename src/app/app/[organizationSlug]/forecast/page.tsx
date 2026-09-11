import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getForecast } from "@/services/financial-metrics";
import { PageHeader } from "@/components/page-header";
import { MetricTile, MetricGroup } from "@/components/ui/metric-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Money } from "@/components/ui/money";
import { formatMoney } from "@/lib/money/money";
import { Info } from "lucide-react";

export const dynamic = "force-dynamic";

const SCENARIOS = [
  { key: "conservative", label: "Conservative", revenue: 0.85, expenses: 1.05, description: "Revenue misses by 15%, expenses drift up 5%." },
  { key: "base",         label: "Base",         revenue: 1.00, expenses: 1.00, description: "Recent months continue at their current pace." },
  { key: "optimistic",   label: "Optimistic",   revenue: 1.15, expenses: 0.95, description: "Revenue exceeds by 15%, expenses tighten 5%." },
];

export default async function ForecastPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const ctx = await requireOrgAccess(organizationSlug, "reports:read");
  const [org, base] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true },
    }),
    getForecast({ organizationId: ctx.organizationId }),
  ]);

  const taxRateFromBase = base.projectedProfit > 0 ? base.projectedTaxReserve / base.projectedProfit : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Forecast"
        title="Where the year is heading"
        description="Deterministic run-rate projections from your recent months."
      />

      <Alert variant="info">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Forecasts extrapolate from months with recorded activity. Adjust scenarios by changing the projection factor.
          These are planning estimates, not guarantees.
        </AlertDescription>
      </Alert>

      <MetricGroup columns={3}>
        <MetricTile
          label="Average monthly revenue"
          value={formatMoney(base.averageMonthlyRevenue, org.currency)}
          subValue="From active months"
        />
        <MetricTile
          label="Average monthly expenses"
          value={formatMoney(base.averageMonthlyExpenses, org.currency)}
          subValue="Business only, deductible"
        />
        <MetricTile
          label="Projected annual profit"
          value={formatMoney(base.projectedProfit, org.currency)}
          subValue={`Net after tax reserve: ${formatMoney(base.projectedNetAfterTax, org.currency)}`}
          emphasis={base.projectedProfit >= 0 ? "positive" : "danger"}
        />
      </MetricGroup>

      <div className="grid gap-4 md:grid-cols-3">
        {SCENARIOS.map((s) => {
          const rev = base.projectedRevenue * s.revenue;
          const exp = base.projectedExpenses * s.expenses;
          const profit = rev - exp;
          const tax = Math.max(0, profit * taxRateFromBase);
          const net = profit - tax;
          const isBase = s.key === "base";
          return (
            <Card key={s.key} className={isBase ? "border-primary/40 ring-1 ring-primary/20" : undefined}>
              <CardHeader className="border-b pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{s.label}</CardTitle>
                  {isBase ? (
                    <span className="chip chip-primary">Baseline</span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                <Row label="Revenue" value={formatMoney(rev, org.currency)} />
                <Row label="Expenses" value={`− ${formatMoney(exp, org.currency)}`} muted />
                <div className="border-t border-border pt-3">
                  <Row label="Profit" value={<Money value={profit} currency={org.currency} tone={profit >= 0 ? "positive" : "negative"} />} bold />
                </div>
                <Row label="Est. tax reserve" value={`− ${formatMoney(tax, org.currency)}`} muted />
                <div className="border-t border-border pt-3">
                  <Row label="Net after tax" value={<Money value={net} currency={org.currency} size="lg" tone={net >= 0 ? "positive" : "negative"} />} bold />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: React.ReactNode; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className={bold ? "font-semibold" : muted ? "text-muted-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={`num ${bold ? "font-semibold" : muted ? "text-muted-foreground" : "font-medium"}`}>{value}</span>
    </div>
  );
}
