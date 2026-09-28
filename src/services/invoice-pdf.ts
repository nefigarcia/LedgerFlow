import "server-only";
import PDFDocument from "pdfkit";
import type { Prisma } from "@prisma/client";
import { formatMoney, toNumber } from "@/lib/money/money";
import { formatDate } from "@/lib/dates/dates";

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: {
    items: true;
    client: true;
    organization: true;
  };
}>;

export interface RenderInvoiceOptions {
  /** PNG or JPEG bytes of the organization logo, if one is uploaded. */
  logo?: Buffer | null;
}

const PAGE = { width: 612, height: 792, margin: 48 }; // US Letter, points
const CONTENT_W = PAGE.width - PAGE.margin * 2;
const FOOTER_H = 36;
const BOTTOM = PAGE.height - PAGE.margin - FOOTER_H;

const INK = "#0f172a";
const MUTED = "#64748b";
const SOFT = "#334155";
const RULE = "#e2e8f0";
const BAND = "#f1f5f9";
const ACCENT = "#2563eb";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  VIEWED: "SENT",
  PARTIALLY_PAID: "PARTIALLY PAID",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
  VOID: "VOID",
};

/**
 * pdfkit's built-in Helvetica only covers WinAnsi (Latin-1 + a few symbols).
 * Replace typographic characters it can't encode so they don't render as
 * garbage glyphs.
 */
