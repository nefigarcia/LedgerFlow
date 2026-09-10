import Link from "next/link";
import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  getAvailableToDistribute,
  getRecordedCash,
  getTaxReserveStatus,
  getTotalDistributions,
  getTotalExpensesAllTime,
  getTotalPayments,
  getTotalTaxPayments,
} from "@/services/financial-metrics";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { SafeToSpendCard } from "@/components/safe-to-spend-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, toNumber } from "@/lib/money/money";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CashPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const ctx = await requireOrgAccess(organizationSlug);
  const [org, cash, tax, available, payments, expenses, distributions, taxes] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true, openingBalance: true, minimumOperatingReserve: true, openingBalanceDate: true },
    }),
    getRecordedCash({ organizationId: ctx.organizationId }),
    getTaxReserveStatus({ organizationId: ctx.organizationId }),
    getAvailableToDistribute({ organizationId: ctx.organizationId }),
    getTotalPayments({ organizationId: ctx.organizationId }),
    getTotalExpensesAllTime({ organizationId: ctx.organizationId }),
    getTotalDistributions({ organizationId: ctx.organizationId }),
    getTotalTaxPayments({ organizationId: ctx.organizationId }),
  ]);
  return (
    <div>
      <PageHeader
        title="Cash clarity"
        description="What you have, what you owe to taxes, what you can safely spend."
      />
      <Alert variant="info" className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          This is a recorded cash position, not a live bank balance. Connect bank feeds later to
          keep this reconciled automatically.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-3">
        <SafeToSpendCard
          currency={org.currency}
          recordedCash={toNumber(available.recordedCash)}
          taxReserveRemaining={toNumber(available.taxReserveRemaining)}
          operatingReserve={toNumber(available.operatingReserve)}
          available={toNumber(available.available)}
        />
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>How recorded cash is computed</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                <Row label="Opening balance" value={formatMoney(org.openingBalance, org.currency)} />
                <Row label="+ Payments received" value={formatMoney(payments, org.currency)} />
                <Row label="− Business expenses" value={formatMoney(expenses, org.currency)} negative />
                <Row label="− Owner distributions" value={formatMoney(distributions, org.currency)} negative />
                <Row label="− Tax payments" value={formatMoney(taxes, org.currency)} negative />
                <tr>
                  <td colSpan={2} className="pt-2"><div className="border-t" /></td>
                </tr>
                <Row label="= Recorded cash" value={formatMoney(cash, org.currency)} bold />
              </tbody>
            </table>
            <p className="mt-4 text-xs text-muted-foreground">
              Set your opening balance and minimum operating reserve in Settings → Financial.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Tax reserve target"
          value={formatMoney(tax.reserveTarget, org.currency)}
          hint={`Reserve rate ${tax.reserveRate.toString()}%`}
        />
        <MetricCard
          label="Tax reserve remaining"
          value={formatMoney(tax.remaining, org.currency)}
          emphasis={toNumber(tax.remaining) > 0 ? "warning" : "positive"}
        />
        <MetricCard
          label="Minimum operating reserve"
          value={formatMoney(org.minimumOperatingReserve, org.currency)}
          hint={<Link className="text-primary hover:underline" href={`../settings`}>Change in settings →</Link>}
        />
      </div>
    </div>
  );
}

function Row({ label, value, bold, negative }: { label: string; value: string; bold?: boolean; negative?: boolean }) {
  return (
    <tr>
      <td className={`py-1.5 ${bold ? "font-semibold" : "text-muted-foreground"}`}>{label}</td>
      <td className={`py-1.5 text-right num ${bold ? "font-semibold" : ""} ${negative ? "" : ""}`}>{value}</td>
    </tr>
  );
}
