import Link from "next/link";
import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ProjectDialog } from "./project-dialog";
import { formatMoney } from "@/lib/money/money";
import { FolderKanban } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { organizationSlug } = await params;
  const { new: openNew } = await searchParams;
  const ctx = await requireOrgAccess(organizationSlug, "projects:read");
  const [org, projects, clients] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true },
    }),
    prisma.project.findMany({
      where: { organizationId: ctx.organizationId },
      include: { client: { select: { id: true, companyName: true } } },
      orderBy: { updatedAt: "desc" },
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
        title="Projects"
        description="Client engagements you're delivering work against."
        actions={<ProjectDialog organizationSlug={organizationSlug} clients={clients} defaultOpen={Boolean(openNew)} />}
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-8 w-8" />}
          title="Add your first project"
          description="Projects belong to a client. Use them to group time entries, expenses, and invoice items."
          action={<ProjectDialog organizationSlug={organizationSlug} clients={clients} />}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Budget</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Link href={`./projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link></TableCell>
                  <TableCell>{p.client.companyName}</TableCell>
                  <TableCell className="text-sm">{p.billingMethod}</TableCell>
                  <TableCell><Badge variant={p.status === "ACTIVE" ? "success" : "muted"}>{p.status}</Badge></TableCell>
                  <TableCell className="text-right num">
                    {p.budget ? formatMoney(p.budget, org.currency) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
