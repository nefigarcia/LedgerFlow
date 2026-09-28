import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { InvoiceBuilder } from "../../invoice-builder";
import { toDateInputValue } from "@/lib/dates/dates";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ organizationSlug: string; invoiceId: string }>;
}) {
  const { organizationSlug, invoiceId } = await params;
  const ctx = await requireOrgAccess(organizationSlug, "invoices:write");
  const base = `/app/${organizationSlug}`;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: ctx.organizationId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!invoice) notFound();
  // Only drafts are editable — sent/paid invoices are financial records.
  if (invoice.status !== "DRAFT") redirect(`${base}/invoices/${invoice.id}`);

  const [org, clients, projects] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { currency: true },
    }),
    prisma.client.findMany({
      // Keep the invoice's current client selectable even if it was archived.
      where: { organizationId: ctx.organizationId, OR: [{ active: true }, { id: invoice.clientId }] },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
    prisma.project.findMany({
      where: {
        organizationId: ctx.organizationId,
        OR: [{ status: { in: ["ACTIVE", "LEAD"] } }, { id: invoice.projectId ?? "" }],
      },
      select: { id: true, name: true, hourlyRate: true, clientId: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <Link href={`${base}/invoices/${invoice.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to invoice
      </Link>
      <PageHeader
        eyebrow="Draft"
        title={`Edit invoice ${invoice.invoiceNumber}`}
        description="Add, change, or remove line items. The invoice number stays the same."
      />
      <InvoiceBuilder
        organizationSlug={organizationSlug}
        currency={invoice.currency || org.currency}
        clients={clients}
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          hourlyRate: p.hourlyRate?.toString() ?? null,
          clientId: p.clientId,
        }))}
        defaults={{
          issueDate: toDateInputValue(invoice.issueDate),
          dueDate: toDateInputValue(invoice.dueDate),
          preselectedClientId: invoice.clientId,
        }}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        initial={{
          clientId: invoice.clientId,
          projectId: invoice.projectId,
          issueDate: toDateInputValue(invoice.issueDate),
          dueDate: toDateInputValue(invoice.dueDate),
          poNumber: invoice.poNumber ?? "",
          notes: invoice.notes ?? "",
          terms: invoice.terms ?? "",
          paymentInstructions: invoice.paymentInstructions ?? "",
          discount: invoice.discount.toString(),
          taxRate: invoice.taxRate.toString(),
          items: invoice.items.map((i) => ({
            id: i.id,
            description: i.description,
            quantity: i.quantity.toString(),
            unit: i.unit,
            rate: i.rate.toString(),
            projectId: i.projectId,
          })),
        }}
      />
    </div>
  );
}
