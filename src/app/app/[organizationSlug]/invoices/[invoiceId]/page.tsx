import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money/money";
import { formatDate } from "@/lib/dates/dates";
import { Download, Send } from "lucide-react";
import { InvoiceActions } from "./invoice-actions";
import { RecordPaymentDialog } from "../../payments/record-payment-dialog";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; invoiceId: string }>;
}) {
  const { organizationSlug, invoiceId } = await params;
  const ctx = await requireOrgAccess(organizationSlug, "invoices:read");
  const [org, invoice] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true, name: true },
    }),
    prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: ctx.organizationId },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        client: true,
        payments: { orderBy: { date: "desc" } },
      },
    }),
  ]);
  if (!invoice) notFound();
  const base = `/app/${organizationSlug}`;
  return (
    <div>
      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        description={`To ${invoice.client.companyName}`}
        actions={
          <>
            <Button asChild variant="outline">
              <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
                <Download className="h-4 w-4" /> Download PDF
              </a>
            </Button>
            <InvoiceActions organizationSlug={organizationSlug} invoiceId={invoice.id} status={invoice.status} />
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Details</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Issued {formatDate(invoice.issueDate)} · Due {formatDate(invoice.dueDate)}
              </p>
            </div>
            <StatusBadge status={invoice.status} />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.description}</TableCell>
                    <TableCell className="text-right num">{i.quantity.toString()}</TableCell>
                    <TableCell>{i.unit}</TableCell>
                    <TableCell className="text-right num">{formatMoney(i.rate, invoice.currency)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(i.amount, invoice.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {invoice.notes ? (
              <div className="mt-6">
                <div className="text-xs font-medium uppercase text-muted-foreground">Notes</div>
                <p className="mt-1 whitespace-pre-line text-sm">{invoice.notes}</p>
              </div>
            ) : null}
            {invoice.terms ? (
              <div className="mt-4">
                <div className="text-xs font-medium uppercase text-muted-foreground">Terms</div>
                <p className="mt-1 whitespace-pre-line text-sm">{invoice.terms}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Subtotal" value={formatMoney(invoice.subtotal, invoice.currency)} />
              <Row label="Discount" value={`− ${formatMoney(invoice.discount, invoice.currency)}`} />
              <Row label="Tax" value={formatMoney(invoice.taxAmount, invoice.currency)} />
              <div className="border-t pt-2">
                <Row label="Total" value={formatMoney(invoice.total, invoice.currency)} bold />
              </div>
              <Row label="Amount paid" value={formatMoney(invoice.amountPaid, invoice.currency)} />
              <Row label="Balance due" value={formatMoney(invoice.balanceDue, invoice.currency)} bold />
              <div className="pt-3">
                {invoice.status !== "PAID" && invoice.status !== "VOID" ? (
                  <RecordPaymentDialog
                    organizationSlug={organizationSlug}
                    invoiceId={invoice.id}
                    invoiceNumber={invoice.invoiceNumber}
                    defaultAmount={invoice.balanceDue.toString()}
                    triggerLabel="Record payment"
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
            <CardContent>
              {invoice.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between">
                      <span>{formatDate(p.date)} · {p.method}</span>
                      <span className="num">{formatMoney(p.amount, invoice.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    DRAFT: { variant: "muted", label: "Draft" },
    SENT: { variant: "secondary", label: "Sent" },
    VIEWED: { variant: "secondary", label: "Viewed" },
    PARTIALLY_PAID: { variant: "warning", label: "Partial" },
    PAID: { variant: "success", label: "Paid" },
    OVERDUE: { variant: "destructive", label: "Overdue" },
    VOID: { variant: "muted", label: "Void" },
  };
  const v = map[status] ?? map.DRAFT;
  return <Badge variant={v.variant}>{v.label}</Badge>;
}
