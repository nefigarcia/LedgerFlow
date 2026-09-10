import { describe, expect, it } from "vitest";
import { hasPermission } from "../src/lib/permissions/permissions";

describe("permissions", () => {
  it("grants OWNER full org access", () => {
    expect(hasPermission("OWNER", "org:delete")).toBe(true);
    expect(hasPermission("OWNER", "distributions:write")).toBe(true);
  });

  it("prevents VIEWER from writing", () => {
    expect(hasPermission("VIEWER", "clients:read")).toBe(true);
    expect(hasPermission("VIEWER", "clients:write")).toBe(false);
    expect(hasPermission("VIEWER", "distributions:write")).toBe(false);
  });

  it("ACCOUNTANT can touch financial writes but not org delete", () => {
    expect(hasPermission("ACCOUNTANT", "distributions:write")).toBe(true);
    expect(hasPermission("ACCOUNTANT", "taxes:write")).toBe(true);
    expect(hasPermission("ACCOUNTANT", "org:delete")).toBe(false);
  });

  it("MEMBER cannot manage members or delete org", () => {
    expect(hasPermission("MEMBER", "members:manage")).toBe(false);
    expect(hasPermission("MEMBER", "org:delete")).toBe(false);
    expect(hasPermission("MEMBER", "clients:write")).toBe(true);
  });
});
