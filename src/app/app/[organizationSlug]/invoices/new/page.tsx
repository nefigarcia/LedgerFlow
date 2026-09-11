import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { InvoiceBuilder } from "../invoice-builder";
import { addDays } from "date-fns";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { organizationSlug } = await params;
  const { clientId: preselectedClient } = await searchParams;
  const ctx = await requireOrgAccess(organizationSlug, "invoices:write");
  const [org, clients, projects] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: {
        currency: true,
        defaultPaymentTermsDays: true,
        defaultTaxReserveRate: true,
      },
    }),
    prisma.client.findMany({
      where: { organizationId: ctx.organizationId, active: true },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
    prisma.project.findMany({
      where: { organizationId: ctx.organizationId, status: { in: ["ACTIVE", "LEAD"] } },
      select: { id: true, name: true, hourlyRate: true, clientId: true },
    }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const due = addDays(new Date(), org.defaultPaymentTermsDays).toISOString().slice(0, 10);
  return (
    <div>
      <PageHeader title="New invoice" description="Draft an invoice for a client." />
      <InvoiceBuilder
        organizationSlug={organizationSlug}
        currency={org.currency}
        clients={clients}
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          hourlyRate: p.hourlyRate?.toString() ?? null,
          clientId: p.clientId,
        }))}
        defaults={{ issueDate: today, dueDate: due, preselectedClientId: preselectedClient ?? null }}
      />
    </div>
  );
}
