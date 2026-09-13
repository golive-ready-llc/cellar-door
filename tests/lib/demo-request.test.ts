// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Server-side demo detection used to trust the `demo_mode` cookie alone. A
 * signed-in owner with a leftover cookie from a /demo visit then had every
 * write refused as "Demo mode is read-only" and got canned demo chat replies.
 * A request that carries a session cookie is never a demo request. Demo mode
 * only restricts; skipping it grants nothing, because every action still
 * verifies the session itself.
 */

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    }),
}));

import { isDemoRequest, clearDemoCookies, DEMO_COOKIE, DEMO_SESSION_COOKIE } from "@/lib/demo";

describe("isDemoRequest", () => {
  beforeEach(() => jar.clear());

  it("is true for a visitor with only the demo cookie", async () => {
    jar.set("demo_mode", "true");
    expect(await isDemoRequest()).toBe(true);
  });

  it("is false when the request also carries a session cookie", async () => {
    jar.set("demo_mode", "true");
    jar.set("__session", "a-session");
    expect(await isDemoRequest()).toBe(false);
  });

  it("is false without the demo cookie", async () => {
    expect(await isDemoRequest()).toBe(false);
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
