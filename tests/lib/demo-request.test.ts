// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Server-side demo detection.
 *
 * It used to trust the `demo_mode` cookie alone, so a signed-in owner with a
 * cookie left over from a /demo visit had every write refused as read-only
 * and got canned demo chat replies. A demo cookie next to a valid session is
 * therefore not a demo request.
 *
 * Only a session that verifies counts: a demo visitor carrying a session
 * cookie that doesn't verify (expired, or left behind by a sign-out) must stay
 * in demo mode. Treating the cookie's mere presence as signed-in turned their
 * AI calls into "Unauthorized" 500 errors in production.
 */

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    }),
}));

const getAuthenticatedUserId = vi.hoisted(() => vi.fn());
vi.mock("@/server/auth-guard", () => ({
  getAuthenticatedUserId: () => getAuthenticatedUserId(),
}));

import { isDemoRequest, clearDemoCookies, DEMO_COOKIE, DEMO_SESSION_COOKIE } from "@/lib/demo";

describe("isDemoRequest", () => {
  beforeEach(() => {
    jar.clear();
    getAuthenticatedUserId.mockReset();
  });

  it("is true for a visitor with only the demo cookie", async () => {
    jar.set("demo_mode", "true");
    expect(await isDemoRequest()).toBe(true);
    expect(getAuthenticatedUserId).not.toHaveBeenCalled();
  });

  it("is false for a signed-in user whose session verifies", async () => {
    jar.set("demo_mode", "true");
    jar.set("__session", "a-valid-session");
    getAuthenticatedUserId.mockResolvedValue("u-real");
    expect(await isDemoRequest()).toBe(false);
  });

  it("stays true when the session cookie does not verify", async () => {
    jar.set("demo_mode", "true");
    jar.set("__session", "an-expired-session");
    getAuthenticatedUserId.mockResolvedValue(null);
    expect(await isDemoRequest()).toBe(true);
  });

  it("is false without the demo cookie", async () => {
    jar.set("__session", "a-valid-session");
    expect(await isDemoRequest()).toBe(false);
    expect(getAuthenticatedUserId).not.toHaveBeenCalled();
  });
});

describe("clearDemoCookies", () => {
  it("deletes both demo cookies", () => {
    const store = { delete: vi.fn() };
    clearDemoCookies(store);
    expect(DEMO_COOKIE).toBe("demo_mode");
    expect(DEMO_SESSION_COOKIE).toBe("demo_session");
    expect(store.delete).toHaveBeenCalledWith("demo_mode");
    expect(store.delete).toHaveBeenCalledWith("demo_session");
  });
});
