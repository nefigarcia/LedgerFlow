import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { prisma } from "@/lib/db/prisma";
import type { OrganizationRole } from "@prisma/client";
import { hasPermission, type Permission } from "@/lib/permissions/permissions";

export const getSession = cache(async () => {
  return auth();
});

export async function requireUser() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user;
}

export type OrgContext = {
  userId: string;
  organizationId: string;
  organizationSlug: string;
  role: OrganizationRole;
};

/**
 * Resolve the authenticated user's membership for an organization.
 * Enforces multi-tenant isolation — always use this on server actions
 * / route handlers before touching org-scoped data.
 */
export async function requireOrgAccess(
  organizationSlug: string,
  requiredPermission?: Permission,
): Promise<OrgContext> {
  const user = await requireUser();
  const membership = await prisma.organizationMembership.findFirst({
    where: {
      userId: user.id,
      organization: {
        slug: organizationSlug,
        deletedAt: null,
      },
    },
    include: {
      organization: { select: { id: true, slug: true } },
    },
  });
  if (!membership) {
    redirect("/app");
  }
  if (requiredPermission && !hasPermission(membership.role, requiredPermission)) {
    // For read attempts we redirect to dashboard; write attempts throw.
    if (requiredPermission.endsWith(":read")) {
      redirect(`/app/${membership.organization.slug}/dashboard`);
    }
    throw new Error(`Forbidden: missing ${requiredPermission}`);
  }
  return {
    userId: user.id,
    organizationId: membership.organization.id,
    organizationSlug: membership.organization.slug,
    role: membership.role,
  };
}

export async function getUserOrganizations(userId: string) {
  return prisma.organizationMembership.findMany({
    where: {
      userId,
      organization: { deletedAt: null },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          businessType: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
