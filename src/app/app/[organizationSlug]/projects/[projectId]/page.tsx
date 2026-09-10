import { notFound } from "next/navigation";
import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, moneySum, toDecimal, moneyMultiply } from "@/lib/money/money";
import { formatDate } from "@/lib/dates/dates";

export const dynamic = "force-dynamic";

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ organizationSlug: string; projectId: string }>;
}) {
  const { organizationSlug, projectId } = await params;
  const ctx = await requireOrgAccess(organizationSlug, "projects:read");
  const [org, project, timeEntries, invoiceItems, expenses] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true },
    }),
    prisma.project.findFirst({
      where: { id: projectId, organizationId: ctx.organizationId },
      include: { client: { select: { companyName: true, id: true } } },
    }),
    prisma.timeEntry.findMany({
      where: { organizationId: ctx.organizationId, projectId },
      orderBy: { date: "desc" },
      take: 25,
    }),
    prisma.invoiceItem.findMany({
      where: { projectId, invoice: { organizationId: ctx.organizationId } },
      include: { invoice: { select: { total: true, amountPaid: true, status: true, invoiceNumber: true } } },
    }),
    prisma.expense.findMany({
      where: { organizationId: ctx.organizationId, projectId },
    }),
  ]);
  if (!project) notFound();

  const unbilledEntries = timeEntries.filter((t) => t.billable && !t.invoiceItemId);
  const unbilledHours = moneySum(unbilledEntries.map((t) => t.hours));
  const unbilledValue = moneySum(
    unbilledEntries.map((t) => moneyMultiply(t.hours, t.hourlyRate ?? project.hourlyRate ?? 0)),
  );
  const invoiced = moneySum(invoiceItems.map((i) => i.amount));
  const paid = moneySum(invoiceItems.filter((i) => i.invoice.status === "PAID").map((i) => i.amount));
  const outstanding = moneySum(invoiceItems.map((i) =>
    toDecimal(i.invoice.total).minus(toDecimal(i.invoice.amountPaid))
  ));
  const expensesTotal = moneySum(expenses.map((e) => e.amount));

  return (
    <div>
      <PageHeader title={project.name} description={`Client: ${project.client.companyName}`} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Invoiced" value={formatMoney(invoiced, org.currency)} />
        <MetricCard label="Paid" value={formatMoney(paid, org.currency)} />
        <MetricCard label="Outstanding" value={formatMoney(outstanding, org.currency)} />
        <MetricCard label="Expenses" value={formatMoney(expensesTotal, org.currency)} />
        <MetricCard label="Unbilled hours" value={unbilledHours.toFixed(2)} />
        <MetricCard label="Unbilled value" value={formatMoney(unbilledValue, org.currency)} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent time entries</CardTitle></CardHeader>
          <CardContent>
            {timeEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No time logged yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Hours</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDate(t.date)}</TableCell>
                      <TableCell className="max-w-[240px] truncate">{t.description ?? "—"}</TableCell>
                      <TableCell className="text-right num">{t.hours.toString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Invoiced work</CardTitle></CardHeader>
          <CardContent>
            {invoiceItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing invoiced yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Invoice</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceItems.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.invoice.invoiceNumber}</TableCell>
                      <TableCell className="max-w-[240px] truncate">{i.description}</TableCell>
                      <TableCell className="text-right num">{formatMoney(i.amount, org.currency)}</TableCell>
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
