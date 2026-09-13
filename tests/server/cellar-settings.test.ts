import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Whether first-run setup is done, and the cellar's name, used to live only in
 * browser localStorage. Every new device or browser showed "Name Your Cellar"
 * again, and the name never followed the owner. Both now live on the account.
 */

process.env.DATABASE_URL = "postgresql://stub";

const userFindUnique = vi.fn();
const userUpdate = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => userFindUnique(...a),
      update: (...a: unknown[]) => userUpdate(...a),
    },
  },
}));

const resolveServerUserId = vi.fn();
vi.mock("@/server/auth-guard", () => ({
  resolveServerUserId: (id?: string | null) => resolveServerUserId(id),
}));

const assertNotDemo = vi.fn();
vi.mock("@/lib/demo", () => ({ assertNotDemo: (action?: string) => assertNotDemo(action) }));

import { getCellarSettings, saveCellarSettings } from "@/server/actions/cellar-settings";

beforeEach(() => {
  vi.clearAllMocks();
  resolveServerUserId.mockResolvedValue("u-resolved");
  assertNotDemo.mockResolvedValue(undefined);
});

describe("getCellarSettings", () => {
  it("reads the signed-in user's setup flag and cellar name", async () => {
    userFindUnique.mockResolvedValue({ onboardedAt: new Date("2026-09-01"), cellarName: "The Vault" });
    const settings = await getCellarSettings("u-client");
    expect(resolveServerUserId).toHaveBeenCalledWith("u-client");
    expect(userFindUnique.mock.calls[0][0].where).toEqual({ id: "u-resolved" });
    expect(settings).toEqual({ onboarded: true, cellarName: "The Vault" });
  });

  it("reports a new account as not set up", async () => {
    userFindUnique.mockResolvedValue({ onboardedAt: null, cellarName: "" });
    expect(await getCellarSettings("u-client")).toEqual({ onboarded: false, cellarName: "" });
  });
});

describe("saveCellarSettings", () => {
  it("marks setup done and saves a trimmed, capped name for the signed-in user", async () => {
    userUpdate.mockImplementation(async ({ data }: { data: { onboardedAt?: Date; cellarName?: string } }) => ({
      onboardedAt: data.onboardedAt ?? null,
      cellarName: data.cellarName ?? "",
    }));
    const longName = `  ${"A".repeat(100)}  `;
    const saved = await saveCellarSettings({ onboarded: true, cellarName: longName }, "u-client");
    const call = userUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ id: "u-resolved" });
    expect(call.data.onboardedAt).toBeInstanceOf(Date);
    expect(call.data.cellarName).toBe("A".repeat(60));
    expect(saved).toEqual({ onboarded: true, cellarName: "A".repeat(60) });
  });

  it("only changes the fields it is given", async () => {
    userUpdate.mockResolvedValue({ onboardedAt: null, cellarName: "Garage Rack" });
    await saveCellarSettings({ cellarName: "Garage Rack" }, "u-client");
    expect(userUpdate.mock.calls[0][0].data).toEqual({ cellarName: "Garage Rack" });
  });

  it("refuses to write in demo mode", async () => {
    assertNotDemo.mockRejectedValue(new Error("Demo mode is read-only."));
    await expect(saveCellarSettings({ onboarded: true }, "u-client")).rejects.toThrow("read-only");
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
