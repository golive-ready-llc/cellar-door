import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";

/**
 * Baseline Content-Security-Policy: no plugins, no <base> hijacking, and no
 * framing by other sites. It deliberately doesn't restrict scripts yet, so
 * AdSense, Firebase, Stripe and Turnstile keep working.
 */

async function headerFor(source: string, key: string): Promise<string | undefined> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const rule = rules.find((r) => r.source === source);
  return rule?.headers.find((h) => h.key === key)?.value;
}

describe("security headers", () => {
  it("sets a baseline CSP on every page that forbids framing", async () => {
    const csp = await headerFor("/:path*", "Content-Security-Policy");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("lets our own pages frame the Firebase auth helper", async () => {
    const csp = await headerFor("/__/:path*", "Content-Security-Policy");
    expect(csp).toContain("frame-ancestors 'self'");
  });
});
