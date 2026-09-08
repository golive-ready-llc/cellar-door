import { describe, it, expect } from "vitest";
import {
  parseDrinkWindow,
  categorizeDrinkWindow,
  getEffectiveDisposition,
  getDrinkWindowStats,
} from "@/lib/drink-window";
import type { Wine } from "@/types/wine";

/**
 * Pure-function tests for the drink-window utility.
 *
 * The interesting boundaries are:
 *   - parseDrinkWindow: range vs single year vs en-dash vs malformed/empty
 *   - categorizeDrinkWindow: start-1, start, end, end+1 boundaries
 *   - getEffectiveDisposition: window overrides stored disposition
 *   - getDrinkWindowStats: bucketed aggregation
 */

function makeWine(partial: Partial<Wine>): Wine {
  // Minimal Wine stub — only the fields the drink-window helpers touch
  // are real, the rest are filler to satisfy the type.
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

describe("parseDrinkWindow", () => {
  it("parses a hyphen range '2025-2030'", () => {
    expect(parseDrinkWindow("2025-2030")).toEqual({ start: 2025, end: 2030 });
  });

  it("parses an en-dash range '2025–2030'", () => {
    expect(parseDrinkWindow("2025–2030")).toEqual({ start: 2025, end: 2030 });
  });

  it("parses a single year '2025' as start === end", () => {
    expect(parseDrinkWindow("2025")).toEqual({ start: 2025, end: 2025 });
  });

  it("returns nulls for empty string", () => {
    expect(parseDrinkWindow("")).toEqual({ start: null, end: null });
  });

  it("returns nulls for null input", () => {
    expect(parseDrinkWindow(null)).toEqual({ start: null, end: null });
  });

  it("returns nulls for undefined input", () => {
    expect(parseDrinkWindow(undefined)).toEqual({ start: null, end: null });
  });

  it("returns nulls for malformed input ('foo', '20-30', '2025-')", () => {
    expect(parseDrinkWindow("foo")).toEqual({ start: null, end: null });
    expect(parseDrinkWindow("20-30")).toEqual({ start: null, end: null });
    expect(parseDrinkWindow("2025-")).toEqual({ start: null, end: null });
  });

  it("trims whitespace and tolerates spaces around the dash", () => {
    expect(parseDrinkWindow("  2025 - 2030  ")).toEqual({ start: 2025, end: 2030 });
  });
});

describe("categorizeDrinkWindow", () => {
  const w = (drinkWindow: string) => makeWine({ drinkWindow });

  it("returns 'hold' when no window is set", () => {
    expect(categorizeDrinkWindow(w(""), 2026)).toBe("hold");
  });

  it("start-1 → 'approaching' (within 2 years)", () => {
    expect(categorizeDrinkWindow(w("2027-2030"), 2026)).toBe("approaching");
  });

  it("start year → 'drink-now' (lower boundary inclusive)", () => {
    expect(categorizeDrinkWindow(w("2026-2030"), 2026)).toBe("drink-now");
  });

  it("end year → 'drink-now' (upper boundary inclusive)", () => {
    expect(categorizeDrinkWindow(w("2026-2030"), 2030)).toBe("drink-now");
  });

  it("end+1 → 'past-peak'", () => {
    expect(categorizeDrinkWindow(w("2026-2030"), 2031)).toBe("past-peak");
  });

  it("'hold' when start is more than 2 years away", () => {
    expect(categorizeDrinkWindow(w("2030-2035"), 2026)).toBe("hold");
  });
});

describe("getEffectiveDisposition", () => {
  it("returns 'P' when currentYear > end (window wins over stored 'H')", () => {
    expect(
      getEffectiveDisposition({ disposition: "H", drinkWindow: "2020-2024" }, 2026)
    ).toBe("P");
  });

  it("returns 'D' when currentYear is inside the window", () => {
    expect(
      getEffectiveDisposition({ disposition: "H", drinkWindow: "2025-2030" }, 2026)
    ).toBe("D");
  });

  it("returns 'H' when currentYear < start", () => {
    expect(
      getEffectiveDisposition({ disposition: "P", drinkWindow: "2030-2035" }, 2026)
    ).toBe("H");
  });

  it("falls back to stored disposition when no window is parseable", () => {
    expect(getEffectiveDisposition({ disposition: "D", drinkWindow: "" }, 2026)).toBe("D");
    expect(getEffectiveDisposition({ disposition: "H", drinkWindow: "" }, 2026)).toBe("H");
    expect(getEffectiveDisposition({ disposition: "P", drinkWindow: "" }, 2026)).toBe("P");
  });

  it("returns '' when no window AND stored disposition is unknown", () => {
    expect(getEffectiveDisposition({ disposition: "", drinkWindow: "" }, 2026)).toBe("");
    expect(getEffectiveDisposition({ disposition: "X", drinkWindow: "" }, 2026)).toBe("");
  });
});

describe("getDrinkWindowStats", () => {
  it("buckets a mixed set of wines by category", () => {
    const wines: Wine[] = [
      makeWine({ id: "1", drinkWindow: "2026-2028" }), // drink-now
      makeWine({ id: "2", drinkWindow: "2027-2030" }), // approaching (start-1)
      makeWine({ id: "3", drinkWindow: "2020-2024" }), // past-peak
      makeWine({ id: "4", drinkWindow: "2030-2035" }), // hold
      makeWine({ id: "5", drinkWindow: "" }), // hold (no window)
    ];
    const stats = getDrinkWindowStats(wines, 2026);
    expect(stats["drink-now"].map((w) => w.id)).toEqual(["1"]);
    expect(stats.approaching.map((w) => w.id)).toEqual(["2"]);
    expect(stats["past-peak"].map((w) => w.id)).toEqual(["3"]);
    expect(stats.hold.map((w) => w.id)).toEqual(["4", "5"]);
  });

  it("returns empty buckets for an empty wine list", () => {
    const stats = getDrinkWindowStats([], 2026);
    expect(stats["drink-now"]).toEqual([]);
    expect(stats.approaching).toEqual([]);
    expect(stats["past-peak"]).toEqual([]);
    expect(stats.hold).toEqual([]);
  });
});
