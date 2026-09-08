import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/demo/route";

describe("/api/demo", () => {
  it("issues demo_session=granted (NOT site_access)", async () => {
    const res = await GET(new NextRequest("http://localhost/api/demo"));
    const demo = res.cookies.get("demo_session");
    expect(demo?.value).toBe("granted");
    expect(res.cookies.get("site_access")).toBeUndefined();
  });

  it("demo_session cookie has httpOnly + secure flags", async () => {
    const res = await GET(new NextRequest("http://localhost/api/demo"));
    const demo = res.cookies.get("demo_session");
    expect(demo?.httpOnly).toBe(true);
    expect(demo?.secure).toBe(true);
    expect(demo?.sameSite).toBe("lax");
  });

  it("demo_session cookie max-age is 24h (86400s)", async () => {
    const res = await GET(new NextRequest("http://localhost/api/demo"));
    const demo = res.cookies.get("demo_session");
    expect(demo?.maxAge).toBe(60 * 60 * 24);
  });

  it("redirects to /cellar", async () => {
    const res = await GET(new NextRequest("http://localhost/api/demo"));
    // 307 = NextResponse.redirect default
    expect([302, 307, 308]).toContain(res.status);
    expect(res.headers.get("location")).toMatch(/\/cellar$/);
  });
});
