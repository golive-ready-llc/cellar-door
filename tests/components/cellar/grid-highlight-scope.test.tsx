import { describe, it, expect, vi } from "vitest";
import { useMemo, useCallback } from "react";
import { render, act } from "@testing-library/react";

let slotRenders = 0;
let highlightedSlotRenders = 0;
const rendersByCabinet = new Map<string, number>();

// Count real slot renders, split by cabinet and by highlight flag: after the
// fix, a highlight flash re-renders one row of one cabinet and nothing else.
vi.mock("@/components/cellar/wine-slot", () => ({
  WineSlot: ({
    cabinetId,
    highlighted,
  }: {
    cabinetId: string;
    highlighted?: boolean;
  }) => {
    slotRenders++;
    rendersByCabinet.set(cabinetId, (rendersByCabinet.get(cabinetId) ?? 0) + 1);
    if (highlighted) highlightedSlotRenders++;
    return <div data-testid="wine-slot" />;
  },
}));

import { DragDropProvider } from "@/components/cellar/drag-drop-context";
import { ViewModeGrid } from "@/components/cellar/view-mode-grid";
import type { Wine, Cabinet, Wall } from "@/types/wine";

/**
 * The pulsing wine highlight (deep link, add/place flash, sort assistant) and
 * the gold empty-slot glow used to re-render every slot on the wall — 720 slot
 * renders for one bottle lighting up, twice per flash (set + 4s auto-clear).
 * The highlight is now resolved to its one cabinet in ViewModeGrid and to its
 * one column per row in CabinetGrid, so the memoized wrappers and rows skip
 * everything the flash doesn't touch. These tests pin that scope.
 */

const CABINETS = 6;
const ROWS = 12;
const COLS = 10;
const TARGET_ID = "w-target";
const TARGET_CABINET = "cab-2";
const TARGET_ROW = 4;
const TARGET_COL = 6;

function makeWines(): Wine[] {
  const wines: Wine[] = [];
  for (let i = 0; i < 250; i++) {
    wines.push({
      id: `w-${i}`,
      userId: "u1",
      cabinetId: `cab-${i % CABINETS}`,
      barcode: "",
      name: `Wine ${i}`,
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
  wines.push({
    id: TARGET_ID,
    userId: "u1",
    cabinetId: TARGET_CABINET,
    barcode: "",
    name: "Target Wine",
    winery: "Target Winery",
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
    row: TARGET_ROW,
    col: TARGET_COL,
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

function Harness({ highlightedWineId }: { highlightedWineId: string | null }) {
  const displayWines = useMemo(() => WINES, []);
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
    <ViewModeGrid
      wallCabinets={CABINETS_FIXTURE}
      walls={WALLS}
      cabinets={CABINETS_FIXTURE}
      displayWines={displayWines}
      moveMode={false}
      highlightedWineId={highlightedWineId}
      allTags={[]}
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
  );
}

function renderHarness() {
  slotRenders = 0;
  highlightedSlotRenders = 0;
  rendersByCabinet.clear();
  const utils = render(
    <DragDropProvider>
      <Harness highlightedWineId={null} />
    </DragDropProvider>
  );
  return utils;
}

describe("Cellar highlight flash scope", () => {
  it("a highlight flash re-renders only the highlighted wine's row", () => {
    const { rerender } = renderHarness();
    expect(slotRenders).toBe(CABINETS * ROWS * COLS);

    slotRenders = 0;
    highlightedSlotRenders = 0;
    rendersByCabinet.clear();
    act(() => {
      rerender(
        <DragDropProvider>
          <Harness highlightedWineId={TARGET_ID} />
        </DragDropProvider>
      );
    });

    // Exactly one slot shows the pulse...
    expect(highlightedSlotRenders).toBe(1);
    // ...and only its row re-rendered (every slot of one row, none elsewhere).
    expect(slotRenders).toBeLessThanOrEqual(COLS);
    for (const [cabinetId, count] of rendersByCabinet) {
      if (cabinetId !== TARGET_CABINET) expect(count).toBe(0);
    }
    expect(rendersByCabinet.get(TARGET_CABINET)).toBeGreaterThan(0);

    // Clearing the flash (the 4s auto-clear) is equally cheap.
    slotRenders = 0;
    highlightedSlotRenders = 0;
    rendersByCabinet.clear();
    act(() => {
      rerender(
        <DragDropProvider>
          <Harness highlightedWineId={null} />
        </DragDropProvider>
      );
    });
    expect(slotRenders).toBeLessThanOrEqual(COLS);
    expect(highlightedSlotRenders).toBe(0);
    for (const [cabinetId, count] of rendersByCabinet) {
      if (cabinetId !== TARGET_CABINET) expect(count).toBe(0);
    }
  });

  it("a highlight that moved between cabinets re-renders only both affected rows", () => {
    const { rerender } = renderHarness();
    expect(slotRenders).toBe(CABINETS * ROWS * COLS);

    slotRenders = 0;
    rendersByCabinet.clear();
    act(() => {
      rerender(
        <DragDropProvider>
          <Harness highlightedWineId={TARGET_ID} />
        </DragDropProvider>
      );
    });
    expect(slotRenders).toBeLessThanOrEqual(COLS);

    slotRenders = 0;
    rendersByCabinet.clear();
    act(() => {
      rerender(
        <DragDropProvider>
          <Harness highlightedWineId="w-7" />
        </DragDropProvider>
      );
    });
    // w-7 lives in cab-1 (7 % 6) — the flash moved, so at most the old row
    // (unhighlighting) and the new row (highlighting) re-render.
    expect(slotRenders).toBeLessThanOrEqual(COLS * 2);
    expect(rendersByCabinet.get("cab-0")).toBeUndefined();
    expect(rendersByCabinet.get("cab-2")).toBeLessThanOrEqual(COLS);
    expect(rendersByCabinet.get("cab-1")).toBeLessThanOrEqual(COLS);
  });
});
