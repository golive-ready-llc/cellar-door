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

// Capture global fetch
const fetchMock = vi.fn();
const origFetch = global.fetch;

import { GET } from "@/app/api/ha-sensor/route";

function req(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  verifyIdTokenMock.mockResolvedValue({ uid: "fb_uid_1" });
  prismaMock.user.findUnique.mockResolvedValue({ id: "user_1", tier: "PREMIUM" });
  prismaMock.wall.findFirst.mockResolvedValue({
    id: "wall_1",
    haConfig: {
      encryptedToken: "enc",
      haUrl: "https://ha.example.com",
      tempEntityId: "sensor.temp",
      humidityEntityId: "sensor.humidity",
    },
  });
});

afterEach(() => {
  global.fetch = origFetch;
});

describe("/api/ha-sensor SSRF guard", () => {
  it("rejects private IP (10.x) with 400", async () => {
    prismaMock.wall.findFirst.mockResolvedValue({
      id: "w",
      haConfig: { encryptedToken: "e", haUrl: "https://10.0.0.5", tempEntityId: "s.t", humidityEntityId: "s.h" },
    });
    const res = await GET(
      req("http://localhost/api/ha-sensor?wallId=wall_1", { authorization: "Bearer tok" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects 127.0.0.1 (loopback) with 400", async () => {
    prismaMock.wall.findFirst.mockResolvedValue({
      id: "w",
      haConfig: { encryptedToken: "e", haUrl: "https://127.0.0.1", tempEntityId: "s.t", humidityEntityId: "s.h" },
    });
    const res = await GET(
      req("http://localhost/api/ha-sensor?wallId=wall_1", { authorization: "Bearer tok" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects 169.254.169.254 cloud metadata IP", async () => {
    prismaMock.wall.findFirst.mockResolvedValue({
      id: "w",
      haConfig: { encryptedToken: "e", haUrl: "https://169.254.169.254", tempEntityId: "s.t", humidityEntityId: "s.h" },
    });
    const res = await GET(
      req("http://localhost/api/ha-sensor?wallId=wall_1", { authorization: "Bearer tok" })
    );
    expect(res.status).toBe(400);
  });

  it("public IP → fetch is called with redirect:'manual'", async () => {
    lookupMock.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ state: "12.5", attributes: { unit_of_measurement: "°C" } }), { status: 200 })
    );
    const res = await GET(
      req("http://localhost/api/ha-sensor?wallId=wall_1", { authorization: "Bearer tok" })
    );
    expect(fetchMock).toHaveBeenCalled();
    const call = fetchMock.mock.calls[0];
    expect(call[1]).toMatchObject({ redirect: "manual" });
    expect(res.status).toBe(200);
  });

  it("3xx redirect response → sensor returned as null (rejected)", async () => {
    lookupMock.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    fetchMock.mockImplementation(async () => new Response(null, { status: 302 }));
    const res = await GET(
      req("http://localhost/api/ha-sensor?wallId=wall_1", { authorization: "Bearer tok" })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.temp).toBeNull();
    expect(json.humidity).toBeNull();
  });

  it("missing auth header → 401", async () => {
    const res = await GET(req("http://localhost/api/ha-sensor?wallId=wall_1"));
    expect(res.status).toBe(401);
  });
});

// Self-hosters unlock Cellar Pro features with NEXT_PUBLIC_DEFAULT_TIER=PREMIUM
// (SELF-HOSTING.md names Home Assistant sensors specifically). The gate has to
// ask getUserTier for the tier — reading user.tier straight from the row
// skipped the floor and answered 403 on their own instance.
describe("/api/ha-sensor Cellar Pro gate — NEXT_PUBLIC_DEFAULT_TIER floor", () => {
  afterEach(() => {
    // The floor is read at module load and process.env is shared across test
    // files in the same worker, so it must not outlive this describe.
    delete process.env.NEXT_PUBLIC_DEFAULT_TIER;
  });

  it("403 for a FREE cellar when no floor is configured", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "user_1", tier: "FREE" });
    const res = await GET(
      req("http://localhost/api/ha-sensor?wallId=wall_1", { authorization: "Bearer tok" })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Cellar Pro required");
  });

  it("reads sensors for a FREE cellar when the floor is PREMIUM", async () => {
    process.env.NEXT_PUBLIC_DEFAULT_TIER = "PREMIUM";
    vi.resetModules();
    prismaMock.user.findUnique.mockResolvedValue({ id: "user_1", tier: "FREE" });
    const { GET: GETWithFloor } = await import("@/app/api/ha-sensor/route");
    const res = await GETWithFloor(
      req("http://localhost/api/ha-sensor", { authorization: "Bearer tok" })
    );
    // Past the tier gate — it now fails on the missing wallId instead.
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("wallId required");
  });
});
