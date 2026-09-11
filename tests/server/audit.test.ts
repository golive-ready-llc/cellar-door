import { describe, it, expect, vi } from "vitest";

/**
 * Audit-log writes must not be exported from a "use server" module: every
 * such export is a public endpoint, and an open logAudit let anyone forge
 * entries for any user. Writes live in the plain module @/server/audit-log.
 */

process.env.DATABASE_URL = "postgresql://stub";

const auditCreate = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { auditLog: { create: (...a: unknown[]) => auditCreate(...a), findMany: vi.fn() } },
}));
vi.mock("@/server/auth-guard", () => ({ resolveServerUserId: vi.fn() }));

describe("audit log", () => {
  it("is not writable through the public server-action module", async () => {
    const actions = await import("@/server/actions/audit");
    expect(Object.keys(actions)).not.toContain("logAudit");
  });

  it("still records entries from server code", async () => {
    auditCreate.mockResolvedValue({});
    const { logAudit } = await import("@/server/audit-log");
    await logAudit("u1", "wine.consume", "w1", { name: "Test" });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "u1", action: "wine.consume", target: "w1" }),
    });
  });
});
