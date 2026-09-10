import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Reserve the next invoice number atomically.
 * Uses an updateMany with an optimistic check so we never issue duplicates
 * even under concurrent requests. Retries on contention.
 */
export async function reserveInvoiceNumber(
  organizationId: string,
  tx?: Prisma.TransactionClient,
): Promise<string> {
  const client = tx ?? prisma;
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < 8; attempt++) {
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
    if (updated.count === 1) {
      const padded = String(current).padStart(3, "0");
      return `${org.invoicePrefix}-${year}-${padded}`;
    }
  }
  throw new Error("Could not reserve invoice number");
}
