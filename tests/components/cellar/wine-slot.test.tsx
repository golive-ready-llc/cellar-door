import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Wine } from "@/types/wine";

// ─── Mock the drag/drop/long-press hooks (they pull in the whole
// DragDropProvider tree, which we don't need for a render-level test) ──
vi.mock("@/hooks/use-touch-drag", () => ({
  useTouchDrag: () => ({
    isDragging: false,
    dragHandleProps: { onPointerDown: vi.fn(), style: {} },
  }),
}));
vi.mock("@/hooks/use-drop-target", () => ({
  useDropTarget: () => ({
    dropRef: { current: null },
    isOver: false,
  }),
}));
vi.mock("@/hooks/use-long-press", () => ({
  useLongPress: () => ({
    onPointerDown: vi.fn(),
    onPointerUp: vi.fn(),
    onPointerLeave: vi.fn(),
  }),
}));

import { WineSlot } from "@/components/cellar/wine-slot";

function makeWine(overrides: Partial<Wine> = {}): Wine {
  return {
    id: "w-1",
    userId: "u1",
    cabinetId: "cab-1",
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

describe("WineSlot — effective disposition (drinkWindow overrides stored field)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pin the year so categorizeDrinkWindow / getEffectiveDisposition don't
    // depend on real wall-clock.
    vi.setSystemTime(new Date("2026-05-02T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stored 'H' but drinkWindow puts wine in the drinking range → renders 'D'", () => {
    const wine = makeWine({ disposition: "H", drinkWindow: "2023-2038" });
    render(
      <WineSlot
        cabinetId="cab-1"
        wine={wine}
        allWines={[wine]}
        depth={0}
        compact={false}
        suppressTooltip
      />
    );
    expect(screen.getByText("D")).toBeInTheDocument();
    // The stale stored 'H' must NOT appear as the badge label
    expect(screen.queryByText("H")).not.toBeInTheDocument();
  });

  it("stored 'D' but drinkWindow is past → renders 'P'", () => {
    const wine = makeWine({ disposition: "D", drinkWindow: "2010-2015" });
    render(
      <WineSlot
        cabinetId="cab-1"
        wine={wine}
        allWines={[wine]}
        depth={0}
        compact={false}
        suppressTooltip
      />
    );
    expect(screen.getByText("P")).toBeInTheDocument();
    expect(screen.queryByText("D")).not.toBeInTheDocument();
  });

  it("renders no disposition badge when wine has no drinkWindow and disposition is unset", () => {
    const wine = makeWine({ disposition: "", drinkWindow: "" });
    render(
      <WineSlot
        cabinetId="cab-1"
        wine={wine}
        allWines={[wine]}
        depth={0}
        compact={false}
        suppressTooltip
      />
    );
    // No D/H/P text in the slot
    expect(screen.queryByText(/^[DHP]$/)).not.toBeInTheDocument();
  });

  it("falls back to stored disposition when drinkWindow is empty", () => {
    const wine = makeWine({ disposition: "H", drinkWindow: "" });
    render(
      <WineSlot
        cabinetId="cab-1"
        wine={wine}
        allWines={[wine]}
        depth={0}
        compact={false}
        suppressTooltip
      />
    );
    expect(screen.getByText("H")).toBeInTheDocument();
  });

  it("renders an empty slot (with role=button + dashed border) when wine is undefined", () => {
    render(
      <WineSlot
        cabinetId="cab-1"
        wine={undefined}
        allWines={[]}
        depth={0}
        compact={false}
        suppressTooltip
      />
    );
    // Empty slot is the only role=button — a filled slot would carry text.
    const slot = screen.getByRole("button");
    expect(slot).toBeInTheDocument();
    expect(slot.className).toMatch(/border-dashed/);
  });

  it("disposition badge color matches the EFFECTIVE disposition (green for D)", () => {
    const wine = makeWine({ disposition: "H", drinkWindow: "2023-2038" });
    render(
      <WineSlot
        cabinetId="cab-1"
        wine={wine}
        allWines={[wine]}
        depth={0}
        compact={false}
        suppressTooltip
      />
    );
    const badge = screen.getByText("D");
    // DISPOSITION_COLORS["D"] is green (#2e7d32 / rgb(46, 125, 50))
    const bg = (badge as HTMLElement).style.background;
    expect(bg.toLowerCase()).toContain("rgb(46, 125, 50)");
  });
});
