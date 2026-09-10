import { requireOrgAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialSettingsForm } from "./financial-form";
import { InvoiceSettingsForm } from "./invoice-form";
import { OwnersSection } from "./owners-section";
import { MembersSection } from "./members-section";

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
          <TabsTrigger value="owners">Owners</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
        </TabsList>
        <TabsContent value="financial">
          <FinancialSettingsForm organizationSlug={organizationSlug} org={org} />
        </TabsContent>
        <TabsContent value="invoice">
          <InvoiceSettingsForm organizationSlug={organizationSlug} org={org} />
        </TabsContent>
        <TabsContent value="owners">
          <OwnersSection organizationSlug={organizationSlug} owners={owners} />
        </TabsContent>
        <TabsContent value="members">
          <MembersSection memberships={memberships} />
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
