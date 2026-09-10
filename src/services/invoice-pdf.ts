import "server-only";
import PDFDocument from "pdfkit";
import type { Prisma } from "@prisma/client";
import { formatMoney } from "@/lib/money/money";
import { formatDate } from "@/lib/dates/dates";

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: {
    items: true;
    client: true;
    organization: true;
  };
}>;

export async function renderInvoicePdf(invoice: InvoiceWithRelations): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "LETTER", margin: 48 });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const currency = invoice.currency;
      const org = invoice.organization;
      const client = invoice.client;

      // Header
      doc.fillColor("#0f172a").fontSize(20).text(org.name, { continued: false });
      doc.fontSize(10).fillColor("#64748b");
      if (org.legalName && org.legalName !== org.name) doc.text(org.legalName);
      const addressLines = [
        org.addressLine1,
        [org.addressCity, org.addressState, org.addressPostalCode].filter(Boolean).join(", "),
        org.addressCountry,
        org.phone,
        org.website,
      ].filter(Boolean) as string[];
      addressLines.forEach((line) => doc.text(line));

      // Invoice title
      doc.moveTo(48, doc.y + 8).lineTo(564, doc.y + 8).strokeColor("#e2e8f0").stroke();
      doc.moveDown(1);
      doc.fillColor("#0f172a").fontSize(22).text("INVOICE", { align: "right" });
      doc.fontSize(10).fillColor("#64748b").text(invoice.invoiceNumber, { align: "right" });

      // Bill to
      const y = doc.y + 12;
      doc.fillColor("#0f172a").fontSize(11).text("Bill to", 48, y);
      doc.fillColor("#0f172a").fontSize(12).text(client.companyName, 48, y + 14);
      doc.fillColor("#64748b").fontSize(10);
      if (client.contactName) doc.text(client.contactName);
      if (client.email) doc.text(client.email);
      if (client.billingAddressLine1) doc.text(client.billingAddressLine1);
      const clientCityLine = [client.billingAddressCity, client.billingAddressState, client.billingAddressPostalCode]
        .filter(Boolean)
        .join(", ");
      if (clientCityLine) doc.text(clientCityLine);
      if (client.billingAddressCountry) doc.text(client.billingAddressCountry);

      // Invoice meta
      const metaX = 360;
      doc.fillColor("#0f172a").fontSize(10);
      doc.text(`Issue date: ${formatDate(invoice.issueDate)}`, metaX, y);
      doc.text(`Due date: ${formatDate(invoice.dueDate)}`, metaX, y + 14);
      if (invoice.poNumber) doc.text(`PO / Ref: ${invoice.poNumber}`, metaX, y + 28);
      doc.text(`Currency: ${currency}`, metaX, y + 42);

      // Items table
      doc.moveDown(3);
      const tableTop = doc.y + 10;
      const cols = { desc: 48, qty: 320, rate: 400, amount: 490 };
      doc.fillColor("#0f172a").fontSize(10).text("Description", cols.desc, tableTop);
      doc.text("Qty", cols.qty, tableTop, { width: 60, align: "right" });
      doc.text("Rate", cols.rate, tableTop, { width: 80, align: "right" });
      doc.text("Amount", cols.amount, tableTop, { width: 74, align: "right" });
      doc.moveTo(48, tableTop + 14).lineTo(564, tableTop + 14).strokeColor("#e2e8f0").stroke();

      let rowY = tableTop + 22;
      for (const item of invoice.items) {
        doc.fillColor("#0f172a").fontSize(10);
        const descHeight = doc.heightOfString(item.description, { width: 260 });
        doc.text(item.description, cols.desc, rowY, { width: 260 });
        doc.text(item.quantity.toString(), cols.qty, rowY, { width: 60, align: "right" });
        doc.text(formatMoney(item.rate.toString(), currency), cols.rate, rowY, { width: 80, align: "right" });
        doc.text(formatMoney(item.amount.toString(), currency), cols.amount, rowY, { width: 74, align: "right" });
        rowY += Math.max(descHeight, 14) + 6;
      }
      doc.moveTo(48, rowY).lineTo(564, rowY).strokeColor("#e2e8f0").stroke();
      rowY += 10;

      // Totals
      const totalsX = 400;
      const totalsW = 164;
      const drawRow = (label: string, value: string, bold = false) => {
        doc.fillColor(bold ? "#0f172a" : "#64748b").fontSize(bold ? 12 : 10);
        doc.text(label, totalsX, rowY, { width: 90, align: "right" });
        doc.fillColor("#0f172a").text(value, totalsX + 90, rowY, { width: 74, align: "right" });
        rowY += bold ? 18 : 14;
      };
      drawRow("Subtotal", formatMoney(invoice.subtotal.toString(), currency));
      if (Number(invoice.discount) > 0)
        drawRow("Discount", "− " + formatMoney(invoice.discount.toString(), currency));
      if (Number(invoice.taxAmount) > 0)
        drawRow(`Tax (${invoice.taxRate.toString()}%)`, formatMoney(invoice.taxAmount.toString(), currency));
      drawRow("Total", formatMoney(invoice.total.toString(), currency), true);
      if (Number(invoice.amountPaid) > 0) {
        drawRow("Amount paid", formatMoney(invoice.amountPaid.toString(), currency));
        drawRow("Balance due", formatMoney(invoice.balanceDue.toString(), currency), true);
      }

      // Notes
      if (invoice.notes || invoice.paymentInstructions || invoice.terms) {
        doc.moveDown(2);
        if (invoice.paymentInstructions) {
          doc.fillColor("#0f172a").fontSize(10).text("Payment instructions", 48, doc.y);
          doc.fillColor("#334155").text(invoice.paymentInstructions, { width: 516 });
          doc.moveDown();
        }
        if (invoice.notes) {
          doc.fillColor("#0f172a").fontSize(10).text("Notes", 48, doc.y);
          doc.fillColor("#334155").text(invoice.notes, { width: 516 });
          doc.moveDown();
        }
        if (invoice.terms) {
          doc.fillColor("#0f172a").fontSize(10).text("Terms", 48, doc.y);
          doc.fillColor("#334155").text(invoice.terms, { width: 516 });
        }
      }

      // Footer
      doc.fontSize(8).fillColor("#94a3b8").text(
        `Generated by ${org.name} via LedgerFlow`,
        48,
        doc.page.height - 40,
        { align: "center", width: doc.page.width - 96 },
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
