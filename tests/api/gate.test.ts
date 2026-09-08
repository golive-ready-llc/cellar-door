import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// gate route maintains module-level rate-limit Map; reset modules per test
async function loadGate() {
  // Use dynamic import after resetModules so the Map is fresh
  return await import("@/app/api/gate/route");
}

function makeReq(body: unknown, ip?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ip) headers["x-forwarded-for"] = ip;
  return new NextRequest("http://localhost/api/gate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("/api/gate", () => {
  beforeEach(async () => {
    // Reset module to clear in-memory rate-limit Map
    vi.resetModules();
    process.env.SITE_PASSWORD = "letmein";
  });

  it("wrong password → 401, no cookie set", async () => {
    const { POST } = await loadGate();
    const res = await POST(makeReq({ password: "nope" }, "1.1.1.1"));
    expect(res.status).toBe(401);
    expect(res.cookies.get("site_access")).toBeUndefined();
  });

  it("correct password → 200, sets site_access cookie httpOnly+secure", async () => {
    const { POST } = await loadGate();
    const res = await POST(makeReq({ password: "letmein" }, "2.2.2.2"));
    expect(res.status).toBe(200);
    const cookie = res.cookies.get("site_access");
    expect(cookie?.value).toBe("granted");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
  });

  it("rate-limit: 6th attempt from same IP within window → 429", async () => {
    const { POST } = await loadGate();
    const ip = "3.3.3.3";
    for (let i = 0; i < 5; i++) {
      const r = await POST(makeReq({ password: "wrong" }, ip));
      expect(r.status).toBe(401);
    }
    const res = await POST(makeReq({ password: "wrong" }, ip));
    expect(res.status).toBe(429);
  });

  it("different IPs are tracked separately", async () => {
    const { POST } = await loadGate();
    for (let i = 0; i < 5; i++) {
      await POST(makeReq({ password: "wrong" }, "10.0.0.1"));
    }
    // 10.0.0.1 should now be blocked but 10.0.0.2 should not be
    const blocked = await POST(makeReq({ password: "wrong" }, "10.0.0.1"));
    expect(blocked.status).toBe(429);
    const fresh = await POST(makeReq({ password: "wrong" }, "10.0.0.2"));
    expect(fresh.status).toBe(401);
  });

  it("uses first IP from comma-separated x-forwarded-for", async () => {
    const { POST } = await loadGate();
    for (let i = 0; i < 5; i++) {
      await POST(makeReq({ password: "wrong" }, "20.0.0.1, 99.99.99.99"));
    }
    const res = await POST(makeReq({ password: "wrong" }, "20.0.0.1"));
    expect(res.status).toBe(429);
  });

  it("sitePassword unset → 401 even with empty password", async () => {
    delete process.env.SITE_PASSWORD;
    const { POST } = await loadGate();
    const res = await POST(makeReq({ password: "" }, "30.0.0.1"));
    expect(res.status).toBe(401);
  });
});
