import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export function formatInvoiceNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(3, "0")}`;
}

/**
 * Reserve the next invoice number atomically.
 *
 * Uses an optimistic `updateMany` on invoiceNextNumber so concurrent requests
 * never receive the same number. Numbers that already exist (for example
 * after someone lowers "Next invoice number" in Settings) are skipped instead
 * of failing on the unique constraint.
 */
export async function reserveInvoiceNumber(
  organizationId: string,
  tx?: Prisma.TransactionClient,
  issueDate: Date = new Date(),
): Promise<string> {
  const client = tx ?? prisma;
  const year = issueDate.getUTCFullYear();

  for (let attempt = 0; attempt < 50; attempt++) {
    const org = await client.organization.findUnique({
      where: { id: organizationId },
      select: { invoicePrefix: true, invoiceNextNumber: true },
    });
    if (!org) throw new Error("Organization not found");
    const current = org.invoiceNextNumber;
    const updated = await client.organization.updateMany({
      where: { id: organizationId, invoiceNextNumber: current },
      data: { invoiceNextNumber: current + 1 },
    });
    if (updated.count !== 1) continue; // lost the race — retry with the new value

    const candidate = formatInvoiceNumber(org.invoicePrefix, year, current);
    const taken = await client.invoice.findFirst({
      where: { organizationId, invoiceNumber: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  throw new Error("Could not reserve an invoice number. Check the next invoice number in Settings.");
}
