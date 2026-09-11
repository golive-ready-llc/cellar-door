import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Unit tests for `src/server/auth-guard.ts`.
 *
 * getAuthenticatedUserId() verifies the httpOnly `__session` Firebase session
 * cookie. resolveServerUserId() is STRICT: it returns the verified id or throws
 * Unauthorized — it never trusts a client-supplied userId (IDOR fix).
 * requireAdmin() gates the admin server actions on the same Firebase ID token
 * the client sends them.
 */

process.env.DATABASE_URL = "postgresql://stub";

const cookieGetSpy = vi.fn();
const verifySessionCookieSpy = vi.fn();
const verifyIdTokenSpy = vi.fn();
const userFindUniqueSpy = vi.fn();
const getAdminAuthSpy = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: cookieGetSpy }),
}));

vi.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => getAdminAuthSpy(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: userFindUniqueSpy },
  },
}));

beforeEach(() => {
  cookieGetSpy.mockReset();
  verifySessionCookieSpy.mockReset();
  verifyIdTokenSpy.mockReset();
  userFindUniqueSpy.mockReset();
  getAdminAuthSpy.mockReset();
  getAdminAuthSpy.mockReturnValue({
    verifySessionCookie: verifySessionCookieSpy,
    verifyIdToken: verifyIdTokenSpy,
  });
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

describe("missing DATABASE_URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the fixed dev identity only outside production", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const { getAuthenticatedUserId } = await import("@/server/auth-guard");
    expect(await getAuthenticatedUserId()).toBe("dev-user-001");
  });

  it("fails closed in production: no session means no identity", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    cookieGetSpy.mockReturnValue(undefined);
    const { getAuthenticatedUserId } = await import("@/server/auth-guard");
    expect(await getAuthenticatedUserId()).toBeNull();
  });
});

describe("requireAdmin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("admits the ADMIN_EMAIL account, whatever its case", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    verifyIdTokenSpy.mockResolvedValue({ uid: "fb-1", email: "Admin@Example.com" });
    const { requireAdmin } = await import("@/server/auth-guard");
    expect(await requireAdmin("token")).toEqual({
      ok: true,
      email: "Admin@Example.com",
      uid: "fb-1",
    });
  });

  it("rejects a signed-in user who is not the admin", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    verifyIdTokenSpy.mockResolvedValue({ uid: "fb-2", email: "someone@else.com" });
    const { requireAdmin } = await import("@/server/auth-guard");
    expect(await requireAdmin("token")).toEqual({
      ok: false,
      error: "Access denied. You are not an admin.",
    });
  });

  it("rejects a token with no email claim", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    verifyIdTokenSpy.mockResolvedValue({ uid: "fb-3" });
    const { requireAdmin } = await import("@/server/auth-guard");
    const result = await requireAdmin("token");
    expect(result.ok).toBe(false);
  });

  it("fails closed when ADMIN_EMAIL is unset — nobody is an admin", async () => {
    vi.stubEnv("ADMIN_EMAIL", "");
    verifyIdTokenSpy.mockResolvedValue({ uid: "fb-1", email: "admin@example.com" });
    const { requireAdmin } = await import("@/server/auth-guard");
    const result = await requireAdmin("token");
    expect(result.ok).toBe(false);
  });

  it("reports a failed verification without leaking the reason", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    verifyIdTokenSpy.mockRejectedValue(new Error("Firebase ID token has expired"));
    const { requireAdmin } = await import("@/server/auth-guard");
    expect(await requireAdmin("stale")).toEqual({
      ok: false,
      error: "Authentication failed",
    });
  });

  it("returns no identity when Firebase is not configured", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    getAdminAuthSpy.mockReturnValue(null);
    const { requireAdmin } = await import("@/server/auth-guard");
    expect((await requireAdmin("token")).ok).toBe(false);
    expect(verifyIdTokenSpy).not.toHaveBeenCalled();
  });
});
