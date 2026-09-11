import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!slug) return NextResponse.json({ results: [] });
  if (q.length < 1) return NextResponse.json({ results: [] });

  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: session.user.id, organization: { slug } },
    include: { organization: { select: { id: true, slug: true } } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const orgId = membership.organization.id;
  const base = `/app/${membership.organization.slug}`;

  const contains = { contains: q };
  const [clients, projects, invoices, expenses] = await Promise.all([
    prisma.client.findMany({
      where: {
        organizationId: orgId,
        OR: [{ companyName: contains }, { contactName: contains }, { email: contains }],
      },
      take: 5,
      select: { id: true, companyName: true, contactName: true },
    }),
    prisma.project.findMany({
      where: {
        organizationId: orgId,
        OR: [{ name: contains }, { description: contains }],
      },
      take: 5,
      select: { id: true, name: true, client: { select: { companyName: true } } },
    }),
    prisma.invoice.findMany({
      where: {
        organizationId: orgId,
        OR: [{ invoiceNumber: contains }, { poNumber: contains }],
      },
      take: 5,
      select: { id: true, invoiceNumber: true, client: { select: { companyName: true } } },
    }),
    prisma.expense.findMany({
      where: {
        organizationId: orgId,
        description: contains,
      },
      take: 5,
      select: { id: true, description: true, amount: true, category: { select: { name: true } } },
    }),
  ]);

  const results = [
    ...clients.map((c) => ({
      type: "client" as const,
      id: c.id,
      primary: c.companyName,
      secondary: c.contactName ?? undefined,
      href: `${base}/clients/${c.id}`,
    })),
    ...projects.map((p) => ({
      type: "project" as const,
      id: p.id,
      primary: p.name,
      secondary: p.client?.companyName,
      href: `${base}/projects/${p.id}`,
    })),
    ...invoices.map((i) => ({
      type: "invoice" as const,
      id: i.id,
      primary: i.invoiceNumber,
      secondary: i.client?.companyName,
      href: `${base}/invoices/${i.id}`,
    })),
    ...expenses.map((e) => ({
      type: "expense" as const,
      id: e.id,
      primary: e.description.slice(0, 80),
      secondary: e.category?.name,
      href: `${base}/expenses`,
    })),
  ];

  return NextResponse.json({ results });
}
