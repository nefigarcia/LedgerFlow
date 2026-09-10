import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : String(v);
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header.map(csvEscape).join(",")];
  for (const r of rows) lines.push(r.map(csvEscape).join(","));
  return lines.join("\n");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { type } = await params;
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: session.user.id, organization: { slug } },
    include: { organization: { select: { id: true } } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const organizationId = membership.organization.id;

  let csv = "";
  let filename = "";
  switch (type) {
    case "invoices": {
      const rows = await prisma.invoice.findMany({
        where: { organizationId },
        orderBy: { issueDate: "desc" },
        include: { client: { select: { companyName: true } } },
      });
      csv = toCsv(
        ["Invoice", "Client", "Issued", "Due", "Status", "Total", "Amount paid", "Balance"],
        rows.map((r) => [
          r.invoiceNumber,
          r.client.companyName,
          r.issueDate.toISOString().slice(0, 10),
          r.dueDate.toISOString().slice(0, 10),
          r.status,
          r.total.toString(),
          r.amountPaid.toString(),
          r.balanceDue.toString(),
        ]),
      );
      filename = "invoices.csv";
      break;
    }
    case "expenses": {
      const rows = await prisma.expense.findMany({
        where: { organizationId },
        orderBy: { date: "desc" },
        include: { category: true, vendor: true },
      });
      csv = toCsv(
        ["Date", "Description", "Category", "Vendor", "Amount", "Tax deductible"],
        rows.map((r) => [
          r.date.toISOString().slice(0, 10),
          r.description,
          r.category?.name ?? "",
          r.vendor?.name ?? "",
          r.amount.toString(),
          r.taxDeductible ? "Yes" : "No",
        ]),
      );
      filename = "expenses.csv";
      break;
    }
    case "payments": {
      const rows = await prisma.payment.findMany({
        where: { organizationId },
        orderBy: { date: "desc" },
        include: { invoice: true, client: true },
      });
      csv = toCsv(
        ["Date", "Amount", "Method", "Invoice", "Client", "Reference"],
        rows.map((r) => [
          r.date.toISOString().slice(0, 10),
          r.amount.toString(),
          r.method,
          r.invoice?.invoiceNumber ?? "",
          r.client?.companyName ?? "",
          r.reference ?? "",
        ]),
      );
      filename = "payments.csv";
      break;
    }
    case "clients": {
      const rows = await prisma.client.findMany({ where: { organizationId } });
      csv = toCsv(
        ["Company", "Contact", "Email", "Phone", "Active"],
        rows.map((r) => [r.companyName, r.contactName ?? "", r.email ?? "", r.phone ?? "", r.active ? "Yes" : "No"]),
      );
      filename = "clients.csv";
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown export" }, { status: 400 });
  }
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
