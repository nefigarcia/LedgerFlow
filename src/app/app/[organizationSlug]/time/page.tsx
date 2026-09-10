import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, moneySum, moneyMultiply } from "@/lib/money/money";
import { formatDate } from "@/lib/dates/dates";
import { MetricCard } from "@/components/metric-card";
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
    <div>
      <PageHeader
        title="Time"
        description="Log billable and non-billable hours by project."
        actions={<TimeEntryDialog organizationSlug={organizationSlug} projects={projects} defaultOpen={Boolean(openNew)} />}
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <MetricCard label="Unbilled hours" value={unbilledHours.toFixed(2)} />
        <MetricCard label="Unbilled value" value={formatMoney(unbilledValue, org.currency)} />
        <MetricCard label="Entries" value={String(entries.length)} />
      </div>

      <Card className="mt-6">
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Clock className="h-8 w-8" />}
                title="Log your first time entry"
                description="Time entries can later be converted into invoice line items."
                action={<TimeEntryDialog organizationSlug={organizationSlug} projects={projects} />}
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
                    <TableCell>{formatDate(e.date)}</TableCell>
                    <TableCell>{e.project.name}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{e.description ?? "—"}</TableCell>
                    <TableCell className="text-right num">{e.hours.toString()}</TableCell>
                    <TableCell className="text-right num">
                      {e.hourlyRate ? formatMoney(e.hourlyRate, org.currency) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {!e.billable ? "Non-billable" : e.invoiceItemId ? "Invoiced" : "Unbilled"}
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
