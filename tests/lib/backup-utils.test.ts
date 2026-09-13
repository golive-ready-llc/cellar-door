import { describe, it, expect } from "vitest";

import { winesToCSV } from "@/lib/backup-utils";
import type { Wine } from "@/types/wine";

function makeWine(overrides: Partial<Wine> = {}): Wine {
  return {
    id: "w-1",
    userId: "u1",
    cabinetId: null,
    barcode: "",
    name: "Test Wine",
    winery: "Test Winery",
    region: "",
    country: "",
    vintage: 2020,
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
    row: 0,
    col: 0,
    depth: 0,
    zone: "",
    tastingNotes: null,
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    tags: [],
    addedAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function dispositionColumn(csv: string): string[] {
  const rows = csv.split("\n");
  const i = rows[0].split(",").indexOf("Disposition");
  return rows.slice(1).map((row) => row.split(",")[i]);
}

describe("winesToCSV disposition labels", () => {
  it("uses the canonical UI labels", () => {
    const csv = winesToCSV(
      [
        makeWine({ id: "w-d", disposition: "D" }),
        makeWine({ id: "w-h", disposition: "H" }),
        makeWine({ id: "w-p", disposition: "P" }),
      ],
      new Map()
    );
    expect(dispositionColumn(csv)).toEqual(["Drink Now", "Hold", "Past Peak"]);
  });

  it("falls back to the raw code for an unknown disposition", () => {
    const csv = winesToCSV([makeWine({ disposition: "X" })], new Map());
    expect(dispositionColumn(csv)).toEqual(["X"]);
  });
});
