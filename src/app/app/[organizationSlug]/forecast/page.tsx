import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getForecast } from "@/services/financial-metrics";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatMoney } from "@/lib/money/money";
import { Info } from "lucide-react";

export const dynamic = "force-dynamic";

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
  const scenarios = {
    conservative: 0.85,
    base: 1.0,
    optimistic: 1.15,
  };
  return (
    <div>
      <PageHeader
        title="Forecast"
        description="Simple run-rate projections based on recorded activity."
      />
      <Alert variant="info" className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Forecasts extrapolate from recent months. They are planning estimates, not guarantees.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Avg monthly revenue" value={formatMoney(base.averageMonthlyRevenue, org.currency)} />
        <MetricCard label="Avg monthly expenses" value={formatMoney(base.averageMonthlyExpenses, org.currency)} />
        <MetricCard label="Projected annual profit" value={formatMoney(base.projectedProfit, org.currency)} emphasis="positive" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {Object.entries(scenarios).map(([label, factor]) => {
          const rev = base.projectedRevenue * factor;
          const exp = base.projectedExpenses * (factor === 1 ? 1 : factor === 0.85 ? 1.05 : 0.95);
          const profit = rev - exp;
          return (
            <Card key={label}>
              <CardHeader className="capitalize"><CardTitle>{label}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Revenue" value={formatMoney(rev, org.currency)} />
                <Row label="Expenses" value={formatMoney(exp, org.currency)} />
                <Row label="Profit" value={formatMoney(profit, org.currency)} bold />
                <Row label="Est. tax reserve" value={formatMoney(Math.max(0, profit * base.projectedTaxReserve / (base.projectedProfit || 1)), org.currency)} />
                <Row label="Net after tax" value={formatMoney(profit - Math.max(0, profit * base.projectedTaxReserve / (base.projectedProfit || 1)), org.currency)} bold />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={`num ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
