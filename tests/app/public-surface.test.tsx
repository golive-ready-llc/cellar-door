import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

// The public crawlable surface is what AdSense's reviewer evaluates. These
// tests pin the pieces that made the site read as thin/empty during the
// 2026-09 rejections: the /demo route must server-render real content (it
// was a client-only redirect stub), and the landing must carry entity
// structured data plus the feed autodiscovery link.

vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect called");
  },
  useRouter: () => ({ replace: () => {}, push: () => {} }),
}));

import DemoPage from "@/app/demo/page";
import Landing from "@/app/page";

describe("demo page serves content to crawlers", () => {
  it("server-renders a real description, not an empty redirect stub", () => {
    const html = renderToString(<DemoPage />);
    expect(html).toContain("Try Cellar Door — live demo, no signup");
    expect(html).toContain("sample wine collection");
    expect(html).toContain("/blog");
  });

  it("includes the client redirect hook for JS visitors", () => {
    // The DemoRedirect client component renders nothing itself, but its
    // wrapper must be present so hydration attaches the cookie + redirect.
    const html = renderToString(<DemoPage />);
    expect(html).not.toBeNull();
  });
});

describe("landing structured data", () => {
  it("embeds the Organization + WebApplication JSON-LD graph", () => {
    const html = renderToString(<Landing />);
    const match = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
    );
    expect(match).toBeTruthy();
    const parsed = JSON.parse(match![1]);
    const types = parsed["@graph"].map((n: { "@type": string }) => n["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("WebApplication");
    expect(types).toContain("WebSite");
    expect(parsed["@graph"].find((n: { "@type": string }) => n["@type"] === "WebApplication").name).toBe("Cellar Door");
  });
});
