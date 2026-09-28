import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { renderInvoicePdf } from "@/services/invoice-pdf";
import { getStorage } from "@/lib/storage/storage";
import { keyBelongsToOrganization } from "@/lib/storage/keys";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { invoiceId } = await params;
  // Tenant check: the invoice must belong to an organization the user is a member of.
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      organization: {
        deletedAt: null,
        memberships: { some: { userId: session.user.id } },
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } }, client: true, organization: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let logo: Buffer | null = null;
  const { logoKey, id: orgId } = invoice.organization;
  if (logoKey && keyBelongsToOrganization(logoKey, orgId)) {
    try {
      logo = await getStorage().get(logoKey);
    } catch (err) {
      // Missing/unreachable logo should never block a PDF.
      console.error("invoice pdf: logo unavailable", err);
    }
  }

  try {
    const pdf = await renderInvoicePdf(invoice, { logo });
    const download = new URL(req.url).searchParams.get("download") === "1";
    const safeName = invoice.invoiceNumber.replace(/[^a-zA-Z0-9._-]/g, "_");
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("invoice pdf render failed", err);
    return NextResponse.json({ error: "Could not generate the PDF." }, { status: 500 });
  }
}
