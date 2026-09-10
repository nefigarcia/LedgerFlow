import Link from "next/link";
import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money/money";
import { formatDate, isOverdue } from "@/lib/dates/dates";
import { FileText, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const ctx = await requireOrgAccess(organizationSlug, "invoices:read");
  const [org, invoices] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true },
    }),
    prisma.invoice.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      include: { client: { select: { companyName: true } } },
    }),
  ]);
  const base = `/app/${organizationSlug}`;
  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Draft, send, and track invoices for your clients."
        actions={
          <Button asChild><Link href={`${base}/invoices/new`}><Plus className="h-4 w-4" /> New invoice</Link></Button>
        }
      />
      {invoices.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Create your first invoice"
          description="Invoices generate a PDF, track payments, and update your dashboard totals automatically."
          action={<Button asChild><Link href={`${base}/invoices/new`}>New invoice</Link></Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((i) => {
                const displayStatus =
                  i.status === "SENT" || i.status === "PARTIALLY_PAID"
                    ? isOverdue(i.dueDate)
                      ? "OVERDUE"
                      : i.status
                    : i.status;
                return (
                  <TableRow key={i.id}>
                    <TableCell><Link href={`${base}/invoices/${i.id}`} className="font-medium hover:underline">{i.invoiceNumber}</Link></TableCell>
                    <TableCell>{i.client.companyName}</TableCell>
                    <TableCell>{formatDate(i.issueDate)}</TableCell>
                    <TableCell>{formatDate(i.dueDate)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(i.total, org.currency)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(i.balanceDue, org.currency)}</TableCell>
                    <TableCell><StatusBadge status={displayStatus} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
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
