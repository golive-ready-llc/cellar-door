import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.DATABASE_URL = "postgresql://stub";

const { wineUpdateMany } = vi.hoisted(() => ({ wineUpdateMany: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: { wine: { updateMany: wineUpdateMany } },
}));

import {
  sameWineWhere,
  sharedFieldPatch,
  propagateSharedFields,
  SHARED_WINE_FIELDS,
} from "@/server/wine-shared";

const identity = { name: "Bordeaux 2019", winery: "Chateau X", vintage: 2019 };

beforeEach(() => {
  vi.clearAllMocks();
  wineUpdateMany.mockResolvedValue({ count: 0 });
});

describe("sameWineWhere", () => {
  it("matches one user's bottles of the same wine, name/winery case-insensitively", () => {
    expect(sameWineWhere("u1", identity)).toEqual({
      userId: "u1",
      name: { equals: "Bordeaux 2019", mode: "insensitive" },
      winery: { equals: "Chateau X", mode: "insensitive" },
      vintage: 2019,
    });
  });

  it("excludes the bottle being edited when one is named", () => {
    expect(sameWineWhere("u1", identity, "w1").id).toEqual({ not: "w1" });
    expect(sameWineWhere("u1", identity).id).toBeUndefined();
  });
});

describe("sharedFieldPatch", () => {
  it("keeps wine-level fields and drops bottle-only ones", () => {
    expect(
      sharedFieldPatch({ notes: "cellar 3", row: 2, cabinetId: "c2", userRating: 5 })
    ).toEqual({ userRating: 5 });
  });

  it("lowercases type the way the stored column is written", () => {
    expect(sharedFieldPatch({ type: "Sparkling" })).toEqual({ type: "sparkling" });
  });

  it("normalizes the JSON fields the same way the row update does", () => {
    const patch = sharedFieldPatch({
      aiRatings: null,
      tastingNotes: "",
      aiEnrichedAt: "2026-01-02T03:04:05.000Z",
    });
    expect(patch.aiRatings).toBeNull();
    expect(patch.tastingNotes).toBeNull();
    expect(patch.aiEnrichedAt).toEqual(new Date("2026-01-02T03:04:05.000Z"));
  });

  it("is empty for a bottle-only change", () => {
    expect(sharedFieldPatch({ notes: "x", cabinetId: "c2" })).toEqual({});
  });

  it("covers every field it claims is shared", () => {
    const source = Object.fromEntries(SHARED_WINE_FIELDS.map((f) => [f, f === "type" ? "Red" : "set"]));
    expect(Object.keys(sharedFieldPatch(source)).sort()).toEqual([...SHARED_WINE_FIELDS].sort());
  });
});

describe("propagateSharedFields", () => {
  it("copies the patch onto the other bottles of the same wine", () => {
    propagateSharedFields("u1", { id: "w1", ...identity }, { userRating: 5 });
    expect(wineUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        id: { not: "w1" },
        name: { equals: identity.name, mode: "insensitive" },
        winery: { equals: identity.winery, mode: "insensitive" },
        vintage: 2019,
      },
      data: { userRating: 5 },
    });
  });

  it("does nothing without a patch", () => {
    propagateSharedFields("u1", { id: "w1", ...identity }, {});
    expect(wineUpdateMany).not.toHaveBeenCalled();
  });

  it("does nothing when the wine has no name or winery to match on", () => {
    propagateSharedFields("u1", { id: "w1", name: "", winery: "", vintage: 2019 }, { userRating: 5 });
    expect(wineUpdateMany).not.toHaveBeenCalled();
  });

  it("does not surface a failed propagation", async () => {
    wineUpdateMany.mockRejectedValue(new Error("db down"));
    expect(() =>
      propagateSharedFields("u1", { id: "w1", ...identity }, { userRating: 5 })
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});
