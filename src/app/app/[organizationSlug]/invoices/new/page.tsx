import Link from "next/link";
import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { InvoiceBuilder } from "../invoice-builder";
import { addDaysISO, todayISOInTimeZone } from "@/lib/dates/dates";
import { ArrowLeft } from "lucide-react";

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
        timezone: true,
        defaultPaymentTermsDays: true,
        invoicePaymentInstructions: true,
        invoiceDefaultNotes: true,
        invoiceDefaultTerms: true,
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
  const today = todayISOInTimeZone(org.timezone);
  const base = `/app/${organizationSlug}`;
  const validPreselect = clients.some((c) => c.id === preselectedClient) ? preselectedClient! : null;

  return (
    <div className="space-y-4">
      <Link href={`${base}/invoices`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All invoices
      </Link>
      <PageHeader title="New invoice" description="Draft an invoice. You can keep editing it until you mark it sent." />
      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Add a client before creating an invoice.{" "}
          <Link href={`${base}/clients?new=1`} className="font-medium text-primary hover:underline">Add client →</Link>
        </div>
      ) : (
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
          defaults={{
            issueDate: today,
            dueDate: addDaysISO(today, org.defaultPaymentTermsDays),
            preselectedClientId: validPreselect,
            notes: org.invoiceDefaultNotes ?? "",
            terms: org.invoiceDefaultTerms ?? "",
            paymentInstructions: org.invoicePaymentInstructions ?? "",
          }}
        />
      )}
    </div>
  );
}
