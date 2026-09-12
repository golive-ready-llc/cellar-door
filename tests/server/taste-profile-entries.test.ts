import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for getTasteProfileEntries — the slim read that feeds the
 * taste-profile page. The page used to fetch full wines + full history,
 * which for a 1000-row history carried ~10 MB of base64 label images and
 * failed on mobile, leaving the page empty (2026-09-12).
 */

process.env.DATABASE_URL = "postgresql://stub";

const wineFindMany = vi.fn();
const historyFindMany = vi.fn();
const resolveServerUserId = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    wine: { findMany: (...a: unknown[]) => wineFindMany(...a) },
    wineHistory: { findMany: (...a: unknown[]) => historyFindMany(...a) },
  },
}));

vi.mock("@/server/auth-guard", () => ({
  resolveServerUserId: (...a: unknown[]) => resolveServerUserId(...a),
  getAuthenticatedUserId: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  resolveServerUserId.mockResolvedValue("u1");
});

describe("getTasteProfileEntries", () => {
  it("merges cellar wines and history into slim rating entries", async () => {
    wineFindMany.mockResolvedValue([
      { id: "w1", type: "red", region: "Rhone", country: "France", grapeVariety: "Syrah", userRating: 4.5 },
      { id: "w2", type: "white", region: null, country: null, grapeVariety: null, userRating: null },
    ]);
    historyFindMany.mockResolvedValue([
      { id: "h1", type: "red", region: "Bordeaux", country: "France", grapeVariety: "Merlot", rating: 3.0, consumeRating: 2.0 },
      { id: "h2", type: "red", region: "Bordeaux", country: "France", grapeVariety: "Cabernet", rating: 4.0, consumeRating: null },
    ]);
    const { getTasteProfileEntries } = await import("@/server/actions/wines");
    const rows = await getTasteProfileEntries("u1");
    expect(rows).toHaveLength(4);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    // Cellar row keeps its user rating; nulls become unrated entries.
    expect(byId.w1).toMatchObject({ source: "cellar", rating: 4.5, region: "Rhone" });
    expect(byId.w2.rating).toBeNull();
    // History prefers the consume-time rating over the original rating.
    expect(byId.h1).toMatchObject({ source: "history", rating: 2.0 });
    expect(byId.h2.rating).toBe(4.0);
  });

  it("selects ONLY the six scalar fields — no image or text columns in the query", async () => {
    wineFindMany.mockResolvedValue([]);
    historyFindMany.mockResolvedValue([]);
    const { getTasteProfileEntries } = await import("@/server/actions/wines");
    await getTasteProfileEntries("u1");
    const wineSelect = Object.keys(wineFindMany.mock.calls[0][0].select).sort();
    const histSelect = Object.keys(historyFindMany.mock.calls[0][0].select).sort();
    expect(wineSelect).toEqual(["country", "grapeVariety", "id", "region", "type", "userRating"]);
    expect(histSelect).toEqual(["consumeRating", "country", "grapeVariety", "id", "rating", "region", "type"]);
  });

  it("scopes both queries to the resolved user", async () => {
    wineFindMany.mockResolvedValue([]);
    historyFindMany.mockResolvedValue([]);
    const { getTasteProfileEntries } = await import("@/server/actions/wines");
    await getTasteProfileEntries("attacker");
    expect(resolveServerUserId).toHaveBeenCalledWith("attacker");
    expect(wineFindMany.mock.calls[0][0].where).toEqual({ userId: "u1" });
    expect(historyFindMany.mock.calls[0][0].where).toEqual({ userId: "u1" });
  });
});
