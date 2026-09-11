import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyIdTokenMock, prismaMock } = vi.hoisted(() => ({
  verifyIdTokenMock: vi.fn(),
  prismaMock: {
    user: { findUnique: vi.fn() },
    wall: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => ({ verifyIdToken: (...a: unknown[]) => verifyIdTokenMock(...a) }),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/encryption", () => ({
  decrypt: (s: string) => `decrypted:${s}`,
}));

function req(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers });
}

const HISTORY = "http://localhost/api/ha-sensor/history";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_DEFAULT_TIER;
  verifyIdTokenMock.mockResolvedValue({ uid: "fb_uid_1" });
});

afterEach(() => {
  // The floor is read at module load and process.env is shared across test
  // files in the same worker, so it must not outlive this file.
  delete process.env.NEXT_PUBLIC_DEFAULT_TIER;
});

describe("/api/ha-sensor/history auth", () => {
  it("401 without an Authorization header", async () => {
    const { GET } = await import("@/app/api/ha-sensor/history/route");
    const res = await GET(req(`${HISTORY}?wallId=wall_1`));
    expect(res.status).toBe(401);
  });
});

// Self-hosters unlock Cellar Pro features with NEXT_PUBLIC_DEFAULT_TIER=PREMIUM
// (SELF-HOSTING.md names Home Assistant sensors specifically). The gate has to
// ask getUserTier for the tier — reading user.tier straight from the row
// skipped the floor and answered 403 on their own instance.
describe("/api/ha-sensor/history Cellar Pro gate — NEXT_PUBLIC_DEFAULT_TIER floor", () => {
  it("403 for a FREE cellar when no floor is configured", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "user_1", tier: "FREE" });
    const { GET } = await import("@/app/api/ha-sensor/history/route");
    const res = await GET(
      req(`${HISTORY}?wallId=wall_1`, { authorization: "Bearer tok" })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Cellar Pro required");
  });

  it("reads history for a FREE cellar when the floor is PREMIUM", async () => {
    process.env.NEXT_PUBLIC_DEFAULT_TIER = "PREMIUM";
    vi.resetModules();
    prismaMock.user.findUnique.mockResolvedValue({ id: "user_1", tier: "FREE" });
    const { GET } = await import("@/app/api/ha-sensor/history/route");
    const res = await GET(req(HISTORY, { authorization: "Bearer tok" }));
    // Past the tier gate — it now fails on the missing wallId instead.
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("wallId required");
  });
});
