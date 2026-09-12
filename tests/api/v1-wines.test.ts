import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const { authMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: {
    wine: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    cabinet: { findFirst: vi.fn() },
    wineHistory: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, authenticateApiKey: (...args: unknown[]) => authMock(...args) };
});
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { GET, POST } from "@/app/api/v1/wines/route";
import { GET as GET_WINE, PUT, DELETE } from "@/app/api/v1/wines/[id]/route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function req(url: string, init?: any): NextRequest {
  return new NextRequest(url, init);
}

const okUser = { ok: true as const, user: { id: "user_1", email: "u@e.com", tier: "PREMIUM" } };
function unauthorized(status = 401, message = "fail") {
  return {
    ok: false as const,
    response: NextResponse.json({ error: message }, { status }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.wine.findMany.mockResolvedValue([]);
  prismaMock.wine.count.mockResolvedValue(0);
  prismaMock.wine.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.$transaction.mockImplementation((arr: unknown) => Promise.resolve(arr));
});

describe("/api/v1/wines auth", () => {
  it("401 when authenticateApiKey rejects (missing header)", async () => {
    authMock.mockResolvedValue(unauthorized(401, "Missing or invalid Authorization header. Use: Bearer cd_xxx"));
    const res = await GET(req("http://localhost/api/v1/wines"));
    expect(res.status).toBe(401);
  });

  it("401 when key has invalid format (not cd_)", async () => {
    authMock.mockResolvedValue(unauthorized(401, "Invalid API key format."));
    const res = await GET(req("http://localhost/api/v1/wines", { headers: { Authorization: "Bearer abc_xxx" } }));
    expect(res.status).toBe(401);
  });

  it("401 when key expired", async () => {
    authMock.mockResolvedValue(unauthorized(401, "API key has expired."));
    const res = await GET(req("http://localhost/api/v1/wines", { headers: { Authorization: "Bearer cd_xxx" } }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/expired/i);
  });

  it("403 when tier is FREE/PRO (not PREMIUM)", async () => {
    authMock.mockResolvedValue(unauthorized(403, "API access requires an active Cellar Pro (PREMIUM) subscription."));
    const res = await GET(req("http://localhost/api/v1/wines", { headers: { Authorization: "Bearer cd_xxx" } }));
    expect(res.status).toBe(403);
  });
});

describe("/api/v1/wines GET (PREMIUM)", () => {
  it("returns wines scoped to authenticated user", async () => {
    authMock.mockResolvedValue(okUser);
    prismaMock.wine.findMany.mockResolvedValue([{ id: "w1", name: "Test", addedAt: new Date() }]);
    prismaMock.wine.count.mockResolvedValue(1);
    const res = await GET(req("http://localhost/api/v1/wines"));
    expect(res.status).toBe(200);
    expect(prismaMock.wine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user_1" }) })
    );
    const json = await res.json();
    expect(json.data.total).toBe(1);
  });
});

describe("/api/v1/wines POST", () => {
  it("creates wine with userId scope", async () => {
    authMock.mockResolvedValue(okUser);
    prismaMock.wine.create.mockResolvedValue({ id: "w_new", name: "Pinot", addedAt: new Date() });
    const res = await POST(
      req("http://localhost/api/v1/wines", {
        method: "POST",
        headers: { Authorization: "Bearer cd_xxx", "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Pinot" }),
      })
    );
    expect(res.status).toBe(201);
    expect(prismaMock.wine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user_1", name: "Pinot" }),
      })
    );
  });

  it("400 when name missing", async () => {
    authMock.mockResolvedValue(okUser);
    const res = await POST(
      req("http://localhost/api/v1/wines", {
        method: "POST",
        headers: { Authorization: "Bearer cd_xxx", "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("/api/v1/wines/[id] GET", () => {
  it("returns the wine including barcode (fields are read-writable, not write-only)", async () => {
    authMock.mockResolvedValue(okUser);
    prismaMock.wine.findFirst.mockResolvedValue({
      id: "w1",
      name: "Estate",
      winery: "Kanon",
      vintage: null,
      type: "red",
      barcode: "0123456789",
      addedAt: new Date(),
    });
    const res = await GET_WINE(req("http://localhost/api/v1/wines/w1"), {
      params: Promise.resolve({ id: "w1" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).data.barcode).toBe("0123456789");
  });
});

describe("/api/v1/wines/[id] PUT", () => {
  it("404 when wine not owned (returns 404 'not found')", async () => {
    authMock.mockResolvedValue(okUser);
    prismaMock.wine.findFirst.mockResolvedValue(null);
    const res = await PUT(
      req("http://localhost/api/v1/wines/w_other", {
        method: "PUT",
        body: JSON.stringify({ name: "X" }),
      }),
      { params: Promise.resolve({ id: "w_other" }) }
    );
    expect(res.status).toBe(404);
    expect(prismaMock.wine.update).not.toHaveBeenCalled();
  });

  it("writes AI enrichment fields to the addressed bottle and propagates the same values to duplicates", async () => {
    authMock.mockResolvedValue(okUser);
    prismaMock.wine.findFirst.mockResolvedValue({
      id: "w1",
      userId: "user_1",
      name: "Estate",
      winery: "Kanon",
      vintage: 2019,
    });
    prismaMock.wine.update.mockResolvedValue({ id: "w1" });
    const res = await PUT(
      req("http://localhost/api/v1/wines/w1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiRatings: { rating_ws: 90 },
          tastingNotes: "silky",
          aiEnrichedAt: "2026-09-12T00:00:00.000Z",
        }),
      }),
      { params: Promise.resolve({ id: "w1" }) }
    );
    expect(res.status).toBe(200);
    const coerced = {
      aiRatings: { rating_ws: 90 },
      tastingNotes: "silky",
      aiEnrichedAt: new Date("2026-09-12T00:00:00.000Z"),
    };
    expect(prismaMock.wine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "w1" },
        data: expect.objectContaining(coerced),
      })
    );
    expect(prismaMock.wine.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user_1", id: { not: "w1" } }),
        data: expect.objectContaining(coerced),
      })
    );
  });

  it("clears AI fields on the addressed bottle when the body sends nulls", async () => {
    authMock.mockResolvedValue(okUser);
    prismaMock.wine.findFirst.mockResolvedValue({
      id: "w1",
      userId: "user_1",
      name: "Estate",
      winery: "Kanon",
      vintage: 2019,
    });
    prismaMock.wine.update.mockResolvedValue({ id: "w1" });
    const res = await PUT(
      req("http://localhost/api/v1/wines/w1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiRatings: null, tastingNotes: null }),
      }),
      { params: Promise.resolve({ id: "w1" }) }
    );
    expect(res.status).toBe(200);
    expect(prismaMock.wine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ aiRatings: null, tastingNotes: null }),
      })
    );
  });
});

