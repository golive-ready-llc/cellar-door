// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Audit-log writes must not be exported from any "use server" module: every
 * such export is a public endpoint, and an open logAudit let anyone forge
 * entries for any user. Writes live in the plain module @/server/audit-log.
 */

process.env.DATABASE_URL = "postgresql://stub";

const auditCreate = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { auditLog: { create: (...a: unknown[]) => auditCreate(...a) } },
}));

const ACTIONS_DIR = path.resolve(process.cwd(), "src", "server", "actions");

function publicActionModules(): string[] {
  return fs
    .readdirSync(ACTIONS_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.join(ACTIONS_DIR, f));
}

describe("audit log", () => {
  it("is not writable through any public server-action module", () => {
    const offenders = publicActionModules().filter((file) =>
      /export\s+(async\s+)?function\s+logAudit\b/.test(
        fs.readFileSync(file, "utf8")
      )
    );
    expect(offenders).toEqual([]);
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
