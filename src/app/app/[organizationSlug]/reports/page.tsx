import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  getARAging,
  getExpenseBreakdown,
  getOperatingProfitYTD,
  getRevenueByClient,
} from "@/services/financial-metrics";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { BarList } from "@/components/bar-list";
import { Download, FileBarChart, Users2, Receipt, Wallet, Calculator, HandCoins } from "lucide-react";

export const dynamic = "force-dynamic";

const REPORT_CARDS = [
  { key: "revenue-client",  label: "Revenue by client",     description: "See who drives the top line YTD.",         icon: Users2,       href: "#revenue-client" },
  { key: "expense-category",label: "Expenses by category",  description: "Where money is going.",                    icon: Receipt,      href: "#expense-category" },
  { key: "ar-aging",        label: "Accounts receivable",   description: "Aging buckets for outstanding invoices.",  icon: FileBarChart, href: "#ar-aging" },
  { key: "cash",            label: "Cash activity",         description: "Inflows and outflows recorded.",           icon: Wallet,       href: "../cash" },
  { key: "tax",             label: "Tax summary",           description: "Reserve target, paid, remaining.",         icon: Calculator,   href: "../taxes" },
  { key: "distributions",   label: "Owner distributions",   description: "Historical distributions by owner.",       icon: HandCoins,    href: "../distributions" },
];

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Snapshots of business performance"
        description="Year-to-date summaries plus CSV exports."
        actions={
          <>
            <Button asChild variant="outline" size="sm"><a href={`/api/exports/invoices?slug=${organizationSlug}`}><Download className="h-3.5 w-3.5" /> Invoices CSV</a></Button>
            <Button asChild variant="outline" size="sm"><a href={`/api/exports/expenses?slug=${organizationSlug}`}><Download className="h-3.5 w-3.5" /> Expenses CSV</a></Button>
            <Button asChild variant="outline" size="sm"><a href={`/api/exports/payments?slug=${organizationSlug}`}><Download className="h-3.5 w-3.5" /> Payments CSV</a></Button>
            <Button asChild variant="outline" size="sm"><a href={`/api/exports/clients?slug=${organizationSlug}`}><Download className="h-3.5 w-3.5" /> Clients CSV</a></Button>
          </>
        }
      />

      <SectionHeader title="Report library" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {REPORT_CARDS.map((r) => (
          <a
            key={r.key}
            href={r.href}
            className="group flex items-start gap-3 rounded-xl border border-border/70 bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-hover"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-soft-foreground">
              <r.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{r.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{r.description}</div>
              <span className="mt-2 inline-block text-2xs text-muted-foreground group-hover:text-foreground">
                {r.href.startsWith("#") ? "View below →" : "Open →"}
              </span>
            </div>
          </a>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Profit summary (YTD)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Row label="Payments received" value={<Money value={profit.payments} currency={org.currency} />} />
            <Row label="Deductible expenses" value={<Money value={profit.expenses} currency={org.currency} tone="muted" />} />
            <div className="border-t border-border pt-2">
              <Row label="Estimated profit" value={<Money value={profit.profit} currency={org.currency} size="lg" tone={Number(profit.profit) >= 0 ? "positive" : "negative"} />} bold />
            </div>
          </CardContent>
        </Card>
        <Card id="ar-aging">
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
                    <TableCell className="text-right num">{(aging.counts as any)[k]}</TableCell>
                    <TableCell className="text-right"><Money value={v as any} currency={org.currency} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card id="revenue-client">
          <CardHeader><CardTitle>Revenue by client (YTD)</CardTitle></CardHeader>
          <CardContent>
            {byClient.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not enough data yet.</p>
            ) : (
              <BarList
                rows={byClient.map((c) => ({
                  key: c.clientId,
                  label: c.companyName,
                  value: c.revenue,
                  share: c.share,
                  href: `/app/${organizationSlug}/clients/${c.clientId}`,
                }))}
                currency={org.currency}
                max={10}
              />
            )}
          </CardContent>
        </Card>
        <Card id="expense-category">
          <CardHeader><CardTitle>Expenses by category (YTD)</CardTitle></CardHeader>
          <CardContent>
            {expenseBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses yet this year.</p>
            ) : (
              <BarList
                rows={expenseBreakdown.map((c) => ({
                  key: c.categoryId,
                  label: c.name,
                  value: c.amount,
                }))}
                currency={org.currency}
                max={10}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1 text-sm">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      {value}
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
