import { describe, it, expect, vi } from "vitest";
import { useDeferredValue, useMemo, useState, useCallback } from "react";
import { render, act, fireEvent, screen } from "@testing-library/react";

let slotRenders = 0;

// Count real slot renders: when the memoized grid bails out, none of these run.
vi.mock("@/components/cellar/wine-slot", () => ({
  WineSlot: () => {
    slotRenders++;
    return <div data-testid="wine-slot" />;
  },
}));

import { DragDropProvider } from "@/components/cellar/drag-drop-context";
import { ViewModeGrid } from "@/components/cellar/view-mode-grid";
import type { Wine, Cabinet, Wall } from "@/types/wine";

/**
 * The cellar page's search box sits above a grid that is hundreds of slots
 * deep. The filter is deferred (useDeferredValue) and ViewModeGrid is
 * memoized, so a keystroke updates the input without re-rendering the wall,
 * and sibling state changes (dialog toggles, highlight flashes) skip the grid
 * entirely while its data is unchanged. These tests pin both: the bailout,
 * and that the deferred filter settles on exactly the same results the old
 * synchronous filter produced.
 */

const CABINETS = 6;
const ROWS = 12;
const COLS = 10;

function makeWines(): Wine[] {
  const wines: Wine[] = [];
  for (let i = 0; i < 250; i++) {
    wines.push({
      id: `w-${i}`,
      userId: "u1",
      cabinetId: `cab-${i % CABINETS}`,
      barcode: "",
      name: i % 7 === 0 ? `Chianti Reserve ${i}` : `Wine ${i}`,
      winery: `Winery ${i % 30}`,
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
      row: Math.floor(i / COLS) % ROWS,
      col: i % COLS,
      depth: 0,
      zone: "",
      tastingNotes: null,
      disposition: "",
      drinkWindow: "",
      aiRatings: null,
      tags: [],
      addedAt: "",
      updatedAt: "",
    });
  }
  return wines;
}

const WINES = makeWines();
const CABINETS_FIXTURE = Array.from({ length: CABINETS }, (_, i) => ({
  id: `cab-${i}`,
  userId: "u1",
  wallId: "wall-1",
  name: `Section ${i + 1}`,
  rows: ROWS,
  cols: COLS,
  depth: 1,
  sortOrder: i,
  storageRows: [],
})) as Cabinet[];
const WALLS = [
  { id: "wall-1", userId: "u1", name: "Main Wall", location: "", sortOrder: 0 },
] as Wall[];
const ALL_TAGS: string[] = [];

function Harness() {
  const [query, setQuery] = useState("");
  const [sibling, setSibling] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => {
    if (!deferredQuery.trim()) return WINES;
    const q = deferredQuery.toLowerCase();
    return WINES.filter(
      (w) =>
        w.name?.toLowerCase().includes(q) || w.winery?.toLowerCase().includes(q)
    );
  }, [deferredQuery]);
  const onWineClick = useCallback(() => {}, []);
  const onWineLongPress = useCallback(() => {}, []);
  const onWineDrop = useCallback(() => {}, []);
  const onSlotClick = useCallback(() => {}, []);
  const onDepthSlotClick = useCallback(() => {}, []);
  const onBulkZoneClick = useCallback(() => {}, []);
  const onEnterEditMode = useCallback(() => {}, []);
  const onWallChanges = useCallback(async () => {}, []);
  const onWallsChanged = useCallback(async () => {}, []);
  const onAddWine = useCallback(async () => {}, []);
  return (
    <div>
      <input
        aria-label="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button onClick={() => setSibling((s) => s + 1)}>sibling</button>
      <span data-testid="sibling-state">{sibling}</span>
      <ViewModeGrid
        wallCabinets={CABINETS_FIXTURE}
        walls={WALLS}
        cabinets={CABINETS_FIXTURE}
        displayWines={filtered}
        moveMode={false}
        highlightedWineId={null}
        allTags={ALL_TAGS}
        onWineClick={onWineClick}
        onWineLongPress={onWineLongPress}
        onWineDrop={onWineDrop}
        onSlotClick={onSlotClick}
        onDepthSlotClick={onDepthSlotClick}
        onBulkZoneClick={onBulkZoneClick}
        onEnterEditMode={onEnterEditMode}
        onWallChanges={onWallChanges}
        onWallsChanged={onWallsChanged}
        onAddWine={onAddWine}
      />
    </div>
  );
}

function renderHarness() {
  slotRenders = 0;
  const utils = render(
    <DragDropProvider>
      <Harness />
    </DragDropProvider>
  );
  return utils;
}

describe("Cellar search deferral + grid memo", () => {
  it("re-renders no slots when sibling state changes and cellar data is unchanged", () => {
    const { getByText } = renderHarness();
    expect(slotRenders).toBe(CABINETS * ROWS * COLS);
    const bump = getByText("sibling");
    slotRenders = 0;
    act(() => {
      fireEvent.click(bump);
    });
    act(() => {
      fireEvent.click(bump);
    });
    expect(screen.getByTestId("sibling-state").textContent).toBe("2");
    expect(slotRenders).toBe(0);
    expect(screen.getByText("Section 1")).toBeInTheDocument();
  });

  it("typing settles on exactly the wines the synchronous filter would show", () => {
    renderHarness();
    const input = screen.getByLabelText("search");
    act(() => {
      fireEvent.change(input, { target: { value: "chianti" } });
    });
    // Only names containing "chianti" survive: i % 7 === 0, i < 250 → 36
    // wines, 6 per cabinet (i ≡ 0 mod 42). The cabinet header shows
    // "<filtered count> / <capacity>", so each of the 6 sections reads 6 / 120.
    const counters = screen.getAllByText("6 / 120");
    expect(counters).toHaveLength(6);
    act(() => {
      fireEvent.change(input, { target: { value: "" } });
    });
    // 250 wines over 6 cabinets: the first four hold 42, the last two 41.
    expect(screen.getAllByText("42 / 120")).toHaveLength(4);
    expect(screen.getAllByText("41 / 120")).toHaveLength(2);
  });

  it("a fast keystroke burst still produces the final filtered wall", () => {
    renderHarness();
    const input = screen.getByLabelText("search");
    act(() => {
      for (const end of [1, 2, 3, 4, 5, 6, 7]) {
        fireEvent.change(input, { target: { value: "chianti".slice(0, end) } });
      }
    });
    expect(screen.getAllByText("6 / 120")).toHaveLength(6);
  });
});
