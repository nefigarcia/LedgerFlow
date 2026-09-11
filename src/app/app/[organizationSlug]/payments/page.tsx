import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Money } from "@/components/ui/money";
import { MetricTile, MetricGroup } from "@/components/ui/metric-tile";
import { moneySum } from "@/lib/money/money";
import { formatDate } from "@/lib/dates/dates";
import { startOfMonth, startOfYear } from "date-fns";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { CreditCard } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { organizationSlug } = await params;
  const { new: openNew } = await searchParams;
  const ctx = await requireOrgAccess(organizationSlug, "payments:read");
  const [org, payments, openInvoices, clients] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true },
    }),
    prisma.payment.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { date: "desc" },
      take: 100,
      include: { invoice: { select: { invoiceNumber: true } }, client: { select: { companyName: true } } },
    }),
    prisma.invoice.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] },
      },
      select: { id: true, invoiceNumber: true, balanceDue: true, clientId: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.client.findMany({
      where: { organizationId: ctx.organizationId, active: true },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
  ]);
  const now = new Date();
  const monthTotal = moneySum(payments.filter((p) => p.date >= startOfMonth(now)).map((p) => p.amount));
  const ytdTotal = moneySum(payments.filter((p) => p.date >= startOfYear(now)).map((p) => p.amount));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payments"
        title="What you've collected"
        description="Every recorded payment adds to cash and clears invoice balances."
        actions={
          <RecordPaymentDialog
            organizationSlug={organizationSlug}
            openInvoices={openInvoices.map((i) => ({
              id: i.id,
              invoiceNumber: i.invoiceNumber,
              balanceDue: i.balanceDue.toString(),
              clientId: i.clientId,
            }))}
            clients={clients}
            defaultOpen={Boolean(openNew)}
            triggerLabel="Record payment"
          />
        }
      />

      {payments.length > 0 && (
        <MetricGroup columns={3}>
          <MetricTile label="This month" value={<Money value={monthTotal} currency={org.currency} size="lg" tone="positive" />} compact />
          <MetricTile label="Year to date" value={<Money value={ytdTotal} currency={org.currency} size="lg" tone="positive" />} compact />
          <MetricTile label="Total payments" value={String(payments.length)} compact />
        </MetricGroup>
      )}

      {payments.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-6 w-6" />}
          title="No payments recorded yet"
          description="Payments you record will appear here and roll into your dashboard immediately."
          action={
            <RecordPaymentDialog
              organizationSlug={organizationSlug}
              openInvoices={openInvoices.map((i) => ({
                id: i.id,
                invoiceNumber: i.invoiceNumber,
                balanceDue: i.balanceDue.toString(),
                clientId: i.clientId,
              }))}
              clients={clients}
              triggerLabel="Record first payment"
            />
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">{formatDate(p.date)}</TableCell>
                    <TableCell>{p.invoice?.invoiceNumber ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{p.client?.companyName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><span className="chip chip-muted">{p.method}</span></TableCell>
                    <TableCell className="text-2xs text-muted-foreground">{p.reference ?? "—"}</TableCell>
                    <TableCell className="text-right"><Money value={p.amount} currency={org.currency} tone="positive" /></TableCell>
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
