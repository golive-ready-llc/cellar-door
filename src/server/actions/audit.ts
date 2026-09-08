"use server";

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { resolveServerUserId } from "@/server/auth-guard";

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
