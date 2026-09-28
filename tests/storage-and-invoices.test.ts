import { describe, expect, it } from "vitest";
import {
  buildObjectKey,
  isSafeKey,
  keyBelongsToOrganization,
  sanitizeFileName,
} from "../src/lib/storage/keys";
import { detectLogoImageType, MAX_LOGO_BYTES } from "../src/lib/storage/image-type";
import { logoSrcFor } from "../src/lib/storage/logo-url";
import { planInvoiceItemChanges, computeInvoiceTotals, computeItemAmount } from "../src/services/invoice-calc";
import { addDaysISO, parseDateOnly, todayISOInTimeZone, toDateInputValue } from "../src/lib/dates/dates";
import { AppError, toUserMessage } from "../src/lib/errors";

describe("storage keys", () => {
  it("builds tenant-prefixed keys with a sanitized name", () => {
    const key = buildObjectKey("org_abc123", "logo", "My Logo (final).png");
    expect(key).toMatch(/^orgs\/org_abc123\/logo\/[a-z0-9]+-My_Logo_final_.png$/);
    expect(keyBelongsToOrganization(key, "org_abc123")).toBe(true);
  });

  it("never lets a key belong to a different tenant", () => {
    const key = buildObjectKey("orgA", "logo", "logo.png");
    expect(keyBelongsToOrganization(key, "orgB")).toBe(false);
    // Prefix trick: "orgA" must not match "orgAB/..."
    expect(keyBelongsToOrganization("orgs/orgAB/logo/x.png", "orgA")).toBe(false);
  });

  it("rejects path traversal and absolute keys", () => {
    expect(isSafeKey("orgs/a/../b/logo.png")).toBe(false);
    expect(isSafeKey("/etc/passwd")).toBe(false);
    expect(isSafeKey("orgs\\a\\logo.png")).toBe(false);
    expect(isSafeKey("orgs//logo.png")).toBe(false);
    expect(isSafeKey("orgs/a/logo/x.png")).toBe(true);
  });

  it("rejects organization ids that could inject path segments", () => {
    expect(() => buildObjectKey("../evil", "logo", "x.png")).toThrow();
  });

  it("strips directories from uploaded file names", () => {
    expect(sanitizeFileName("C:\\Users\\me\\logo.png")).toBe("logo.png");
    expect(sanitizeFileName("../../..")).toBe("file");
  });
});

describe("logo image detection", () => {
  const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

  it("detects PNG and JPEG by magic bytes", () => {
    expect(detectLogoImageType(PNG)?.mimeType).toBe("image/png");
    expect(detectLogoImageType(JPEG)?.mimeType).toBe("image/jpeg");
  });

  it("rejects SVG, GIF, and files renamed to .png", () => {
    expect(detectLogoImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(detectLogoImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(detectLogoImageType(new TextEncoder().encode("not really a png"))).toBeNull();
  });

  it("caps logos at 2 MB", () => {
    expect(MAX_LOGO_BYTES).toBe(2 * 1024 * 1024);
  });

  it("builds a cache-busting logo URL only when a logo exists", () => {
    expect(logoSrcFor({ slug: "acme", logoKey: null, logoUpdatedAt: null })).toBeNull();
    const src = logoSrcFor({ slug: "acme", logoKey: "orgs/x/logo/a.png", logoUpdatedAt: new Date(1000) });
    expect(src).toBe("/api/logo/acme?v=1000");
  });
});

describe("draft invoice editing — line item plan", () => {
  it("updates known items, creates new ones, deletes removed ones", () => {
    const plan = planInvoiceItemChanges(["a", "b", "c"], [
      { id: "b", description: "kept + edited" },
      { description: "brand new" },
      { id: "a", description: "kept, moved to 3rd" },
    ]);
    expect(plan.update.map((u) => [u.id, u.sortOrder])).toEqual([["b", 0], ["a", 2]]);
    expect(plan.create.map((c) => [c.description, c.sortOrder])).toEqual([["brand new", 1]]);
    expect(plan.deleteIds).toEqual(["c"]);
  });

  it("treats ids from another invoice as new items (never updates them)", () => {
    const plan = planInvoiceItemChanges(["a"], [{ id: "someone-elses-item", description: "x" }]);
    expect(plan.update).toHaveLength(0);
    expect(plan.create).toHaveLength(1);
    expect(plan.create[0].id).toBeUndefined();
    expect(plan.deleteIds).toEqual(["a"]);
  });

  it("does not update the same item twice if the browser duplicates an id", () => {
    const plan = planInvoiceItemChanges(["a"], [
      { id: "a", description: "first" },
      { id: "a", description: "copy" },
    ]);
    expect(plan.update).toHaveLength(1);
    expect(plan.create).toHaveLength(1);
  });

  it("recomputes totals after adding items to a draft", () => {
    const before = computeInvoiceTotals([{ amount: computeItemAmount("10", "150") }]);
    const after = computeInvoiceTotals(
      [
        { amount: computeItemAmount("10", "150") },
        { amount: computeItemAmount("2.5", "150") },
        { amount: computeItemAmount("1", "99.99") },
      ],
      "100",
      "0",
    );
    expect(before.total.toString()).toBe("1500");
    expect(after.subtotal.toString()).toBe("1974.99");
    expect(after.total.toString()).toBe("1874.99");
  });
});

describe("date-only handling", () => {
  it("stores date-only values at noon UTC so they never shift a day", () => {
    const d = parseDateOnly("2026-01-31");
    expect(d.toISOString()).toBe("2026-01-31T12:00:00.000Z");
    expect(toDateInputValue(d)).toBe("2026-01-31");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDaysISO("2026-12-25", 14)).toBe("2027-01-08");
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("uses the workspace timezone for 'today'", () => {
    // 2026-09-28 02:00 UTC is still Sept 27 in Los Angeles.
    const now = new Date("2026-09-28T02:00:00Z");
    expect(todayISOInTimeZone("America/Los_Angeles", now)).toBe("2026-09-27");
    expect(todayISOInTimeZone("UTC", now)).toBe("2026-09-28");
    expect(todayISOInTimeZone("Not/AZone", now)).toBe("2026-09-28");
  });
});

describe("user-facing error messages", () => {
  it("passes through service messages", () => {
    expect(toUserMessage(new AppError("X", "Only draft invoices can be edited."))).toBe("Only draft invoices can be edited.");
    expect(toUserMessage(new Error("Payment exceeds invoice balance."))).toBe("Payment exceeds invoice balance.");
  });

  it("hides database errors", () => {
    const prismaErr = new Error("Unique constraint failed on the fields: (`organizationId`,`invoiceNumber`)");
    prismaErr.name = "PrismaClientKnownRequestError";
    const original = console.error;
    console.error = () => {};
    try {
      expect(toUserMessage(prismaErr, "Could not save.")).toBe("Could not save.");
      expect(toUserMessage(new TypeError("x is undefined"))).not.toContain("undefined");
    } finally {
      console.error = original;
    }
  });
});
