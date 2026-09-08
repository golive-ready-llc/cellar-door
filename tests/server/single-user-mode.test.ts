import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Single-user mode disables authentication, so the most important thing these
 * tests pin is that it stays OFF unless explicitly and exactly enabled.
 */

const ORIGINAL = process.env.NEXT_PUBLIC_SINGLE_USER_MODE;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SINGLE_USER_MODE;
  else process.env.NEXT_PUBLIC_SINGLE_USER_MODE = ORIGINAL;
  vi.resetModules();
});

describe("isSingleUserMode — must fail closed", () => {
  async function load() {
    vi.resetModules();
    return (await import("@/lib/single-user")).isSingleUserMode();
  }

  it("is off when the variable is unset", async () => {
    delete process.env.NEXT_PUBLIC_SINGLE_USER_MODE;
    expect(await load()).toBe(false);
  });

  it("is on only for the exact string 'true'", async () => {
    process.env.NEXT_PUBLIC_SINGLE_USER_MODE = "true";
    expect(await load()).toBe(true);
  });

  it.each(["", "false", "TRUE", "True", "1", "yes", "on", " true", "true "])(
    "stays off for %o",
    async (value) => {
      process.env.NEXT_PUBLIC_SINGLE_USER_MODE = value;
      expect(await load()).toBe(false);
    }
  );
});

describe("single-user identity constants", () => {
  it("uses a sentinel uid that cannot collide with a real Firebase uid", async () => {
    const m = await import("@/lib/single-user");
    // Firebase uids are 28-char alphanumerics; this is neither.
    expect(m.SINGLE_USER_FIREBASE_UID).toBe("single-user-mode-owner");
    expect(m.SINGLE_USER_FIREBASE_UID).toContain("-");
    expect(m.SINGLE_USER_FIREBASE_UID.length).not.toBe(28);
  });
});

describe("getSingleUserProfile — refuses to work when the mode is off", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns null when single-user mode is disabled", async () => {
    delete process.env.NEXT_PUBLIC_SINGLE_USER_MODE;

    vi.doMock("@/lib/db", () => ({ prisma: {} }));
    vi.doMock("@/lib/firebase-admin", () => ({ getAdminAuth: () => null }));

    const { getSingleUserProfile } = await import("@/server/actions/auth");
    // The guard must short-circuit before touching the database at all.
    await expect(getSingleUserProfile()).resolves.toBeNull();
  });
});
