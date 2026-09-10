"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { slugify } from "@/lib/utils";
import { createId } from "@paralleldrive/cuid2";
import { ok, fail, fromZodError, type ActionResult } from "@/lib/validation/result";
import { recordActivity, recordAudit } from "@/lib/audit/audit";
import { toDecimal, moneySum } from "@/lib/money/money";
import { BusinessType } from "@prisma/client";

const DEFAULT_EXPENSE_CATEGORIES = [
  "Software & SaaS",
  "Professional services",
  "Advertising & marketing",
  "Travel",
  "Meals",
  "Office",
  "Equipment",
  "Insurance",
  "Bank fees",
  "Contract labor",
  "Education",
  "Utilities",
  "Vehicle",
  "Taxes & licenses",
  "Other",
];

const ownerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  ownershipPercentage: z.coerce.number().min(0).max(100),
  distributionPercentage: z.coerce.number().min(0).max(100),
  taxReserveOverride: z.coerce.number().min(0).max(100).optional().nullable(),
});

const createOrgSchema = z.object({
  name: z.string().min(1).max(120),
  legalName: z.string().max(200).optional().nullable(),
  businessType: z.nativeEnum(BusinessType),
  country: z.string().min(2).max(2).default("US"),
  state: z.string().max(80).optional().nullable(),
  currency: z.string().min(3).max(3).default("USD"),
  timezone: z.string().default("America/New_York"),
  fiscalYearStartMonth: z.coerce.number().min(1).max(12).default(1),
  taxIdLastFour: z.string().max(4).optional().nullable(),
  addressLine1: z.string().max(200).optional().nullable(),
  addressCity: z.string().max(120).optional().nullable(),
  addressState: z.string().max(80).optional().nullable(),
  addressPostalCode: z.string().max(20).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  website: z.string().max(200).optional().nullable(),
  invoicePrefix: z.string().min(1).max(10).default("INV"),
  invoiceNextNumber: z.coerce.number().min(1).default(1),
  defaultPaymentTermsDays: z.coerce.number().min(0).max(365).default(14),
  defaultTaxReserveRate: z.coerce.number().min(0).max(100).default(25),
  openingBalance: z.coerce.number().default(0),
  owners: z.array(ownerSchema).min(1, "Add at least one owner"),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || `org-${createId().slice(0, 6)}`;
  let slug = base;
  let n = 0;
  // Try a bounded number of times.
  while (n < 20) {
    const exists = await prisma.organization.findUnique({ where: { slug } });
    if (!exists) return slug;
    n++;
    slug = `${base}-${createId().slice(0, 4)}`;
  }
  return `${base}-${createId().slice(0, 8)}`;
}

export async function createOrganizationAction(
  payload: unknown,
): Promise<ActionResult<{ organizationSlug: string }>> {
  const user = await requireUser();
  const parsed = createOrgSchema.safeParse(payload);
  if (!parsed.success) return fromZodError(parsed.error);
  const data = parsed.data;

  const ownershipTotal = moneySum(data.owners.map((o) => o.ownershipPercentage));
  if (!toDecimal(100).minus(ownershipTotal).abs().lt("0.01")) {
    return fail("VALIDATION_ERROR", "Owner ownership percentages must total 100%.");
  }
  const distTotal = moneySum(data.owners.map((o) => o.distributionPercentage));
  if (!toDecimal(100).minus(distTotal).abs().lt("0.01")) {
    return fail("VALIDATION_ERROR", "Owner distribution percentages must total 100%.");
  }

  const slug = await generateUniqueSlug(data.name);

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        name: data.name.trim(),
        legalName: data.legalName?.trim() || null,
        slug,
        businessType: data.businessType,
        country: data.country,
        state: data.state ?? null,
        currency: data.currency,
        timezone: data.timezone,
        fiscalYearStartMonth: data.fiscalYearStartMonth,
        taxIdLastFour: data.taxIdLastFour ?? null,
        addressLine1: data.addressLine1 ?? null,
        addressCity: data.addressCity ?? null,
        addressState: data.addressState ?? null,
        addressPostalCode: data.addressPostalCode ?? null,
        addressCountry: data.country,
        phone: data.phone ?? null,
        website: data.website ?? null,
        invoicePrefix: data.invoicePrefix.toUpperCase(),
        invoiceNextNumber: data.invoiceNextNumber,
        defaultPaymentTermsDays: data.defaultPaymentTermsDays,
        defaultTaxReserveRate: data.defaultTaxReserveRate.toString(),
        openingBalance: data.openingBalance.toString(),
        openingBalanceDate: new Date(),
      },
    });
    await tx.organizationMembership.create({
      data: {
        organizationId: created.id,
        userId: user.id,
        role: "OWNER",
      },
    });
    await tx.taxProfile.create({
      data: {
        organizationId: created.id,
        reserveRate: data.defaultTaxReserveRate.toString(),
      },
    });
    await tx.expenseCategory.createMany({
      data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
        organizationId: created.id,
        name,
        isSystem: true,
      })),
    });
    for (const o of data.owners) {
      await tx.owner.create({
        data: {
          organizationId: created.id,
          name: o.name.trim(),
          email: o.email && o.email.length ? o.email.trim().toLowerCase() : null,
          ownershipPercentage: o.ownershipPercentage.toString(),
          distributionPercentage: o.distributionPercentage.toString(),
          taxReserveOverride:
            o.taxReserveOverride == null || Number.isNaN(o.taxReserveOverride)
              ? null
              : o.taxReserveOverride.toString(),
        },
      });
    }

    await recordActivity(
      {
        organizationId: created.id,
        actorUserId: user.id,
        action: "org.create",
        entityType: "Organization",
        entityId: created.id,
        message: `${user.name ?? user.email} created ${created.name}`,
      },
      tx,
    );
    await recordAudit(
      {
        organizationId: created.id,
        actorUserId: user.id,
        action: "CREATE",
        entityType: "Organization",
        entityId: created.id,
        after: { name: created.name, businessType: created.businessType },
      },
      tx,
    );

    return created;
  });

  return ok({ organizationSlug: org.slug });
}
