import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialSettingsForm } from "./financial-form";
import { InvoiceSettingsForm } from "./invoice-form";
import { OwnersSection } from "./owners-section";
import { MembersSection } from "./members-section";
import { TaxPlanningSettings } from "./tax-planning-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const ctx = await requireOrgAccess(organizationSlug, "settings:read");
  const [org, owners, memberships] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
    }),
    prisma.owner.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.organizationMembership.findMany({
      where: { organizationId: ctx.organizationId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);
  return (
    <div>
      <PageHeader title="Settings" description="Manage your organization, financial defaults, and members." />
      <Tabs defaultValue="financial">
        <TabsList>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="invoice">Invoice</TabsTrigger>
          <TabsTrigger value="tax">Tax planning</TabsTrigger>
          <TabsTrigger value="owners">Owners</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
        </TabsList>
        <TabsContent value="financial">
          <FinancialSettingsForm
            organizationSlug={organizationSlug}
            org={{
              currency: org.currency,
              fiscalYearStartMonth: org.fiscalYearStartMonth,
              openingBalance: org.openingBalance.toString(),
              minimumOperatingReserve: org.minimumOperatingReserve.toString(),
              defaultTaxReserveRate: org.defaultTaxReserveRate.toString(),
            }}
          />
        </TabsContent>
        <TabsContent value="invoice">
          <InvoiceSettingsForm
            organizationSlug={organizationSlug}
            org={{
              invoicePrefix: org.invoicePrefix,
              invoiceNextNumber: org.invoiceNextNumber,
              defaultPaymentTermsDays: org.defaultPaymentTermsDays,
            }}
          />
        </TabsContent>
        <TabsContent value="tax">
          <TaxPlanningSettings
            organizationSlug={organizationSlug}
            org={{
              currency: org.currency,
              taxPlanningMode: org.taxPlanningMode,
              taxPlanningYear: org.taxPlanningYear,
              defaultTaxReserveRate: org.defaultTaxReserveRate.toString(),
              taxReserveEarmarked: org.taxReserveEarmarked.toString(),
              businessType: org.businessType,
            }}
            owners={owners.map((o) => ({
              id: o.id,
              name: o.name,
              ownershipPercentage: o.ownershipPercentage.toString(),
              taxReserveOverride: o.taxReserveOverride?.toString() ?? null,
              stateReserveRate: o.stateReserveRate?.toString() ?? null,
              residenceState: o.residenceState,
              filingStatus: o.filingStatus,
            }))}
          />
        </TabsContent>
        <TabsContent value="owners">
          <OwnersSection
            organizationSlug={organizationSlug}
            owners={owners.map((o) => ({
              id: o.id,
              name: o.name,
              email: o.email,
              ownershipPercentage: o.ownershipPercentage.toString(),
              distributionPercentage: o.distributionPercentage.toString(),
              taxReserveOverride: o.taxReserveOverride?.toString() ?? null,
              active: o.active,
            }))}
          />
        </TabsContent>
        <TabsContent value="members">
          <MembersSection
            memberships={memberships.map((m) => ({
              id: m.id,
              role: m.role,
              user: { id: m.user.id, name: m.user.name, email: m.user.email },
            }))}
          />
        </TabsContent>
        <TabsContent value="ai">
          <div className="rounded-lg border p-6 text-sm">
            <p className="font-medium">Assistant model</p>
            <p className="mt-1 text-muted-foreground">Configured via <code>OPENAI_MODEL</code> env variable. Defaults to <code>gpt-5.6-luna</code>.</p>
            <p className="mt-3 text-xs text-muted-foreground">The assistant never sees another organization&apos;s data. All requests are made server-side using the OpenAI Responses API.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
