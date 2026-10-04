import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, renderHook, screen, fireEvent, act } from "@testing-library/react";
import type { Wine, StorageRow } from "@/types/wine";

// Stub drag/drop hooks — render-level tests don't need a DragDropProvider.
vi.mock("@/hooks/use-touch-drag", () => ({
  useTouchDrag: () => ({
    isDragging: false,
    dragHandleProps: { onPointerDown: vi.fn(), onContextMenu: vi.fn(), style: {} },
  }),
}));
vi.mock("@/hooks/use-drop-target", () => ({
  useDropTarget: () => ({ dropRef: { current: null }, isOver: false }),
}));

import { BulkZoneSideView } from "@/components/cellar/bulk-zone-side-view";
import { DepthSideView } from "@/components/cellar/depth-side-view";
import { useBatchSelection } from "@/components/cellar/batch-selection";

/**
 * The multi-select + batch-remove flow is shared verbatim by both cellar
 * drill-down sheets (BulkZoneSideView and DepthSideView). These tests pin the
 * behavior through each component's public surface so a shared extraction
 * cannot drift from either.
 */

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

/** Mirrors the real mount in bulk-storage-zone: the parent owns `open`. */
function BulkHost({
  wines,
  onBatchRemove,
}: {
  wines: Wine[];
  onBatchRemove?: (ids: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  return (
    <BulkZoneSideView
      open={open}
      onOpenChange={setOpen}
      storageRow={looseRow}
      wines={wines}
      sectionName="Cellar"
      onBatchRemove={onBatchRemove}
    />
  );
}

/** Mirrors the real mount in cellar-dialogs: the parent owns `open`. */
function DepthHost({
  wines,
  onBatchRemove,
}: {
  wines: Wine[];
  onBatchRemove?: (ids: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  return (
    <DepthSideView
      open={open}
      onOpenChange={setOpen}
      row={0}
      col={1}
      depth={2}
      wines={wines}
      sectionName="Cellar"
      onWineClick={vi.fn()}
      onWineLongPress={vi.fn()}
      onBatchRemove={onBatchRemove}
    />
  );
}

describe("BulkZoneSideView batch selection", () => {
  it("selects wines, confirms, and calls onBatchRemove with the ids", async () => {
    const onBatchRemove = vi.fn().mockResolvedValue(undefined);
    const wines = [
      makeWine({ id: "a", name: "Alpha", vintage: 2019 }),
      makeWine({ id: "b", name: "Beta", vintage: 2021 }),
    ];
    render(<BulkHost wines={wines} onBatchRemove={onBatchRemove} />);

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByText("Alpha"));
    fireEvent.click(screen.getByText("Beta"));

    expect(screen.getAllByText("2 selected")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(
      screen.getByRole("heading", { name: /Remove 2 Wines/ })
    ).toBeInTheDocument();
    expect(screen.getByText("Alpha (2019)")).toBeInTheDocument();
    expect(screen.getByText("Beta (2021)")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove All" }));
    });

    expect(onBatchRemove).toHaveBeenCalledWith(["a", "b"]);
    // Success exits select mode and closes the dialog.
    expect(
      screen.queryByRole("heading", { name: /Remove 2 Wines/ })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
  });

  it("Select All selects every wine; Deselect All empties the selection", () => {
    const wines = [makeWine({ id: "a", name: "Alpha" }), makeWine({ id: "b", name: "Beta" })];
    render(<BulkHost wines={wines} onBatchRemove={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Select All \(2\)/ }));
    expect(screen.getAllByText("2 selected")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Deselect All" }));
    // The floating bar needs at least one selection; only the pill state remains.
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Select All \(2\)/ })).toBeInTheDocument();
  });

  it("Cancel exits select mode and clears the selection", () => {
    const wines = [makeWine({ id: "a", name: "Alpha" })];
    render(<BulkHost wines={wines} onBatchRemove={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByText("Alpha"));
    expect(screen.getAllByText("1 selected")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
  });

  it("clears selection state when the sheet closes and reopens", () => {
    const wines = [makeWine({ id: "a", name: "Alpha" })];
    const { rerender } = render(
      <BulkZoneSideView
        open
        onOpenChange={vi.fn()}
        storageRow={looseRow}
        wines={wines}
        sectionName="Cellar"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByText("Alpha"));
    expect(screen.getAllByText("1 selected")).toHaveLength(2);

    rerender(
      <BulkZoneSideView
        open={false}
        onOpenChange={vi.fn()}
        storageRow={looseRow}
        wines={wines}
        sectionName="Cellar"
      />
    );
    rerender(
      <BulkZoneSideView
        open
        onOpenChange={vi.fn()}
        storageRow={looseRow}
        wines={wines}
        sectionName="Cellar"
      />
    );

    // Select mode did not survive the close: the header offers "Select" again.
    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
  });
});

describe("DepthSideView batch selection", () => {
  it("selects a wine through the layer card and calls onBatchRemove with the id", async () => {
    const onBatchRemove = vi.fn().mockResolvedValue(undefined);
    const wines = [
      makeWine({ id: "a", name: "Alpha", depth: 0 }),
      makeWine({ id: "b", name: "Beta", depth: 1 }),
    ];
    render(<DepthHost wines={wines} onBatchRemove={onBatchRemove} />);

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByText("Alpha"));

    expect(screen.getAllByText("1 selected")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(
      screen.getByRole("heading", { name: /Remove 1 Wines/ })
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove All" }));
    });

    expect(onBatchRemove).toHaveBeenCalledWith(["a"]);
    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
  });

  it("Select All covers every depth layer", () => {
    const wines = [
      makeWine({ id: "a", name: "Alpha", depth: 0 }),
      makeWine({ id: "b", name: "Beta", depth: 1 }),
    ];
    render(<DepthHost wines={wines} onBatchRemove={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByRole("button", { name: /Select All \(2\)/ }));
    expect(screen.getAllByText("2 selected")).toHaveLength(2);
  });
});

describe("useBatchSelection", () => {
  const wines = [makeWine({ id: "a" }), makeWine({ id: "b" })];

  it("keeps the confirm dialog open when the removal fails, and resets deleting", async () => {
    const onBatchRemove = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() =>
      useBatchSelection(wines, true, onBatchRemove)
    );

    act(() => {
      result.current.enterSelectMode();
      result.current.toggleSelection("a");
      result.current.openDeleteConfirm();
    });
    expect(result.current.deleteConfirmOpen).toBe(true);

    // The shared handler has no catch — a failed removal must surface to the
    // caller (the sheet's parent toasts it) while the dialog stays put.
    await expect(result.current.handleBatchRemove()).rejects.toThrow("boom");

    expect(result.current.deleteConfirmOpen).toBe(true);
    expect(result.current.deleting).toBe(false);
    // The selection survives a failed removal so the user can retry.
    expect(result.current.selectedIds.has("a")).toBe(true);
  });

  it("does nothing without a callback or a selection", async () => {
    const { result } = renderHook(() => useBatchSelection(wines, true, undefined));
    act(() => {
      result.current.enterSelectMode();
      result.current.openDeleteConfirm();
    });
    await result.current.handleBatchRemove();
    expect(result.current.deleteConfirmOpen).toBe(true);
  });

  it("clears selection state when the sheet closes", () => {
    const { result, rerender } = renderHook(
      ({ open }) => useBatchSelection(wines, open, vi.fn()),
      { initialProps: { open: true } }
    );

    act(() => {
      result.current.enterSelectMode();
      result.current.selectAll();
    });
    expect(result.current.selectedIds.size).toBe(2);

    rerender({ open: false });
    expect(result.current.selectMode).toBe(false);
    expect(result.current.selectedIds.size).toBe(0);
  });
});
