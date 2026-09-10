import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { AuditAction, Prisma } from "@prisma/client";

export type AuditEntry = {
  organizationId: string;
  actorUserId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

export async function recordAudit(entry: AuditEntry, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  try {
    await client.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: (entry.before ?? null) as Prisma.InputJsonValue,
        after: (entry.after ?? null) as Prisma.InputJsonValue,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    // Audit logging should never break user actions.
    console.error("audit log failed", err);
  }
}

export async function recordActivity(
  args: {
    organizationId: string;
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    message: string;
    metadata?: Record<string, unknown>;
  },
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;
  try {
    await client.activityLog.create({
      data: {
        organizationId: args.organizationId,
        actorUserId: args.actorUserId ?? null,
        action: args.action,
        entityType: args.entityType,
        entityId: args.entityId ?? null,
        message: args.message,
        metadata: (args.metadata ?? null) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("activity log failed", err);
  }
}
