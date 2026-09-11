import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricTile, MetricGroup } from "@/components/ui/metric-tile";
import { Money } from "@/components/ui/money";
import { moneySum, moneyMultiply } from "@/lib/money/money";
import { formatDate } from "@/lib/dates/dates";
import { TimeEntryDialog } from "./time-entry-dialog";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TimePage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { organizationSlug } = await params;
  const { new: openNew } = await searchParams;
  const ctx = await requireOrgAccess(organizationSlug, "time:read");
  const [org, projects, entries] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true },
    }),
    prisma.project.findMany({
      where: { organizationId: ctx.organizationId, status: { in: ["ACTIVE", "LEAD"] } },
      select: { id: true, name: true, hourlyRate: true, client: { select: { companyName: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.timeEntry.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { date: "desc" },
      take: 50,
      include: { project: { select: { name: true, hourlyRate: true } } },
    }),
  ]);
  const unbilled = entries.filter((e) => e.billable && !e.invoiceItemId);
  const unbilledHours = moneySum(unbilled.map((e) => e.hours));
  const unbilledValue = moneySum(
    unbilled.map((e) => moneyMultiply(e.hours, e.hourlyRate ?? e.project.hourlyRate ?? 0)),
  );
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Time"
        title="Log billable and non-billable hours"
        description="Time entries can later be converted into invoice line items."
        actions={
          <TimeEntryDialog
            organizationSlug={organizationSlug}
            projects={projects.map((p) => ({ id: p.id, name: p.name, client: p.client }))}
            defaultOpen={Boolean(openNew)}
          />
        }
      />
      <MetricGroup columns={3}>
        <MetricTile label="Unbilled hours" value={unbilledHours.toFixed(2)} subValue="Ready to invoice" compact />
        <MetricTile label="Unbilled value" value={<Money value={unbilledValue} currency={org.currency} size="lg" />} compact />
        <MetricTile label="Recent entries" value={String(entries.length)} compact />
      </MetricGroup>

      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Clock className="h-6 w-6" />}
                title="Log your first time entry"
                description="Time entries can later be converted into invoice line items."
                action={
                  <TimeEntryDialog
                    organizationSlug={organizationSlug}
                    projects={projects.map((p) => ({ id: p.id, name: p.name, client: p.client }))}
                  />
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground">{formatDate(e.date)}</TableCell>
                    <TableCell>{e.project.name}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-muted-foreground">{e.description ?? "—"}</TableCell>
                    <TableCell className="text-right num">{e.hours.toString()}</TableCell>
                    <TableCell className="text-right">
                      {e.hourlyRate ? <Money value={e.hourlyRate} currency={org.currency} /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {!e.billable ? (
                        <span className="chip chip-muted">Non-billable</span>
                      ) : e.invoiceItemId ? (
                        <span className="chip chip-success">Invoiced</span>
                      ) : (
                        <span className="chip chip-warning">Unbilled</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
