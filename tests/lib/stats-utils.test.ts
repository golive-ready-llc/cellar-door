import { describe, it, expect } from "vitest";
import { computePriceData, computeCoreStats } from "@/lib/stats-utils";
import type { Wine } from "@/types/wine";

/**
 * Regression: a wine with no recorded price is not a $0 wine. Treating it as
 * one put every unpriced bottle in the "$0-25" bar — often the tallest bar on
 * the chart — and made the chart's "Add prices to see distribution" empty
 * state unreachable. The price drill-down excludes unpriced wines, so the
 * chart has to agree.
 */

function makeWine(partial: Partial<Wine>): Wine {
  // Minimal stub — only `price` matters to computePriceData.
  return {
    id: "w-test",
    userId: "u-test",
    cabinetId: null,
    barcode: "",
    name: "Test",
    winery: "",
    region: "",
    country: "",
    vintage: null,
    type: "red",
    sparkling: false,
    grapeVariety: "",
    userRating: null,
    imageUrl: "",
    price: null,
    retailPrice: null,
    purchaseDate: "",
    drinkBy: "",
    notes: "",
    description: "",
    foodPairings: "",
    alcohol: "",
    row: null,
    col: null,
    depth: 0,
    zone: "",
    tastingNotes: null,
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    tags: [],
    addedAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("computePriceData", () => {
  it("leaves unpriced wines out of the buckets", () => {
    const data = computePriceData([
      makeWine({ price: null }),
      makeWine({ price: 12 }),
      makeWine({ price: 40 }),
    ]);

    expect(data).toEqual([
      { label: "$0-25", min: 0, max: 25, count: 1 },
      { label: "$25-50", min: 25, max: 50, count: 1 },
    ]);
  });

  it("returns no buckets when nothing has a price", () => {
    const data = computePriceData([
      makeWine({ price: null }),
      makeWine({ price: null }),
    ]);

    expect(data).toEqual([]);
  });

  it("keeps a price on a bucket edge in the higher bucket", () => {
    const data = computePriceData([makeWine({ price: 25 }), makeWine({ price: 500 })]);

    expect(data.map((b) => b.label)).toEqual(["$25-50", "$500+"]);
  });
});

/**
 * Regression: an empty cellar (or one with no vintages) must produce null
 * vintages, not ±Infinity. `Math.min(...[])`/`Math.max(...[])` are
 * ±Infinity — without the length guard, hero stat cards rendered
 * "Newest: -Infinity" for a brand-new account.
 */
describe("computeCoreStats vintages", () => {
  it("returns null vintages for an empty cellar", () => {
    const stats = computeCoreStats([], []);
    expect(stats.oldestVintage).toBeNull();
    expect(stats.newestVintage).toBeNull();
  });

  it("returns null vintages when no wine has a vintage", () => {
    const stats = computeCoreStats([makeWine({ vintage: null })], []);
    expect(stats.oldestVintage).toBeNull();
    expect(stats.newestVintage).toBeNull();
  });

  it("keeps real min and max vintages", () => {
    const stats = computeCoreStats(
      [makeWine({ vintage: 1998 }), makeWine({ vintage: 2020 })],
      []
    );
    expect(stats.oldestVintage).toBe(1998);
    expect(stats.newestVintage).toBe(2020);
  });
});
