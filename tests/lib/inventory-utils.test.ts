import { describe, it, expect } from "vitest";
import { filterWines } from "@/lib/inventory-utils";
import type { Wine } from "@/types/wine";

/**
 * Regression: the search guard trimmed its input but the needle didn't, so a
 * trailing space right after a complete word blanked the results whenever
 * that word ended the matched field — "Napa " found nothing in region "Napa".
 */

function makeWine(partial: Partial<Wine>): Wine {
  return {
    id: "w-test",
    userId: "u-test",
    cabinetId: null,
    barcode: "",
    name: "Napa Reserve",
    winery: "Valley Cellars",
    region: "Napa",
    country: "USA",
    vintage: 2019,
    type: "red",
    sparkling: false,
    grapeVariety: "Cabernet Sauvignon",
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
    addedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  } as Wine;
}

const wines = [makeWine({})];

describe("filterWines search", () => {
  it("still matches when the query's trailing space follows a word that ends the field", () => {
    expect(filterWines(wines, "all", [], "napa ")).toHaveLength(1);
    expect(filterWines(wines, "all", [], "cellars ")).toHaveLength(1);
  });

  it("matches without the trailing space (control)", () => {
    expect(filterWines(wines, "all", [], "napa")).toHaveLength(1);
    expect(filterWines(wines, "all", [], "valley cel")).toHaveLength(1);
  });

  it("returns nothing for a query that matches no field", () => {
    expect(filterWines(wines, "all", [], "burgundy")).toHaveLength(0);
  });
});
