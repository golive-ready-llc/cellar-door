import { describe, it, expect } from "vitest";
import { wineHistoryData } from "@/server/wine-history-store";

function wineRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "w1",
    name: "Bordeaux 2019",
    winery: "Chateau X",
    vintage: 2019,
    type: "red",
    region: "Bordeaux",
    country: "France",
    grapeVariety: "Merlot",
    userRating: 4.5,
    price: 40,
    retailPrice: 55,
    imageUrl: "img.jpg",
    description: "Plummy",
    foodPairings: "Beef",
    alcohol: "13.5%",
    disposition: "D",
    drinkWindow: "2025-2030",
    aiRatings: { rating_rp: 91 },
    addedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

describe("wineHistoryData", () => {
  it("snapshots the bottle plus the removal context", () => {
    expect(
      wineHistoryData("u1", wineRow(), { reason: "drank", consumeRating: 4, consumeNotes: "great" })
    ).toEqual({
      userId: "u1",
      originalId: "w1",
      name: "Bordeaux 2019",
      winery: "Chateau X",
      vintage: 2019,
      type: "red",
      region: "Bordeaux",
      country: "France",
      grapeVariety: "Merlot",
      rating: 4.5,
      consumeRating: 4,
      consumeNotes: "great",
      price: 40,
      retailPrice: 55,
      imageUrl: "img.jpg",
      description: "Plummy",
      foodPairings: "Beef",
      alcohol: "13.5%",
      disposition: "D",
      drinkWindow: "2025-2030",
      aiRatings: { rating_rp: 91 },
      addedAt: new Date("2024-01-01"),
      reason: "drank",
    });
  });

  it("defaults the consume fields when the bottle was not tasted", () => {
    const row = wineHistoryData("u1", wineRow(), { reason: "api_delete" });
    expect(row.consumeRating).toBeNull();
    expect(row.consumeNotes).toBe("");
    expect(row.reason).toBe("api_delete");
  });

  it("leaves aiRatings unset when the bottle never had critic scores", () => {
    expect(wineHistoryData("u1", wineRow({ aiRatings: null }), { reason: "other" }).aiRatings).toBeUndefined();
  });
});
