import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/money/money";
import { formatDate } from "@/lib/dates/dates";
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
  return (
    <div>
      <PageHeader
        title="Payments"
        description="Every payment you record adds to recorded cash and updates invoice balances."
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
      {payments.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-8 w-8" />}
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
                  <TableCell>{formatDate(p.date)}</TableCell>
                  <TableCell>{p.invoice?.invoiceNumber ?? "—"}</TableCell>
                  <TableCell>{p.client?.companyName ?? "—"}</TableCell>
                  <TableCell>{p.method}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.reference ?? "—"}</TableCell>
                  <TableCell className="text-right num">{formatMoney(p.amount, org.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
