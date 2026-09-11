import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricTile, MetricGroup } from "@/components/ui/metric-tile";
import { Money } from "@/components/ui/money";
import { BarList } from "@/components/bar-list";
import { formatMoney, moneySum, toNumber } from "@/lib/money/money";
import { formatDate } from "@/lib/dates/dates";
import { startOfMonth, startOfYear } from "date-fns";
import { ExpenseDialog } from "./expense-dialog";
import { Receipt } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { organizationSlug } = await params;
  const { new: openNew } = await searchParams;
  const ctx = await requireOrgAccess(organizationSlug, "expenses:read");
  const [org, expenses, categories, clients, projects] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true },
    }),
    prisma.expense.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { date: "desc" },
      take: 100,
      include: {
        category: { select: { id: true, name: true } },
        vendor: { select: { name: true } },
        client: { select: { companyName: true } },
        project: { select: { name: true } },
      },
    }),
    prisma.expenseCategory.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      where: { organizationId: ctx.organizationId, active: true },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
    prisma.project.findMany({
      where: { organizationId: ctx.organizationId, status: { in: ["ACTIVE", "LEAD"] } },
      select: { id: true, name: true, clientId: true },
    }),
  ]);

  const now = new Date();
  const monthTotal = moneySum(expenses.filter((e) => e.date >= startOfMonth(now) && !e.isPersonal).map((e) => e.amount));
  const ytdTotal = moneySum(expenses.filter((e) => e.date >= startOfYear(now) && !e.isPersonal).map((e) => e.amount));

  // Top category YTD
  const catAgg = new Map<string, { name: string; amount: number }>();
  for (const e of expenses) {
    if (e.isPersonal || e.date < startOfYear(now)) continue;
    const key = e.categoryId ?? "uncat";
    const name = e.category?.name ?? "Uncategorized";
    const bucket = catAgg.get(key) ?? { name, amount: 0 };
    bucket.amount += toNumber(e.amount);
    catAgg.set(key, bucket);
  }
  const top = Array.from(catAgg.values()).sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Expenses"
        title="Where your money is going"
        actions={
          <ExpenseDialog
            organizationSlug={organizationSlug}
            categories={categories}
            clients={clients}
            projects={projects}
            defaultOpen={Boolean(openNew)}
          />
        }
      />

      {expenses.length > 0 && (
        <MetricGroup columns={3}>
          <MetricTile label="This month" value={<Money value={monthTotal} currency={org.currency} size="lg" />} compact />
          <MetricTile label="Year to date" value={<Money value={ytdTotal} currency={org.currency} size="lg" />} compact />
          <MetricTile
            label="Largest category"
            value={top[0] ? top[0].name : "—"}
            subValue={top[0] ? formatMoney(top[0].amount, org.currency) : undefined}
            compact
          />
        </MetricGroup>
      )}

      {expenses.length > 0 && top.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Top categories YTD</CardTitle></CardHeader>
          <CardContent>
            <BarList
              rows={top.map((c) => ({ key: c.name, label: c.name, value: c.amount }))}
              currency={org.currency}
              max={6}
            />
          </CardContent>
        </Card>
      )}

      {expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="No expenses yet"
          description="Add expenses to sharpen your profit estimate and tax reserve target."
          action={
            <ExpenseDialog organizationSlug={organizationSlug} categories={categories} clients={clients} projects={projects} />
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground">{formatDate(e.date)}</TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="truncate font-medium">{e.description}</div>
                      {e.isPersonal ? (
                        <div className="mt-0.5"><StatusBadge status="archived" label="Personal" size="sm" /></div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {e.category ? (
                        <span className="chip chip-muted">{e.category.name}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>{e.vendor?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-2xs text-muted-foreground">
                      {e.client?.companyName ?? ""}{e.project ? ` · ${e.project.name}` : ""}
                    </TableCell>
                    <TableCell className="text-right"><Money value={e.amount} currency={org.currency} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
