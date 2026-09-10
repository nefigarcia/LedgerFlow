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
import { moneySum, toDecimal } from "@/lib/money/money";
import { ClientDialog } from "./client-dialog";
import { Users2 } from "lucide-react";

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
      },
    }),
  ]);
  const base = `/app/${organizationSlug}`;
  return (
    <div>
      <PageHeader
        title="Clients"
        description="Every business you invoice and track work for."
        actions={<ClientDialog organizationSlug={organizationSlug} defaultOpen={Boolean(openNew)} />}
      />
      {clients.length === 0 ? (
        <EmptyState
          icon={<Users2 className="h-8 w-8" />}
          title="Add your first client"
          description="Add a client to begin tracking projects, invoices, and payments."
          action={<ClientDialog organizationSlug={organizationSlug} />}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
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
                      <Link href={`${base}/clients/${c.id}`} className="font-medium hover:underline">
                        {c.companyName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.contactName ?? "—"}
                      {c.email ? <div className="text-xs">{c.email}</div> : null}
                    </TableCell>
                    <TableCell className="text-right num">{formatMoney(outstanding, org.currency)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(lifetime, org.currency)}</TableCell>
                    <TableCell>
                      {c.active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="muted">Archived</Badge>
                      )}
                    </TableCell>
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