function pdfSafe(text: string): string {
  return text
    .replace(/[−‒–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ");
}

export async function renderInvoicePdf(
  invoice: InvoiceWithRelations,
  options: RenderInvoiceOptions = {},
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margin: PAGE.margin,
        bufferPages: true, // needed to stamp "Page x of y" footers at the end
        info: {
          Title: `Invoice ${invoice.invoiceNumber}`,
          Author: invoice.organization.name,
          Creator: "LedgerFlow",
        },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const currency = invoice.currency;
      const money = (v: Prisma.Decimal | string | number) => pdfSafe(formatMoney(v.toString(), currency));
      const org = invoice.organization;
      const client = invoice.client;
      const L = PAGE.margin;
      const R = PAGE.width - PAGE.margin;

      // ---------- Header ----------
      let leftY = PAGE.margin;
      if (options.logo) {
        try {
          doc.image(options.logo, L, leftY, { fit: [160, 56] });
          leftY += 64;
        } catch (err) {
          // A corrupt image must never block invoicing — fall back to text.
          console.error("invoice logo could not be embedded", err);
        }
      }
      doc.font("Helvetica-Bold").fontSize(options.logo ? 12 : 18).fillColor(INK)
        .text(pdfSafe(org.name), L, leftY, { width: 280 });
      leftY = doc.y + 2;
      doc.font("Helvetica").fontSize(9).fillColor(MUTED);
      const orgLines = [
        org.legalName && org.legalName !== org.name ? org.legalName : null,
        org.addressLine1,
        org.addressLine2,
        [org.addressCity, org.addressState, org.addressPostalCode].filter(Boolean).join(", ") || null,
        org.addressCountry,
        org.phone,
        org.website,
      ].filter(Boolean) as string[];
      for (const line of orgLines) {
        doc.text(pdfSafe(line), L, leftY, { width: 280 });
        leftY = doc.y;
      }

      // Right column: title + meta
      const metaX = 340;
      const metaW = R - metaX;
      doc.font("Helvetica-Bold").fontSize(24).fillColor(INK).text("INVOICE", metaX, PAGE.margin, { width: metaW, align: "right" });
      doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(invoice.invoiceNumber, metaX, doc.y, { width: metaW, align: "right" });
      const statusLabel = STATUS_LABEL[invoice.status] ?? invoice.status;
      if (statusLabel !== "SENT") {
        doc.font("Helvetica-Bold").fontSize(8).fillColor(invoice.status === "PAID" ? "#15803d" : invoice.status === "VOID" ? MUTED : ACCENT)
          .text(statusLabel, metaX, doc.y + 2, { width: metaW, align: "right" });
      }
      let metaY = doc.y + 10;
      const metaRow = (label: string, value: string) => {
        doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(label, metaX, metaY, { width: 90 });
        doc.font("Helvetica").fontSize(9).fillColor(INK).text(pdfSafe(value), metaX + 90, metaY, { width: metaW - 90, align: "right" });
        metaY += 14;
      };
      metaRow("Issue date", formatDate(invoice.issueDate));
      metaRow("Due date", formatDate(invoice.dueDate));
      if (invoice.poNumber) metaRow("PO / Reference", invoice.poNumber);
      if (invoice.currency !== "USD") metaRow("Currency", invoice.currency);

      let y = Math.max(leftY, metaY) + 16;
      doc.moveTo(L, y).lineTo(R, y).lineWidth(1).strokeColor(RULE).stroke();
      y += 16;

      // ---------- Bill to + amount due ----------
      doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("BILL TO", L, y, { characterSpacing: 0.8 });
      let billY = doc.y + 4;
      doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(pdfSafe(client.companyName), L, billY, { width: 280 });
      billY = doc.y + 1;
      doc.font("Helvetica").fontSize(9).fillColor(SOFT);
      const clientLines = [
        client.contactName,
        client.email,
        client.billingAddressLine1,
        client.billingAddressLine2,
        [client.billingAddressCity, client.billingAddressState, client.billingAddressPostalCode].filter(Boolean).join(", ") || null,
        client.billingAddressCountry,
        client.taxReference ? `Tax ref: ${client.taxReference}` : null,
      ].filter(Boolean) as string[];
      for (const line of clientLines) {
        doc.text(pdfSafe(line), L, billY, { width: 280 });
        billY = doc.y;
      }

      // Amount due panel
      const boxW = 190;
      const boxX = R - boxW;
      doc.roundedRect(boxX, y, boxW, 58, 6).fill(BAND);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("AMOUNT DUE", boxX + 12, y + 12, { width: boxW - 24, characterSpacing: 0.8 });
      doc.font("Helvetica-Bold").fontSize(18).fillColor(INK).text(money(invoice.balanceDue), boxX + 12, y + 26, { width: boxW - 24 });

      y = Math.max(billY, y + 58) + 24;

      // ---------- Line items ----------
      const cols = {
        desc: { x: L + 8, w: 262 },
        qty: { x: L + 276, w: 50 },
        unit: { x: L + 330, w: 44 },
        rate: { x: L + 378, w: 64 },
        amount: { x: L + 446, w: CONTENT_W - 454 },
      };
      const drawTableHeader = () => {
        doc.rect(L, y, CONTENT_W, 22).fill(BAND);
        doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED);
        doc.text("DESCRIPTION", cols.desc.x, y + 7, { width: cols.desc.w, characterSpacing: 0.6 });
        doc.text("QTY", cols.qty.x, y + 7, { width: cols.qty.w, align: "right", characterSpacing: 0.6 });
        doc.text("UNIT", cols.unit.x, y + 7, { width: cols.unit.w, align: "right", characterSpacing: 0.6 });
        doc.text("RATE", cols.rate.x, y + 7, { width: cols.rate.w, align: "right", characterSpacing: 0.6 });
        doc.text("AMOUNT", cols.amount.x, y + 7, { width: cols.amount.w, align: "right", characterSpacing: 0.6 });
        y += 28;
      };
      const newPage = () => {
        doc.addPage();
        y = PAGE.margin;
      };
      const ensureSpace = (needed: number, withHeader = false) => {
        if (y + needed > BOTTOM) {
          newPage();
          if (withHeader) drawTableHeader();
        }
      };

      drawTableHeader();
      for (const item of invoice.items) {
        doc.font("Helvetica").fontSize(9.5);
        const desc = pdfSafe(item.description);
        const rowH = Math.max(doc.heightOfString(desc, { width: cols.desc.w }), 12) + 10;
        ensureSpace(rowH, true);
        doc.fillColor(INK).text(desc, cols.desc.x, y, { width: cols.desc.w });
        doc.fillColor(SOFT);
        doc.text(item.quantity.toString(), cols.qty.x, y, { width: cols.qty.w, align: "right" });
        doc.text(item.unit.toLowerCase(), cols.unit.x, y, { width: cols.unit.w, align: "right" });
        doc.text(money(item.rate), cols.rate.x, y, { width: cols.rate.w, align: "right" });
        doc.fillColor(INK).text(money(item.amount), cols.amount.x, y, { width: cols.amount.w, align: "right" });
        y += rowH;
        doc.moveTo(L, y - 5).lineTo(R, y - 5).lineWidth(0.5).strokeColor(RULE).stroke();
      }

      // ---------- Totals ----------
      const rows: Array<{ label: string; value: string; bold?: boolean }> = [
        { label: "Subtotal", value: money(invoice.subtotal) },
      ];
      if (toNumber(invoice.discount) > 0) rows.push({ label: "Discount", value: `-${money(invoice.discount)}` });
      if (toNumber(invoice.taxAmount) > 0) {
        rows.push({ label: `Sales tax (${invoice.taxRate.toString()}%)`, value: money(invoice.taxAmount) });
      }
      rows.push({ label: "Total", value: money(invoice.total), bold: true });
      if (toNumber(invoice.amountPaid) > 0) {
        rows.push({ label: "Amount paid", value: `-${money(invoice.amountPaid)}` });
        rows.push({ label: "Balance due", value: money(invoice.balanceDue), bold: true });
      }
      ensureSpace(rows.length * 18 + 10);
      y += 6;
      const totalsLabelX = R - 230;
      for (const row of rows) {
        if (row.bold) {
          doc.moveTo(totalsLabelX, y - 3).lineTo(R, y - 3).lineWidth(0.5).strokeColor(RULE).stroke();
        }
        doc.font(row.bold ? "Helvetica-Bold" : "Helvetica").fontSize(row.bold ? 11 : 9.5).fillColor(row.bold ? INK : MUTED)
          .text(row.label, totalsLabelX, y, { width: 120 });
        doc.fillColor(INK).text(row.value, totalsLabelX + 120, y, { width: 110, align: "right" });
        y += row.bold ? 20 : 16;
      }

      // ---------- Payment instructions / notes / terms ----------
      const section = (title: string, body: string | null | undefined) => {
        if (!body || !body.trim()) return;
        const text = pdfSafe(body.trim());
        doc.font("Helvetica").fontSize(9);
        const h = doc.heightOfString(text, { width: CONTENT_W }) + 22;
        ensureSpace(Math.min(h, BOTTOM - PAGE.margin));
        y += 10;
        doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text(title.toUpperCase(), L, y, { characterSpacing: 0.8 });
        y = doc.y + 3;
        doc.font("Helvetica").fontSize(9).fillColor(SOFT).text(text, L, y, { width: CONTENT_W });
        y = doc.y + 4;
      };
      y += 8;
      section("Payment instructions", invoice.paymentInstructions);
      section("Notes", invoice.notes);
      section("Terms", invoice.terms);

      // ---------- Footer on every page ----------
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        // Writing inside the bottom margin would make pdfkit add a new page,
        // so drop the margin while stamping the footer.
        const savedBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        const fy = PAGE.height - PAGE.margin + 10;
        doc.moveTo(L, fy - 8).lineTo(R, fy - 8).lineWidth(0.5).strokeColor(RULE).stroke();
        doc.font("Helvetica").fontSize(8).fillColor(MUTED)
          .text(pdfSafe(`${org.name} - ${invoice.invoiceNumber}`), L, fy, { width: CONTENT_W / 2, lineBreak: false });
        doc.text(`Page ${i - range.start + 1} of ${range.count}`, L + CONTENT_W / 2, fy, {
          width: CONTENT_W / 2,
          align: "right",
          lineBreak: false,
        });
        doc.page.margins.bottom = savedBottom;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
