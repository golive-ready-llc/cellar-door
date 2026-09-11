import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { lookupMock, verifyIdTokenMock, prismaMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
  verifyIdTokenMock: vi.fn(),
  prismaMock: {
    user: { findUnique: vi.fn() },
    wall: { findFirst: vi.fn() },
  },
}));

vi.mock("dns/promises", () => {
  const lookup = (...args: unknown[]) => lookupMock(...args);
  return { lookup, default: { lookup } };
});
vi.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => ({ verifyIdToken: (...a: unknown[]) => verifyIdTokenMock(...a) }),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/encryption", () => ({
  decrypt: (s: string) => `decrypted:${s}`,
}));

const fetchMock = vi.fn();
const origFetch = global.fetch;

import { GET as GET_HISTORY } from "@/app/api/ha-sensor/history/route";
import { GET as GET_CURRENT } from "@/app/api/ha-sensor/route";

const WALL_CONFIG = {
  encryptedToken: "enc",
  haUrl: "https://ha.example.com",
  tempEntityId: "sensor.temp",
  humidityEntityId: "sensor.humidity",
};

function req(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers });
}

function authed(path: string): NextRequest {
  return req(`http://localhost${path}`, { authorization: "Bearer tok" });
}

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  lookupMock.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  verifyIdTokenMock.mockResolvedValue({ uid: "fb_uid_1" });
  prismaMock.user.findUnique.mockResolvedValue({ id: "user_1", tier: "PREMIUM" });
  prismaMock.wall.findFirst.mockResolvedValue({
    id: "wall_1",
    haConfig: WALL_CONFIG,
  });
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/history/period/")) {
      return new Response(
        JSON.stringify([[{ state: "12.5", last_changed: "2026-09-11T00:00:00Z" }]]),
        { status: 200 }
      );
    }
    return new Response(
      JSON.stringify({ state: "12.5", attributes: { unit_of_measurement: "°C" } }),
      { status: 200 }
    );
  });
});

afterEach(() => {
  global.fetch = origFetch;
});

describe("/api/ha-sensor/history access", () => {
  it("401s without a bearer token", async () => {
    const res = await GET_HISTORY(req("http://localhost/api/ha-sensor/history?wallId=wall_1"));
    expect(res.status).toBe(401);
  });

  it("403s a tier that does not cover sensors", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "user_1", tier: "PRO" });
    const res = await GET_HISTORY(authed("/api/ha-sensor/history?wallId=wall_1"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      temp: null,
      humidity: null,
      error: "Cellar Pro required",
    });
  });

  it("rejects an unsupported period before reading any wall", async () => {
    const res = await GET_HISTORY(
      authed("/api/ha-sensor/history?wallId=wall_1&period=all")
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      temp: null,
      humidity: null,
      error: "Invalid period. Use 24h, 7d, or 30d",
    });
    expect(prismaMock.wall.findFirst).not.toHaveBeenCalled();
  });

  it("scopes the wall lookup to the caller", async () => {
    await GET_HISTORY(authed("/api/ha-sensor/history?wallId=wall_1"));
    expect(prismaMock.wall.findFirst).toHaveBeenCalledWith({
      where: { id: "wall_1", userId: "user_1" },
    });
  });

  it("404s a wall the caller does not own", async () => {
    prismaMock.wall.findFirst.mockResolvedValue(null);
    const res = await GET_HISTORY(authed("/api/ha-sensor/history?wallId=someone_elses"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      temp: null,
      humidity: null,
      error: "Wall not found",
    });
  });

  it("returns downsampled series with the entity's unit", async () => {
    const res = await GET_HISTORY(authed("/api/ha-sensor/history?wallId=wall_1&period=24h"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      temp: { data: [{ time: "2026-09-11T00:00:00Z", value: 12.5 }], unit: "°C" },
      humidity: { data: [{ time: "2026-09-11T00:00:00Z", value: 12.5 }], unit: "°C" },
    });
  });
});

describe("/api/ha-sensor failure bodies", () => {
  it("answers an unusable wall URL with the empty-reading shape", async () => {
    prismaMock.wall.findFirst.mockResolvedValue({
      id: "wall_1",
      haConfig: { ...WALL_CONFIG, haUrl: "https://127.0.0.1" },
    });
    const res = await GET_CURRENT(authed("/api/ha-sensor?wallId=wall_1"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      temp: null,
      humidity: null,
      error: "Invalid Home Assistant URL",
    });
  });

  it("answers a missing wallId with an error-only body", async () => {
    const res = await GET_CURRENT(authed("/api/ha-sensor"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "wallId required" });
  });
});

// ─── Tier-floor semantics (from PR #6, kept through the ha-access merge) ───

const HISTORY = "http://localhost/api/ha-sensor/history";

// The floor is read at module load and process.env is shared across test
// files in the same worker, so it must not outlive this file.
afterEach(() => {
  delete process.env.NEXT_PUBLIC_DEFAULT_TIER;
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
