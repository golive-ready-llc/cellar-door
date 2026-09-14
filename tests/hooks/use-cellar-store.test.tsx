import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ReactNode } from "react";

/**
 * The cellar store's client-side choreography: the dialog transitions (Base UI
 * dialogs must fully unmount before the next one opens), the bulk-zone drop
 * placement arithmetic, and show-in-cellar's close-then-scroll dance.
 */

const h = vi.hoisted(() => ({
  editWine: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  fetchWines: vi.fn(async () => []),
  fetchCabinets: vi.fn(async () => []),
  fetchWalls: vi.fn(async () => []),
  fetchHistory: vi.fn(async () => []),
  fetchBuyList: vi.fn(async () => []),
  invalidateReadCache: vi.fn(),
  editWine: (...args: unknown[]) => h.editWine(...args),
  bulkDeleteWines: vi.fn(async () => 0),
  createCabinet: vi.fn(async () => ({})),
  editCabinet: vi.fn(async () => ({})),
  removeCabinet: vi.fn(async () => {}),
  createWall: vi.fn(async () => ({})),
  editWall: vi.fn(async () => ({})),
  removeWall: vi.fn(async () => {}),
  fetchCellarSettings: vi.fn(async () => ({ onboarded: true, cellarName: "" })),
  saveCellarSettings: vi.fn(async (data: Record<string, unknown>) => data),
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: { displayName: "Joel" }, devMode: false, demoMode: false, userId: "u1" }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import { useCellar } from "@/hooks/use-cellar";
import { EditModeProvider } from "@/components/cellar/edit-mode-context";
import type { Wine, StorageRow } from "@/types/wine";

const wrapper = ({ children }: { children: ReactNode }) => (
  <EditModeProvider>{children}</EditModeProvider>
);

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

const BULK_ROW: StorageRow = { row: 0, name: "Bulk Storage", type: "bulk", capacity: 4, boxes: [2] };

async function renderCellar() {
  const rendered = renderHook(() => useCellar(), { wrapper });
  // Flush the mount effects (loadData fetches).
  await act(async () => {});
  return rendered;
}

describe("useCellar choreography", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.editWine.mockReset();
    h.editWine.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("opens the detail dialog on wine click", async () => {
    const { result } = await renderCellar();
    const wine = makeWine();
    act(() => result.current.actions.handleWineClick(wine));
    expect(result.current.dialogs.selectedWine).toBe(wine);
    expect(result.current.dialogs.detailOpen).toBe(true);
  });

  it("defers the consume dialog until the detail dialog has unmounted", async () => {
    const { result } = await renderCellar();
    act(() => result.current.actions.handleWineClick(makeWine()));
    act(() => result.current.dialogs.triggerConsume());
    expect(result.current.dialogs.detailOpen).toBe(false);
    expect(result.current.dialogs.consumeOpen).toBe(false);
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.dialogs.consumeOpen).toBe(true);
  });

  it("defers the wine-list-scan dialog until add-wine has unmounted", async () => {
    const { result } = await renderCellar();
    act(() => result.current.dialogs.setAddWineOpen(true));
    act(() => result.current.dialogs.triggerWineListScan());
    expect(result.current.dialogs.addWineOpen).toBe(false);
    expect(result.current.dialogs.wineListScanOpen).toBe(false);
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.dialogs.wineListScanOpen).toBe(true);
  });

  it("drops a wine into the bulk zone's first free column and flashes it", async () => {
    const { result } = await renderCellar();
    act(() =>
      result.current.dialogs.handleBulkZoneClick("cab-1", 0, BULK_ROW, "Rack")
    );
    // boxes: [2] means columns 0-1 are the case; col 2 is occupied.
    const dropped = makeWine({ id: "drop-me", cabinetId: "cab-1", row: 0, col: 2 });
    act(() => result.current.data.setWines([dropped]));

    await act(async () => {
      await result.current.actions.handleBulkZoneDrop("drop-me");
    });

    expect(h.editWine).toHaveBeenCalledWith(
      "drop-me",
      { cabinetId: "cab-1", row: 0, col: 3, depth: 0 },
      "u1"
    );
    expect(result.current.data.wines[0].col).toBe(3);
    expect(result.current.dialogs.bulkZoneWines).toHaveLength(1);
    expect(result.current.data.highlightedWineId).toBe("drop-me");
  });

  it("refuses a bulk-zone drop when the zone is full or the cabinet is unsaved", async () => {
    const { result } = await renderCellar();
    act(() =>
      result.current.dialogs.handleBulkZoneClick("cab-1", 0, BULK_ROW, "Rack")
    );
    const fullZone = [
      makeWine({ id: "a", cabinetId: "cab-1", row: 0, col: 0 }),
      makeWine({ id: "b", cabinetId: "cab-1", row: 0, col: 1 }),
      makeWine({ id: "c", cabinetId: "cab-1", row: 0, col: 2 }),
      makeWine({ id: "d", cabinetId: "cab-1", row: 0, col: 3 }),
    ];
    act(() => result.current.data.setWines(fullZone));

    await act(async () => {
      await result.current.actions.handleBulkZoneDrop("a");
    });
    expect(h.editWine).not.toHaveBeenCalled();

    act(() =>
      result.current.dialogs.handleBulkZoneClick("__new_1", 0, BULK_ROW, "Draft")
    );
    await act(async () => {
      await result.current.actions.handleBulkZoneDrop("a");
    });
    expect(h.editWine).not.toHaveBeenCalled();
  });

  it("show-in-cellar closes the detail dialog, then switches wall, flashes and scrolls", async () => {
    document.body.innerHTML = '<div id="cabinet-cab-1" />';
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { result } = await renderCellar();
    const wine = makeWine({ cabinetId: "cab-1", row: 0, col: 0 });
    act(() => result.current.data.setCabinets([
      {
        id: "cab-1",
        userId: "u1",
        wallId: "wall-1",
        name: "Rack",
        rows: 1,
        cols: 1,
        depth: 1,
        sortOrder: 0,
        storageRows: [],
      },
    ]));
    act(() => result.current.actions.handleWineClick(wine));
    expect(result.current.dialogs.detailOpen).toBe(true);

    act(() => result.current.actions.handleShowInCellar(wine));
    expect(result.current.dialogs.detailOpen).toBe(false);

    act(() => vi.advanceTimersByTime(300 + 150));
    expect(result.current.data.selectedWallId).toBe("wall-1");
    expect(result.current.data.highlightedWineId).toBe("w1");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });
});
