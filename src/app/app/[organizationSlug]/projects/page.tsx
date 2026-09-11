import Link from "next/link";
import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, projectStatusToBadge } from "@/components/ui/status-badge";
import { Money } from "@/components/ui/money";
import { ProjectDialog } from "./project-dialog";
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
  const base = `/app/${organizationSlug}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Projects"
        title="Client engagements"
        description="Group time, expenses, and invoice items by project."
        actions={<ProjectDialog organizationSlug={organizationSlug} clients={clients} defaultOpen={Boolean(openNew)} />}
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-6 w-6" />}
          title="Add your first project"
          description="Projects belong to a client. Use them to group time entries, expenses, and invoice items."
          action={<ProjectDialog organizationSlug={organizationSlug} clients={clients} />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
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
                    <TableCell>
                      <Link href={`${base}/projects/${p.id}`} className="font-medium hover:text-primary hover:underline">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell>{p.client.companyName}</TableCell>
                    <TableCell><span className="chip chip-muted">{p.billingMethod.replace("_", " ").toLowerCase()}</span></TableCell>
                    <TableCell><StatusBadge status={projectStatusToBadge(p.status)} /></TableCell>
                    <TableCell className="text-right">
                      {p.budget ? <Money value={p.budget} currency={org.currency} /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
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
