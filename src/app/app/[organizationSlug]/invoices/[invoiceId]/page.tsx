import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, invoiceStatusToBadge } from "@/components/ui/status-badge";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, toNumber } from "@/lib/money/money";
import { formatDate } from "@/lib/dates/dates";
import { ArrowLeft, Download } from "lucide-react";
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
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: ctx.organizationId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      client: true,
      payments: { orderBy: { date: "desc" } },
    },
  });
  if (!invoice) notFound();
  const base = `/app/${organizationSlug}`;
  const pct = toNumber(invoice.total) > 0
    ? Math.min(100, (toNumber(invoice.amountPaid) / toNumber(invoice.total)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <Link href={`${base}/invoices`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All invoices
      </Link>
      <PageHeader
        eyebrow={<StatusBadge status={invoiceStatusToBadge(invoice.status, invoice.dueDate)} />}
        title={`Invoice ${invoice.invoiceNumber}`}
        description={
          <>
            To <span className="font-medium text-foreground">{invoice.client.companyName}</span>
            {" · "}Issued {formatDate(invoice.issueDate)}
            {" · "}Due {formatDate(invoice.dueDate)}
          </>
        }
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left: invoice preview */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Line items</CardTitle>
                <p className="text-xs text-muted-foreground">{invoice.items.length} item{invoice.items.length === 1 ? "" : "s"}</p>
              </div>
              {invoice.currency !== "USD" ? (
                <span className="text-2xs uppercase tracking-widest text-muted-foreground">{invoice.currency}</span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="p-0">
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
                    <TableCell className="font-medium">{i.description}</TableCell>
                    <TableCell className="text-right num">{i.quantity.toString()}</TableCell>
                    <TableCell className="text-muted-foreground text-xs uppercase tracking-wide">{i.unit}</TableCell>
                    <TableCell className="text-right"><Money value={i.rate} currency={invoice.currency} /></TableCell>
                    <TableCell className="text-right"><Money value={i.amount} currency={invoice.currency} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t border-border p-5">
              <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
                <TotalRow label="Subtotal" value={formatMoney(invoice.subtotal, invoice.currency)} />
                {toNumber(invoice.discount) > 0 && (
                  <TotalRow label="Discount" value={`− ${formatMoney(invoice.discount, invoice.currency)}`} muted />
                )}
                {toNumber(invoice.taxAmount) > 0 && (
                  <TotalRow label={`Sales tax (${invoice.taxRate.toString()}%)`} value={formatMoney(invoice.taxAmount, invoice.currency)} muted />
                )}
                <div className="mt-2 border-t border-border pt-2">
                  <TotalRow label="Total" value={formatMoney(invoice.total, invoice.currency)} bold />
                </div>
                {toNumber(invoice.amountPaid) > 0 && (
                  <>
                    <TotalRow label="Amount paid" value={formatMoney(invoice.amountPaid, invoice.currency)} muted />
                    <TotalRow label="Balance due" value={formatMoney(invoice.balanceDue, invoice.currency)} bold />
                  </>
                )}
              </dl>
            </div>
          </CardContent>
        </Card>

        {/* Right: payment progress + notes */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <Money value={invoice.amountPaid} currency={invoice.currency} size="xl" tone={pct >= 100 ? "positive" : "default"} />
                  <span className="text-sm text-muted-foreground">of {formatMoney(invoice.total, invoice.currency)}</span>
                </div>
                <div className="mt-2">
                  <Progress value={pct} indicatorClassName={pct >= 100 ? "bg-success" : "bg-primary"} />
                </div>
                <div className="mt-1 text-2xs text-muted-foreground">
                  {pct.toFixed(0)}% collected · {formatMoney(invoice.balanceDue, invoice.currency)} remaining
                </div>
              </div>
              {invoice.status !== "PAID" && invoice.status !== "VOID" ? (
                <RecordPaymentDialog
                  organizationSlug={organizationSlug}
                  invoiceId={invoice.id}
                  invoiceNumber={invoice.invoiceNumber}
                  defaultAmount={invoice.balanceDue.toString()}
                  triggerLabel="Record payment"
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payments recorded</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.payments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <div>{formatDate(p.date)}</div>
                        <div className="text-2xs text-muted-foreground">{p.method}{p.reference ? ` · ${p.reference}` : ""}</div>
                      </div>
                      <Money value={p.amount} currency={invoice.currency} tone="positive" />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {(invoice.notes || invoice.terms) && (
            <Card>
              <CardHeader>
                <CardTitle>Notes & terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {invoice.notes ? (
                  <div>
                    <div className="mb-1 text-2xs font-medium uppercase tracking-widest text-muted-foreground">Notes</div>
                    <p className="whitespace-pre-line text-foreground/80">{invoice.notes}</p>
                  </div>
                ) : null}
                {invoice.terms ? (
                  <div>
                    <div className="mb-1 text-2xs font-medium uppercase tracking-widest text-muted-foreground">Terms</div>
                    <p className="whitespace-pre-line text-foreground/80">{invoice.terms}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function TotalRow({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={bold ? "font-semibold" : muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={`num ${bold ? "text-lg font-semibold" : muted ? "text-muted-foreground" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}
