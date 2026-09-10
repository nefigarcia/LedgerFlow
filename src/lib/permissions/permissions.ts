import { OrganizationRole } from "@prisma/client";

export type Permission =
  | "org:manage"
  | "org:delete"
  | "members:manage"
  | "billing:manage"
  | "owners:manage"
  | "clients:read"
  | "clients:write"
  | "projects:read"
  | "projects:write"
  | "time:read"
  | "time:write"
  | "invoices:read"
  | "invoices:write"
  | "invoices:send"
  | "payments:read"
  | "payments:write"
  | "expenses:read"
  | "expenses:write"
  | "distributions:read"
  | "distributions:write"
  | "taxes:read"
  | "taxes:write"
  | "reports:read"
  | "ai:use"
  | "settings:read"
  | "settings:write";

const READ_ALL: Permission[] = [
  "clients:read",
  "projects:read",
  "time:read",
  "invoices:read",
  "payments:read",
  "expenses:read",
  "distributions:read",
  "taxes:read",
  "reports:read",
  "settings:read",
];

const WRITE_ALL: Permission[] = [
  "clients:write",
  "projects:write",
  "time:write",
  "invoices:write",
  "invoices:send",
  "payments:write",
  "expenses:write",
];

const FINANCIAL_WRITE: Permission[] = [
  "distributions:write",
  "taxes:write",
];

export const ROLE_PERMISSIONS: Record<OrganizationRole, Permission[]> = {
  OWNER: [
    "org:manage",
    "org:delete",
    "members:manage",
    "billing:manage",
    "owners:manage",
    "settings:write",
    "ai:use",
    ...READ_ALL,
    ...WRITE_ALL,
    ...FINANCIAL_WRITE,
  ],
  ADMIN: [
    "org:manage",
    "members:manage",
    "settings:write",
    "ai:use",
    ...READ_ALL,
    ...WRITE_ALL,
    ...FINANCIAL_WRITE,
  ],
  ACCOUNTANT: [
    "ai:use",
    "settings:write",
    ...READ_ALL,
    "expenses:write",
    "payments:write",
    "invoices:write",
    "invoices:send",
    "distributions:write",
    "taxes:write",
  ],
  MEMBER: [
    "ai:use",
    ...READ_ALL,
    "clients:write",
    "projects:write",
    "time:write",
    "invoices:write",
    "expenses:write",
  ],
  VIEWER: [...READ_ALL],
};

export function hasPermission(role: OrganizationRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(
  role: OrganizationRole,
  permission: Permission,
): void {
  if (!hasPermission(role, permission)) {
    throw new PermissionError(
      `Role ${role} lacks permission ${permission}`,
    );
  }
}

export class PermissionError extends Error {
  code = "FORBIDDEN" as const;
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}
