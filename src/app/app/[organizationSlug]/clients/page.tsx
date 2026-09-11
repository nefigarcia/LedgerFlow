import Link from "next/link";
import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { MetricTile, MetricGroup } from "@/components/ui/metric-tile";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Money } from "@/components/ui/money";
import { moneySum, toNumber } from "@/lib/money/money";
import { ClientDialog } from "./client-dialog";
import { Users2 } from "lucide-react";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { organizationSlug } = await params;
  const { new: openNew } = await searchParams;
  const ctx = await requireOrgAccess(organizationSlug, "clients:read");
  const [org, clients] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true },
    }),
    prisma.client.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: [{ active: "desc" }, { companyName: "asc" }],
      include: {
        invoices: { select: { balanceDue: true, total: true, status: true } },
        _count: { select: { projects: true } },
      },
    }),
  ]);
  const base = `/app/${organizationSlug}`;

  const activeClients = clients.filter((c) => c.active).length;
  const totalOutstanding = moneySum(
    clients.flatMap((c) => c.invoices.filter((i) => i.status !== "VOID").map((i) => i.balanceDue)),
  );
  const totalLifetime = moneySum(
    clients.flatMap((c) => c.invoices.filter((i) => i.status !== "VOID").map((i) => i.total)),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clients"
        title="Who you invoice and track work for"
        actions={<ClientDialog organizationSlug={organizationSlug} defaultOpen={Boolean(openNew)} />}
      />

      {clients.length > 0 && (
        <MetricGroup columns={3}>
          <MetricTile label="Active clients" value={String(activeClients)} subValue={`${clients.length} total`} compact />
          <MetricTile label="Outstanding" value={<Money value={totalOutstanding} currency={org.currency} size="lg" />} compact />
          <MetricTile label="Lifetime billed" value={<Money value={totalLifetime} currency={org.currency} size="lg" />} compact />
        </MetricGroup>
      )}

      {clients.length === 0 ? (
        <EmptyState
          icon={<Users2 className="h-6 w-6" />}
          title="Add your first client"
          description="Add a client to begin tracking projects, invoices, and payments."
          action={<ClientDialog organizationSlug={organizationSlug} />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Projects</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Lifetime</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => {
                  const outstanding = moneySum(c.invoices.map((i) => i.balanceDue));
                  const lifetime = moneySum(c.invoices.filter((i) => i.status !== "VOID").map((i) => i.total));
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link href={`${base}/clients/${c.id}`} className="flex items-center gap-2.5 hover:text-primary">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary-soft text-2xs font-semibold text-primary-soft-foreground">
                            {initials(c.companyName)}
                          </span>
                          <span className="font-medium">{c.companyName}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        {c.contactName ? <div className="text-sm">{c.contactName}</div> : <span className="text-muted-foreground">—</span>}
                        {c.email ? <div className="text-2xs text-muted-foreground">{c.email}</div> : null}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{c._count.projects}</TableCell>
                      <TableCell className="text-right">
                        <Money value={outstanding} currency={org.currency} tone={toNumber(outstanding) > 0 ? "default" : "muted"} />
                      </TableCell>
                      <TableCell className="text-right"><Money value={lifetime} currency={org.currency} /></TableCell>
                      <TableCell>
                        <StatusBadge status={c.active ? "active" : "archived"} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
