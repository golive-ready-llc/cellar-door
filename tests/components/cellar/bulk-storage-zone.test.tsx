import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Wine, StorageRow } from "@/types/wine";

// Stub drag/drop hooks — we don't need a DragDropProvider for render-level tests.
vi.mock("@/hooks/use-touch-drag", () => ({
  useTouchDrag: () => ({
    isDragging: false,
    dragHandleProps: { onPointerDown: vi.fn(), onContextMenu: vi.fn(), style: {} },
  }),
}));
vi.mock("@/hooks/use-drop-target", () => ({
  useDropTarget: () => ({ dropRef: { current: null }, isOver: false }),
}));

import { BulkStorageZone } from "@/components/cellar/bulk-storage-zone";

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

const looseRow: StorageRow = {
  row: 0,
  name: "Loose Bin",
  type: "bulk",
  capacity: 6,
};

describe("BulkStorageZone", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the X/N capacity counter", () => {
    const wines = [makeWine({ id: "a" }), makeWine({ id: "b" })];
    render(
      <BulkStorageZone
        cabinetId="cab-1"
        rowIndex={0}
        storageRow={looseRow}
        wines={wines}
      />
    );
    expect(screen.getByText("2/6")).toBeInTheDocument();
    expect(screen.getByText(/Loose Bin/i)).toBeInTheDocument();
  });

  it("renders effective disposition badge ('D') when stored is 'H' but drinkWindow is in range", () => {
    // disposition 'H' but drink window 2023-2038 means current year (2026) is drink-now → D
    const wines = [makeWine({ id: "a", disposition: "H", drinkWindow: "2023-2038" })];
    render(
      <BulkStorageZone
        cabinetId="cab-1"
        rowIndex={0}
        storageRow={looseRow}
        wines={wines}
        suppressTooltip
      />
    );
    expect(screen.getByText("D")).toBeInTheDocument();
    expect(screen.queryByText("H")).not.toBeInTheDocument();
  });

  it("clicking a loose bottle (view mode) fires onWineClick with that wine", () => {
    const onWineClick = vi.fn();
    const wines = [makeWine({ id: "a", name: "Pick Me" })];
    render(
      <BulkStorageZone
        cabinetId="cab-1"
        rowIndex={0}
        storageRow={looseRow}
        wines={wines}
        onWineClick={onWineClick}
        suppressTooltip
      />
    );
    // The loose bottle is the role=button child of the zone — find the
    // first one (zone itself isn't role=button without onBulkZoneClick).
    const bottle = screen.getAllByRole("button")[0];
    fireEvent.click(bottle);
    expect(onWineClick).toHaveBeenCalledWith(wines[0]);
  });

  it("empty zone (view mode) shows the '+' add placeholder when onAddClick is given", () => {
    const onAddClick = vi.fn();
    render(
      <BulkStorageZone
        cabinetId="cab-1"
        rowIndex={0}
        storageRow={looseRow}
        wines={[]}
        onAddClick={onAddClick}
        suppressTooltip
      />
    );
    // The "+" placeholder is the only role=button in this state
    const plus = screen.getByRole("button");
    fireEvent.click(plus);
    expect(onAddClick).toHaveBeenCalledTimes(1);
  });

  it("renders case visuals with N/M counts when storageRow.boxes is populated", () => {
    const caseRow: StorageRow = {
      row: 0,
      name: "Cases",
      type: "bulk",
      capacity: 18,
      boxes: [12, 6],
    };
    const wines = [
      // 2 wines in the first 12-pack (cols 0-11)
      makeWine({ id: "a", col: 0 }),
      makeWine({ id: "b", col: 1 }),
      // 1 wine in the second 6-pack (cols 12-17)
      makeWine({ id: "c", col: 12 }),
    ];
    render(
      <BulkStorageZone
        cabinetId="cab-1"
        rowIndex={0}
        storageRow={caseRow}
        wines={wines}
        suppressTooltip
      />
    );
    expect(screen.getByText("2/12")).toBeInTheDocument();
    expect(screen.getByText("1/6")).toBeInTheDocument();
  });
});
