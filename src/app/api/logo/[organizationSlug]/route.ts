import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { getStorage } from "@/lib/storage/storage";
import { keyBelongsToOrganization } from "@/lib/storage/keys";

export const runtime = "nodejs";

/**
 * Streams a workspace logo from private storage. Only members of the
 * workspace can read it; the bucket itself is never public.
 * The `?v=` query string (logoUpdatedAt) busts the browser cache on change.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ organizationSlug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse(null, { status: 401 });
  const { organizationSlug } = await params;

  const org = await prisma.organization.findFirst({
    where: {
      slug: organizationSlug,
      deletedAt: null,
      memberships: { some: { userId: session.user.id } },
    },
    select: { id: true, logoKey: true, logoMimeType: true },
  });
  if (!org?.logoKey || !keyBelongsToOrganization(org.logoKey, org.id)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const body = await getStorage().get(org.logoKey);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": org.logoMimeType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("logo read failed", err);
    return new NextResponse(null, { status: 404 });
  }
}
