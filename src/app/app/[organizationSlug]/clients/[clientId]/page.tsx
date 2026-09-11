import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricTile, MetricGroup } from "@/components/ui/metric-tile";
import { StatusBadge, invoiceStatusToBadge } from "@/components/ui/status-badge";
import { Money } from "@/components/ui/money";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { moneySum, toNumber } from "@/lib/money/money";
import { formatDate } from "@/lib/dates/dates";
import { initials } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Mail, Phone } from "lucide-react";

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
    <div className="space-y-6">
      <Link href={`${base}/clients`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All clients
      </Link>

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-lg font-semibold">
            {initials(client.companyName)}
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {client.companyName}
              <StatusBadge status={client.active ? "active" : "archived"} />
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {client.contactName ? <span>{client.contactName}</span> : null}
              {client.email ? (
                <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-foreground">
                  <Mail className="h-3.5 w-3.5" /> {client.email}
                </a>
              ) : null}
              {client.phone ? (
                <a href={`tel:${client.phone}`} className="flex items-center gap-1 hover:text-foreground">
                  <Phone className="h-3.5 w-3.5" /> {client.phone}
                </a>
              ) : null}
              {client.website ? (
                <a href={client.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground">
                  <ExternalLink className="h-3.5 w-3.5" /> {client.website.replace(/^https?:\/\//, "")}
                </a>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href={`${base}/projects?new=1&clientId=${client.id}`}>New project</Link></Button>
          <Button asChild><Link href={`${base}/invoices/new?clientId=${client.id}`}>New invoice</Link></Button>
        </div>
      </div>

      <MetricGroup columns={4}>
        <MetricTile label="Outstanding" value={<Money value={outstanding} currency={org.currency} size="lg" />} emphasis={toNumber(outstanding) > 0 ? "warning" : "default"} compact />
        <MetricTile label="Lifetime revenue" value={<Money value={lifetime} currency={org.currency} size="lg" />} compact />
        <MetricTile label="Payments received" value={<Money value={paid} currency={org.currency} size="lg" tone="positive" />} compact />
        <MetricTile label="Projects" value={String(projects.length)} compact />
      </MetricGroup>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
          <CardContent className="p-0">
            {client.invoices.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No invoices yet.</p>
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
                        <Link href={`${base}/invoices/${i.id}`} className="font-medium hover:text-primary hover:underline">
                          {i.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(i.issueDate)}</TableCell>
                      <TableCell className="text-right"><Money value={i.total} currency={org.currency} /></TableCell>
                      <TableCell><StatusBadge status={invoiceStatusToBadge(i.status, i.dueDate)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent payments</CardTitle></CardHeader>
          <CardContent className="p-0">
            {client.payments.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No payments yet.</p>
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
                      <TableCell className="text-muted-foreground">{p.method}</TableCell>
                      <TableCell className="text-right"><Money value={p.amount} currency={org.currency} tone="positive" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {client.notes ? (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-line text-sm text-foreground/80">{client.notes}</CardContent>
        </Card>
      ) : null}
    </div>
  );
}
