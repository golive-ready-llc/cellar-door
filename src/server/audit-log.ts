/**
 * Audit-trail writes.
 *
 * Deliberately NOT a "use server" module. Every export of such a file is a
 * publicly callable endpoint, and an exported logAudit let anyone forge audit
 * entries for any user. Only server code calls this; reads stay in
 * src/server/actions/audit.ts.
 */
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

/**
 * Log a sensitive action to the audit trail.
 * Designed to be called fire-and-forget: `void logAudit(...)`.
 */
export async function logAudit(
  userId: string,
  action: string,
  target?: string,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        target: target ?? null,
        metadata: (metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Fire-and-forget — never block the main action
  }
}
