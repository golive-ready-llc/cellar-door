import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

async function loadGate() {
  return await import("@/app/api/gate/route");
}

function makeMalformedReq(body: string, ip?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ip) headers["x-forwarded-for"] = ip;
  return new NextRequest("http://localhost/api/gate", {
    method: "POST",
    headers,
    body: body, // Raw body - not stringified
  });
}

describe("/api/gate malformed JSON", () => {
  beforeEach(async () => {
    vi.resetModules();
    process.env.SITE_PASSWORD = "letmein";
  });

  it("malformed JSON (missing closing brace) → should return 400 but returns 500", async () => {
    const { POST } = await loadGate();
    const res = await POST(makeMalformedReq("{invalid", "1.1.1.1"));
    console.log("Status:", res.status);
    console.log("Response:", await res.json());
    // BUG: This will be 500 instead of 400
    expect(res.status).toBe(400); // This should pass if fix applied, but fails without it
  });
});
