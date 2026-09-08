import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { authMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: { wine: { findMany: vi.fn() } },
}));
vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, authenticateApiKey: (...args: unknown[]) => authMock(...args) };
});
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { GET } from "@/app/api/v1/stats/route";

const req = (url = "http://localhost/api/v1/stats") => new NextRequest(url);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/api/v1/stats", () => {
  it("rejects unauthenticated", async () => {
    authMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "x" }, { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("scopes findMany to authenticated user", async () => {
    authMock.mockResolvedValue({ ok: true, user: { id: "user_42", email: "a@b", tier: "PREMIUM" } });
    prismaMock.wine.findMany.mockResolvedValue([]);
    await GET(req());
    expect(prismaMock.wine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user_42" } })
    );
  });

  it("aggregates totals, byType, byDisposition correctly", async () => {
    authMock.mockResolvedValue({ ok: true, user: { id: "u1", email: "a", tier: "PREMIUM" } });
    prismaMock.wine.findMany.mockResolvedValue([
      { type: "red", price: 10, retailPrice: 20, disposition: "D" },
      { type: "red", price: 5, retailPrice: null, disposition: "C" },
      { type: "white", price: null, retailPrice: 15, disposition: "" },
    ]);
    const res = await GET(req());
    const json = await res.json();
    expect(json.data.totalWines).toBe(3);
    expect(json.data.totalCost).toBe(15);
    // 20 + 5 (price fallback) + 15 = 40
    expect(json.data.totalEstimatedValue).toBe(40);
    expect(json.data.byType).toEqual({ red: 2, white: 1 });
    expect(json.data.byDisposition).toEqual({ D: 1, C: 1 });
  });

  it("returns zeros for empty cellar", async () => {
    authMock.mockResolvedValue({ ok: true, user: { id: "u1", email: "a", tier: "PREMIUM" } });
    prismaMock.wine.findMany.mockResolvedValue([]);
    const res = await GET(req());
    const json = await res.json();
    expect(json.data.totalWines).toBe(0);
    expect(json.data.totalCost).toBe(0);
    expect(json.data.byType).toEqual({});
  });
});
