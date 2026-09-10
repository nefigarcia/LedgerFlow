import Link from "next/link";
import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  getARAging,
  getExpenseBreakdown,
  getOperatingProfitYTD,
  getRevenueByClient,
} from "@/services/financial-metrics";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatMoney, formatPercent, toNumber } from "@/lib/money/money";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const ctx = await requireOrgAccess(organizationSlug, "reports:read");
  const [org, profit, byClient, expenseBreakdown, aging] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true },
    }),
    getOperatingProfitYTD({ organizationId: ctx.organizationId }),
    getRevenueByClient({ organizationId: ctx.organizationId }),
    getExpenseBreakdown({ organizationId: ctx.organizationId }),
    getARAging({ organizationId: ctx.organizationId }),
  ]);
  const base = `/app/${organizationSlug}`;
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Snapshots of your business performance."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline"><a href={`/api/exports/invoices?slug=${organizationSlug}`}><Download className="h-4 w-4" /> Invoices CSV</a></Button>
            <Button asChild variant="outline"><a href={`/api/exports/expenses?slug=${organizationSlug}`}><Download className="h-4 w-4" /> Expenses CSV</a></Button>
            <Button asChild variant="outline"><a href={`/api/exports/payments?slug=${organizationSlug}`}><Download className="h-4 w-4" /> Payments CSV</a></Button>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Profit summary (YTD)</CardTitle></CardHeader>
          <CardContent>
            <Row label="Payments received" value={formatMoney(profit.payments, org.currency)} />
            <Row label="Deductible expenses" value={formatMoney(profit.expenses, org.currency)} />
            <Row label="Estimated profit" value={formatMoney(profit.profit, org.currency)} bold />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Accounts receivable aging</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bucket</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(aging.buckets).map(([k, v]) => (
                  <TableRow key={k}>
                    <TableCell>{labelForBucket(k)}</TableCell>
                    <TableCell className="text-right">{(aging.counts as any)[k]}</TableCell>
                    <TableCell className="text-right num">{formatMoney(v as any, org.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Revenue by client (YTD)</CardTitle></CardHeader>
          <CardContent>
            {byClient.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not enough data yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byClient.map((c) => (
                    <TableRow key={c.clientId}>
                      <TableCell>{c.companyName}</TableCell>
                      <TableCell className="text-right">{formatPercent(c.share)}</TableCell>
                      <TableCell className="text-right num">{formatMoney(c.revenue, org.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Expenses by category (YTD)</CardTitle></CardHeader>
          <CardContent>
            {expenseBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses yet this year.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseBreakdown.map((c) => (
                    <TableRow key={c.categoryId}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell className="text-right num">{formatMoney(c.amount, org.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={`num ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

function labelForBucket(k: string) {
  switch (k) {
    case "current": return "Current";
    case "1_30": return "1–30 days";
    case "31_60": return "31–60 days";
    case "61_90": return "61–90 days";
    case "90_plus": return "90+ days";
    default: return k;
  }
}
