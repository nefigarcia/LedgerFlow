import Link from "next/link";
import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { MetricTile, MetricGroup } from "@/components/ui/metric-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, invoiceStatusToBadge } from "@/components/ui/status-badge";
import { Money } from "@/components/ui/money";
import { formatDate } from "@/lib/dates/dates";
import { moneySum, toNumber } from "@/lib/money/money";
import { FileText, Plus } from "lucide-react";
import { startOfMonth } from "date-fns";
import { InvoiceFilters } from "./invoice-filters";

export const dynamic = "force-dynamic";

type Filter = "all" | "draft" | "sent" | "overdue" | "paid";

export default async function InvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { organizationSlug } = await params;
  const { status: statusParam, q } = await searchParams;
  const ctx = await requireOrgAccess(organizationSlug, "invoices:read");
  const filter = (statusParam as Filter) ?? "all";

  const where: any = { organizationId: ctx.organizationId };
  if (filter === "draft") where.status = "DRAFT";
  else if (filter === "sent") where.status = { in: ["SENT", "VIEWED", "PARTIALLY_PAID"] };
  else if (filter === "paid") where.status = "PAID";
  else if (filter === "overdue") {
    where.status = { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] };
    where.dueDate = { lt: new Date() };
  }
  if (q) {
    where.OR = [
      { invoiceNumber: { contains: q } },
      { client: { companyName: { contains: q } } },
    ];
  }

  const [org, invoices, allOpen, paidThisMonth] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true },
    }),
    prisma.invoice.findMany({
      where,
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      include: { client: { select: { companyName: true } } },
      take: 100,
    }),
    prisma.invoice.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] },
      },
      select: { balanceDue: true, dueDate: true },
    }),
    prisma.payment.aggregate({
      where: { organizationId: ctx.organizationId, date: { gte: startOfMonth(new Date()) } },
      _sum: { amount: true },
    }),
  ]);

  const outstanding = moneySum(allOpen.map((i) => i.balanceDue));
  const overdueBal = moneySum(
    allOpen.filter((i) => i.dueDate < new Date()).map((i) => i.balanceDue),
  );
  const overdueCount = allOpen.filter((i) => i.dueDate < new Date()).length;

  const base = `/app/${organizationSlug}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Invoicing"
        title="Who owes you money"
        description="Track receivables and identify what needs attention."
        actions={
          <Button asChild>
            <Link href={`${base}/invoices/new`}><Plus className="h-4 w-4" /> New invoice</Link>
          </Button>
        }
      />

      <MetricGroup columns={3}>
        <MetricTile
          label="Outstanding"
          value={<Money value={outstanding} currency={org.currency} size="lg" />}
          subValue={`${allOpen.length} open invoice${allOpen.length === 1 ? "" : "s"}`}
        />
        <MetricTile
          label="Overdue"
          value={<Money value={overdueBal} currency={org.currency} size="lg" tone={toNumber(overdueBal) > 0 ? "negative" : "default"} />}
          subValue={overdueCount > 0 ? `${overdueCount} invoice${overdueCount === 1 ? "" : "s"} past due` : "Nothing overdue"}
          emphasis={toNumber(overdueBal) > 0 ? "warning" : "default"}
        />
        <MetricTile
          label="Paid this month"
          value={<Money value={paidThisMonth._sum.amount ?? 0} currency={org.currency} size="lg" tone="positive" />}
          subValue="From recorded payments"
        />
      </MetricGroup>

      <InvoiceFilters activeStatus={filter} query={q ?? ""} basePath={`${base}/invoices`} />

      {invoices.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={filter === "all" ? "Create your first invoice" : "No invoices match this filter"}
          description={filter === "all"
            ? "Invoices generate a PDF, track payments, and update your dashboard totals automatically."
            : "Try a different status filter or clear the search."}
          action={filter === "all" ? (
            <Button asChild><Link href={`${base}/invoices/new`}>New invoice</Link></Button>
          ) : (
            <Button asChild variant="outline"><Link href={`${base}/invoices`}>Show all</Link></Button>
          )}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((i) => (
                  <TableRow key={i.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`${base}/invoices/${i.id}`} className="font-medium hover:text-primary hover:underline">
                        {i.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{i.client.companyName}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(i.issueDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(i.dueDate)}</TableCell>
                    <TableCell className="text-right"><Money value={i.total} currency={org.currency} /></TableCell>
                    <TableCell className="text-right">
                      <Money value={i.balanceDue} currency={org.currency} tone={toNumber(i.balanceDue) > 0 ? "default" : "muted"} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={invoiceStatusToBadge(i.status, i.dueDate)} />
                    </TableCell>
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
