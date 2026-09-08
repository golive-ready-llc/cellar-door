import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Wine } from "@/types/wine";

// Stub the wine-data context — same approach as peaking-banner.test.tsx.
const wines: Wine[] = [];
vi.mock("@/contexts/wine-data-context", () => ({
  useWineData: () => ({ wines, cabinets: [], walls: [], allTags: [] }),
}));

import { PeakingBanner } from "@/components/cellar/peaking-banner";

function makeWine(overrides: Partial<Wine>): Wine {
  return {
    id: "w1",
    userId: "u1",
    cabinetId: null,
    barcode: "",
    name: "Test Wine",
    winery: "Test Winery",
    region: "",
    country: "",
    vintage: 2018,
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
    depth: 1,
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

describe("PeakingBanner — edge cases", () => {
  beforeEach(() => {
    wines.length = 0;
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("day 7 still shows the banner (boundary inclusive); day 8 hides it", () => {
    // Day 7 — within window
    vi.setSystemTime(new Date("2026-05-07T12:00:00Z"));
    wines.push(makeWine({ id: "a", drinkWindow: "2024-2030" }));
    const { unmount } = render(<PeakingBanner />);
    expect(screen.getByText(/hitting their peak/i)).toBeInTheDocument();
    unmount();

    // Day 8 — outside window. Same wine, just clock advanced.
    vi.setSystemTime(new Date("2026-05-08T12:00:00Z"));
    const { container } = render(<PeakingBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("treats a non-'true' localStorage value as not-dismissed (corruption guard)", () => {
    vi.setSystemTime(new Date("2026-05-03T12:00:00Z"));
    // Garbage value somehow ended up there — anything other than the
    // exact string "true" must be treated as not-dismissed so the banner
    // still renders.
    window.localStorage.setItem("cd:peaking-banner:dismissed:2026-05", "yes");
    wines.push(makeWine({ id: "a", drinkWindow: "2024-2030" }));
    render(<PeakingBanner />);
    expect(screen.getByText(/hitting their peak/i)).toBeInTheDocument();
  });

  it("counts wines that are only 'approaching' (no drink-now bottles in cellar)", () => {
    vi.setSystemTime(new Date("2026-05-03T12:00:00Z"));
    // All three are approaching (start within 2 yrs of 2026), zero drink-now
    wines.push(
      makeWine({ id: "a", drinkWindow: "2027-2030" }),
      makeWine({ id: "b", drinkWindow: "2028-2031" }),
      makeWine({ id: "c", drinkWindow: "2027-2032" }),
    );
    render(<PeakingBanner />);
    expect(screen.getByText(/3 wines hitting their peak/i)).toBeInTheDocument();
  });
});
