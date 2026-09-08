import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Wine } from "@/types/wine";

// Stub the wine-data context — keeps the test from pulling next/navigation
// and other heavy WineDataProvider deps.
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

describe("PeakingBanner", () => {
  beforeEach(() => {
    wines.length = 0;
    window.localStorage.clear();
    // Day 3 of the month (within 1-7 window).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the count when wines are in drink-now / approaching window", () => {
    wines.push(
      makeWine({ id: "a", drinkWindow: "2024-2030" }), // drink-now
      makeWine({ id: "b", drinkWindow: "2027-2032" }), // approaching (within 2 yrs of 2026)
      makeWine({ id: "c", drinkWindow: "2040-2050" })  // hold — not counted
    );
    render(<PeakingBanner />);
    expect(
      screen.getByText(/2 wines hitting their peak/i)
    ).toBeInTheDocument();
  });

  it("is hidden when day-of-month > 7", () => {
    vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));
    wines.push(makeWine({ id: "a", drinkWindow: "2024-2030" }));
    const { container } = render(<PeakingBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("is hidden when no wines qualify", () => {
    // empty wines array
    const { container } = render(<PeakingBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("dismiss button persists to localStorage with the YYYY-MM key and hides immediately", () => {
    wines.push(makeWine({ id: "a", drinkWindow: "2024-2030" }));
    const { container } = render(<PeakingBanner />);
    expect(screen.getByText(/hitting their peak/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/dismiss/i));

    expect(container.firstChild).toBeNull();
    expect(
      window.localStorage.getItem("cd:peaking-banner:dismissed:2026-05")
    ).toBe("true");
  });
});
