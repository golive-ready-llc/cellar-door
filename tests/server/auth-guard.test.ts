import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for `src/server/auth-guard.ts`.
 *
 * getAuthenticatedUserId() verifies the httpOnly `__session` Firebase session
 * cookie. resolveServerUserId() is STRICT: it returns the verified id or throws
 * Unauthorized — it never trusts a client-supplied userId (IDOR fix).
 */

process.env.DATABASE_URL = "postgresql://stub";

const cookieGetSpy = vi.fn();
const verifySessionCookieSpy = vi.fn();
const userFindUniqueSpy = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: cookieGetSpy }),
}));

vi.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => ({ verifySessionCookie: verifySessionCookieSpy }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: userFindUniqueSpy },
  },
}));

beforeEach(() => {
  cookieGetSpy.mockReset();
  verifySessionCookieSpy.mockReset();
  userFindUniqueSpy.mockReset();
});

describe("getAuthenticatedUserId", () => {
  it("returns null when no __session cookie present", async () => {
    cookieGetSpy.mockReturnValue(undefined);
    const { getAuthenticatedUserId } = await import("@/server/auth-guard");
    expect(await getAuthenticatedUserId()).toBeNull();
    expect(verifySessionCookieSpy).not.toHaveBeenCalled();
  });

  it("returns null when session-cookie verification throws", async () => {
    cookieGetSpy.mockReturnValue({ value: "bogus-cookie" });
    verifySessionCookieSpy.mockRejectedValue(new Error("invalid cookie"));
    const { getAuthenticatedUserId } = await import("@/server/auth-guard");
    expect(await getAuthenticatedUserId()).toBeNull();
  });

  it("returns null when prisma user lookup yields no row", async () => {
    cookieGetSpy.mockReturnValue({ value: "good-cookie" });
    verifySessionCookieSpy.mockResolvedValue({ uid: "fb-uid-1" });
    userFindUniqueSpy.mockResolvedValue(null);
    const { getAuthenticatedUserId } = await import("@/server/auth-guard");
    expect(await getAuthenticatedUserId()).toBeNull();
  });

  it("returns the Prisma user id on a valid session cookie", async () => {
    cookieGetSpy.mockReturnValue({ value: "good-cookie" });
    verifySessionCookieSpy.mockResolvedValue({ uid: "fb-uid-1" });
    userFindUniqueSpy.mockResolvedValue({ id: "prisma-user-1" });
    const { getAuthenticatedUserId } = await import("@/server/auth-guard");
    expect(await getAuthenticatedUserId()).toBe("prisma-user-1");
    expect(userFindUniqueSpy).toHaveBeenCalledWith({
      where: { firebaseUid: "fb-uid-1" },
      select: { id: true },
    });
    // checkRevoked=false (no per-request Firebase round trip).
    expect(verifySessionCookieSpy).toHaveBeenCalledWith("good-cookie", false);
  });

  it("returns null when cookies() itself throws", async () => {
    cookieGetSpy.mockImplementation(() => {
      throw new Error("cookies not available");
    });
    const { getAuthenticatedUserId } = await import("@/server/auth-guard");
    expect(await getAuthenticatedUserId()).toBeNull();
  });
});

describe("resolveServerUserId (strict — cookie required)", () => {
  it("returns the verified id when the session cookie is valid", async () => {
    cookieGetSpy.mockReturnValue({ value: "good-cookie" });
    verifySessionCookieSpy.mockResolvedValue({ uid: "fb-uid-1" });
    userFindUniqueSpy.mockResolvedValue({ id: "verified-user" });
    const { resolveServerUserId } = await import("@/server/auth-guard");
    expect(await resolveServerUserId()).toBe("verified-user");
  });

  it("throws Unauthorized when no cookie is present (no clientUserId fallback)", async () => {
    cookieGetSpy.mockReturnValue(undefined);
    const { resolveServerUserId } = await import("@/server/auth-guard");
    // Even WITH a client-supplied id, a missing cookie is Unauthorized — this
    // is the IDOR fix: client ids are never trusted.
    await expect(resolveServerUserId("client-user-1")).rejects.toThrow("Unauthorized");
    await expect(resolveServerUserId()).rejects.toThrow("Unauthorized");
    await expect(resolveServerUserId(null)).rejects.toThrow("Unauthorized");
  });

  it("throws Unauthorized when cookie verification fails, even with a client id", async () => {
    cookieGetSpy.mockReturnValue({ value: "bad-cookie" });
    verifySessionCookieSpy.mockRejectedValue(new Error("expired"));
    const { resolveServerUserId } = await import("@/server/auth-guard");
    await expect(resolveServerUserId("client-user-2")).rejects.toThrow("Unauthorized");
  });

  it("ignores a mismatched client id (returns the verified id) and warns", async () => {
    cookieGetSpy.mockReturnValue({ value: "good-cookie" });
    verifySessionCookieSpy.mockResolvedValue({ uid: "fb-uid-1" });
    userFindUniqueSpy.mockResolvedValue({ id: "verified-user" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { resolveServerUserId } = await import("@/server/auth-guard");
    // Attacker passes a victim's id — they still only get their own verified id.
    expect(await resolveServerUserId("victim-user-id")).toBe("verified-user");
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("victim-user-id");
    expect(warnSpy.mock.calls[0][0]).toContain("verified-user");
    warnSpy.mockRestore();
  });

  it("does not warn when the client id matches the verified id", async () => {
    cookieGetSpy.mockReturnValue({ value: "good-cookie" });
    verifySessionCookieSpy.mockResolvedValue({ uid: "fb-uid-1" });
    userFindUniqueSpy.mockResolvedValue({ id: "verified-user" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { resolveServerUserId } = await import("@/server/auth-guard");
    expect(await resolveServerUserId("verified-user")).toBe("verified-user");
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("throws Unauthorized when the cookie's user row is missing", async () => {
    cookieGetSpy.mockReturnValue({ value: "good-cookie" });
    verifySessionCookieSpy.mockResolvedValue({ uid: "fb-uid-1" });
    userFindUniqueSpy.mockResolvedValue(null);
    const { resolveServerUserId } = await import("@/server/auth-guard");
    await expect(resolveServerUserId("client-fallback")).rejects.toThrow("Unauthorized");
  });
});