describe("/api/v1/wines/[id] DELETE", () => {
  it("403/404 when wine not owned (returns 404 'not found')", async () => {
    authMock.mockResolvedValue(okUser);
    prismaMock.wine.findFirst.mockResolvedValue(null);
    const res = await DELETE(req("http://localhost/api/v1/wines/w_other", { method: "DELETE" }), {
      params: Promise.resolve({ id: "w_other" }),
    });
    expect(res.status).toBe(404);
    expect(prismaMock.wine.delete).not.toHaveBeenCalled();
  });

  it("deletes when owned and writes history", async () => {
    authMock.mockResolvedValue(okUser);
    prismaMock.wine.findFirst.mockResolvedValue({
      id: "w1",
      userId: "user_1",
      name: "X",
      winery: "",
      vintage: null,
      type: "red",
      region: "",
      country: "",
      grapeVariety: "",
      userRating: null,
      price: null,
      imageUrl: "",
      addedAt: new Date(),
    });
    prismaMock.wine.delete.mockResolvedValue({});
    prismaMock.wineHistory.create.mockResolvedValue({});
    const res = await DELETE(req("http://localhost/api/v1/wines/w1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "w1" }),
    });
    expect(res.status).toBe(200);
    expect(prismaMock.wineHistory.create).toHaveBeenCalled();
    expect(prismaMock.wine.delete).toHaveBeenCalledWith({ where: { id: "w1" } });
  });
});
