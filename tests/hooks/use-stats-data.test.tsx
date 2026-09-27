import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

/**
 * The stats load path must not swallow fetch failures: a rejected load
 * surfaces as `loadError` so the page can show an error state, and
 * `retryLoad` recovers without remounting.
 */

vi.mock("@/lib/data", () => ({
  fetchWines: vi.fn(async () => []),
  fetchHistory: vi.fn(async () => []),
  fetchWalls: vi.fn(async () => []),
  fetchCabinets: vi.fn(async () => []),
}));

vi.mock("@/lib/wine-collection", () => ({
  editWineAndSync: vi.fn(),
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ userId: "u1", devMode: false, demoMode: false }),
}));

import { useStatsData } from "@/hooks/use-stats-data";
import { fetchWines } from "@/lib/data";
import type { Wine } from "@/types/wine";

function makeWine(overrides: Partial<Wine> = {}): Wine {
  return {
    id: "w1",
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
    row: null,
    col: null,
    depth: 0,
    zone: "",
    tastingNotes: null,
    disposition: "D",
    drinkWindow: "",
    aiRatings: null,
    tags: [],
    addedAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("useStatsData load failures", () => {
  it("surfaces a failed load and recovers on retry", async () => {
    vi.mocked(fetchWines).mockRejectedValueOnce(new Error("network down"));

    const { result } = renderHook(() => useStatsData());
    await act(async () => {});
    expect(result.current.loadError).toBe(true);
    expect(result.current.wines).toEqual([]);

    vi.mocked(fetchWines).mockResolvedValueOnce([makeWine()]);
    await act(async () => {
      await result.current.retryLoad();
    });
    expect(result.current.loadError).toBe(false);
    expect(result.current.wines.length).toBe(1);
  });
});
