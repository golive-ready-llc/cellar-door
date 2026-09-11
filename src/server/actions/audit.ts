"use server";

import { prisma } from "@/lib/db";
import { resolveServerUserId } from "@/server/auth-guard";

// Audit WRITES live in src/server/audit-log.ts, not here. Every export of a
// "use server" file is a public endpoint, and an open logAudit let anyone
// forge audit entries for any user.

/**
 * Fetch recent audit logs for a user.
 */
export async function getAuditLogs(userId: string, limit: number = 50) {
  const uid = await resolveServerUserId(userId);
  return prisma.auditLog.findMany({
    where: { userId: uid },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
