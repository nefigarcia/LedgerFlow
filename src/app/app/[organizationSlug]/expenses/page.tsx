import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money/money";
import { formatDate } from "@/lib/dates/dates";
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
        category: { select: { name: true } },
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
  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Track business spending to keep profit and tax reserves accurate."
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
      {expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-8 w-8" />}
          title="No expenses yet"
          description="Add expenses to sharpen your profit estimate and tax reserve target."
          action={
            <ExpenseDialog
              organizationSlug={organizationSlug}
              categories={categories}
              clients={clients}
              projects={projects}
            />
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Client/Project</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{formatDate(e.date)}</TableCell>
                  <TableCell className="max-w-[240px] truncate">{e.description}</TableCell>
                  <TableCell>{e.category?.name ?? "—"}</TableCell>
                  <TableCell>{e.vendor?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.client?.companyName ?? ""}{e.project ? ` · ${e.project.name}` : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="num">{formatMoney(e.amount, org.currency)}</div>
                    {e.isPersonal ? <Badge variant="muted">Personal</Badge> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
