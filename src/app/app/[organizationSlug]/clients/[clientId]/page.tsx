import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, moneySum } from "@/lib/money/money";
import { formatDate } from "@/lib/dates/dates";

export const dynamic = "force-dynamic";

export default async function ClientDetail({
  params,
}: {
  params: Promise<{ organizationSlug: string; clientId: string }>;
}) {
  const { organizationSlug, clientId } = await params;
  const ctx = await requireOrgAccess(organizationSlug, "clients:read");
  const [org, client, projects] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true },
    }),
    prisma.client.findFirst({
      where: { id: clientId, organizationId: ctx.organizationId },
      include: {
        invoices: { orderBy: { issueDate: "desc" } },
        payments: { orderBy: { date: "desc" }, take: 10 },
      },
    }),
    prisma.project.findMany({
      where: { organizationId: ctx.organizationId, clientId },
    }),
  ]);
  if (!client) notFound();
  const outstanding = moneySum(client.invoices.map((i) => i.balanceDue));
  const lifetime = moneySum(client.invoices.filter((i) => i.status !== "VOID").map((i) => i.total));
  const paid = moneySum(client.payments.map((p) => p.amount));
  const base = `/app/${organizationSlug}`;

  return (
    <div>
      <PageHeader
        title={client.companyName}
        description={
          <span>
            {client.contactName ?? "—"}
            {client.email ? <span className="ml-2 text-muted-foreground">{client.email}</span> : null}
          </span>
        }
        actions={<Link href={`${base}/invoices/new?clientId=${client.id}`} className="text-sm font-medium text-primary hover:underline">New invoice →</Link>}
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Outstanding" value={formatMoney(outstanding, org.currency)} />
        <MetricCard label="Lifetime revenue" value={formatMoney(lifetime, org.currency)} />
        <MetricCard label="Payments received" value={formatMoney(paid, org.currency)} />
        <MetricCard label="Projects" value={String(projects.length)} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {client.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.invoices.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <Link href={`${base}/invoices/${i.id}`} className="hover:underline">
                          {i.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(i.issueDate)}</TableCell>
                      <TableCell className="text-right num">{formatMoney(i.total, org.currency)}</TableCell>
                      <TableCell><StatusBadge status={i.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
          </CardHeader>
          <CardContent>
            {client.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.date)}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell className="text-right num">{formatMoney(p.amount, org.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {client.notes ? (
        <Card className="mt-6">
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-line text-sm">{client.notes}</CardContent>
        </Card>
      ) : null}
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
