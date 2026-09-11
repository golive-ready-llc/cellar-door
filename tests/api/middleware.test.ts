import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

/**
 * The SITE_PASSWORD gate. It lets crawlers and demo sessions through on a
 * normal (multi-user) deployment, but a single-user instance has no sign-in
 * behind the gate, so there only the password cookie may open it.
 */

function req(path: string, opts: { ua?: string; cookie?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.ua) headers["user-agent"] = opts.ua;
  if (opts.cookie) headers["cookie"] = opts.cookie;
  return new NextRequest(`http://localhost${path}`, { headers });
}

const passes = (res: Response) => res.headers.get("x-middleware-next") === "1";
const redirectedToGate = (res: Response) =>
  res.status >= 300 && res.status < 400 && (res.headers.get("location") ?? "").includes("/gate");

const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("site-password gate", () => {
  it("is open when SITE_PASSWORD is unset", () => {
    vi.stubEnv("SITE_PASSWORD", "");
    expect(passes(middleware(req("/cellar")))).toBe(true);
  });

  describe("multi-user deployment", () => {
    it("lets crawlers and demo sessions through and redirects everyone else", () => {
      vi.stubEnv("SITE_PASSWORD", "secret");
      vi.stubEnv("NEXT_PUBLIC_SINGLE_USER_MODE", "");
      expect(passes(middleware(req("/cellar", { ua: GOOGLEBOT })))).toBe(true);
      expect(passes(middleware(req("/cellar", { cookie: "demo_session=granted" })))).toBe(true);
      expect(redirectedToGate(middleware(req("/cellar")))).toBe(true);
    });

    it("no longer accepts the client-settable demo_mode cookie", () => {
      vi.stubEnv("SITE_PASSWORD", "secret");
      vi.stubEnv("NEXT_PUBLIC_SINGLE_USER_MODE", "");
      expect(redirectedToGate(middleware(req("/cellar", { cookie: "demo_mode=true" })))).toBe(true);
    });
  });

  describe("single-user deployment", () => {
    it("opens only for the password cookie", () => {
      vi.stubEnv("SITE_PASSWORD", "secret");
      vi.stubEnv("NEXT_PUBLIC_SINGLE_USER_MODE", "true");
      expect(redirectedToGate(middleware(req("/cellar", { ua: GOOGLEBOT })))).toBe(true);
      expect(redirectedToGate(middleware(req("/cellar", { cookie: "demo_session=granted" })))).toBe(true);
      expect(redirectedToGate(middleware(req("/cellar", { cookie: "demo_mode=true" })))).toBe(true);
      expect(passes(middleware(req("/cellar", { cookie: "site_access=granted" })))).toBe(true);
    });
  });
});
