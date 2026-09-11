import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireOrgAccess, getUserOrganizations } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell/app-shell";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const ctx = await requireOrgAccess(organizationSlug);
  const [org, memberships, user] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        currency: true,
        logoUrl: true,
        subscriptionPlan: true,
      },
    }),
    getUserOrganizations(ctx.userId),
    prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, email: true, image: true },
    }),
  ]);
  if (!org) redirect("/app");

  return (
    <AppShell
      organization={org}
      role={ctx.role}
      memberships={memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
      }))}
      user={user}
    >
      {children}
    </AppShell>
  );
}
