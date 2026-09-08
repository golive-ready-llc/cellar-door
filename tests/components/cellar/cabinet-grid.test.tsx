import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Wine, Cabinet } from "@/types/wine";

// Stub all the drag/drop/long-press hooks the slot tree pulls in.
vi.mock("@/hooks/use-touch-drag", () => ({
  useTouchDrag: () => ({
    isDragging: false,
    dragHandleProps: { onPointerDown: vi.fn(), onContextMenu: vi.fn(), style: {} },
  }),
}));
vi.mock("@/hooks/use-drop-target", () => ({
  useDropTarget: () => ({ dropRef: { current: null }, isOver: false }),
}));
vi.mock("@/hooks/use-long-press", () => ({
  useLongPress: () => ({
    onPointerDown: vi.fn(),
    onPointerUp: vi.fn(),
    onPointerLeave: vi.fn(),
  }),
}));

import { CabinetGrid } from "@/components/cellar/cabinet-grid";

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

function makeCabinet(overrides: Partial<Cabinet> = {}): Cabinet {
  return {
    id: "cab-1",
    userId: "u1",
    wallId: "wall-1",
    name: "Cellar A",
    rows: 3,
    cols: 4,
    depth: 1,
    sortOrder: 0,
    storageRows: [],
    ...overrides,
  } as Cabinet;
}

describe("CabinetGrid", () => {
  it("renders rows × cols slots (no storage rows) — 3 × 4 = 12 slot buttons", () => {
    const cabinet = makeCabinet({ rows: 3, cols: 4, storageRows: [] });
    render(<CabinetGrid cabinet={cabinet} wines={[]} />);
    // Every WineSlot renders a role=button. With zero filled, all 12 are
    // empty-slot buttons.
    expect(screen.getAllByRole("button")).toHaveLength(12);
  });

  it("renders the cabinet name + total capacity counter", () => {
    const cabinet = makeCabinet({ name: "Garage Wall", rows: 2, cols: 3 });
    render(<CabinetGrid cabinet={cabinet} wines={[]} />);
    expect(screen.getByText("Garage Wall")).toBeInTheDocument();
    // 2 rows × 3 cols × 1 depth = 6 capacity, 0 wines → "0 / 6"
    expect(screen.getByText("0 / 6")).toBeInTheDocument();
  });

  it("filled slots show the wine type indicator (red wines render with the red type color)", () => {
    const cabinet = makeCabinet({ rows: 2, cols: 2 });
    const wine = makeWine({ id: "w1", row: 0, col: 0, type: "red" });
    const { container } = render(<CabinetGrid cabinet={cabinet} wines={[wine]} />);
    // A filled slot has a div styled with WINE_TYPE_COLORS.red = "#9B2335"
    // (lowercased rgb when rendered: rgb(155, 35, 53))
    const html = container.innerHTML.toLowerCase();
    expect(html).toMatch(/rgb\(155,\s*35,\s*53\)|#9b2335/);
  });

  it("counts wines correctly in the header (N / total)", () => {
    const cabinet = makeCabinet({ rows: 2, cols: 2 });
    const wines = [
      makeWine({ id: "a", row: 0, col: 0 }),
      makeWine({ id: "b", row: 1, col: 1 }),
      // Wine on a different cabinet — must NOT count.
      makeWine({ id: "c", cabinetId: "other", row: 0, col: 1 }),
    ];
    render(<CabinetGrid cabinet={cabinet} wines={wines} />);
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
  });

  it("includes a BulkStorageZone instead of a slot row for rows listed in storageRows", () => {
    const cabinet = makeCabinet({
      rows: 2,
      cols: 4,
      storageRows: [
        { row: 1, name: "Bulk Bin", type: "bulk", capacity: 12 },
      ],
    });
    render(<CabinetGrid cabinet={cabinet} wines={[]} />);
    // The bulk zone label appears (with the diamond/box prefix). The
    // standard slot grid would render 4×2=8 buttons; storage row replaces
    // row 1, so only 4 slot buttons (row 0) remain.
    expect(screen.getByText(/Bulk Bin/)).toBeInTheDocument();
    expect(screen.getByText("0/12")).toBeInTheDocument();
  });
});
