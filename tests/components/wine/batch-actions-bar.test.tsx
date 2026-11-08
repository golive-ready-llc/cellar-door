import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Wine } from "@/types/wine";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  default: vi.fn(),
}));
vi.mock("@/components/ui/custom-toast", () => ({ toast: toastMock }));

import { BatchActionsBar } from "@/components/wine/batch-actions-bar";

const onClearSelection = vi.fn();
const onBatchMove = vi.fn<(ids: string[], cabinetId: string | null) => Promise<void>>();
const onBatchDelete = vi.fn<(ids: string[]) => Promise<void>>();
const onBatchTag = vi.fn();
const onBatchType = vi.fn();

const wine: Wine = {
  id: "w1",
  userId: "u1",
  cabinetId: null,
  barcode: "",
  name: "Bollinger RD",
  winery: "",
  region: "",
  country: "",
  vintage: 2016,
  type: "sparkling",
  sparkling: true,
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
};

function renderBar() {
  render(
    <BatchActionsBar
      selectedWines={[wine]}
      cabinets={[]}
      allTags={[]}
      onClearSelection={onClearSelection}
      onBatchMove={onBatchMove}
      onBatchDelete={onBatchDelete}
      onBatchTag={onBatchTag}
      onBatchType={onBatchType}
    />
  );
}

/** Opens a bar dialog and clicks its footer submit. The footer submit shares
 * its name with the bar's ghost button (Move/Remove), but the dialog portals
 * to <body> after the bar, so the last match is the submit. */
function submitDialogAction(openName: string, submitName: string) {
  fireEvent.click(screen.getByRole("button", { name: openName }));
  const matches = screen.getAllByRole("button", { name: submitName });
  fireEvent.click(matches[matches.length - 1]);
}

/**
 * Regression: the four batch handlers were try/finally with no catch — a
 * failed batch action surfaced as an unhandled rejection while the spinner
 * just stopped. Each handler now toasts, and the dialog stays open with the
 * selection intact so the action button is its own retry (the add-buy-list
 * save-failure shape). Move/Tag/Type run 5 wines per server call and can
 * fail mid-run, so their copy says "couldn't finish"; Remove is one atomic
 * call.
 */
describe("BatchActionsBar failed actions", () => {
  beforeEach(() => {
    onClearSelection.mockClear();
    onBatchMove.mockReset();
    onBatchDelete.mockReset();
    toastMock.error.mockClear();
  });

  it("toasts and keeps the move dialog open when the batch move fails", async () => {
    onBatchMove.mockRejectedValue(new Error("network down"));
    renderBar();

    submitDialogAction("Move", "Move");

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        "Couldn't finish moving those wines — try again"
      );
    });
    expect(onClearSelection).not.toHaveBeenCalled();
    expect(screen.getByText("Move 1 Wines")).toBeInTheDocument();
  });

  it("toasts and keeps the remove dialog open when the batch remove fails", async () => {
    onBatchDelete.mockRejectedValue(new Error("network down"));
    renderBar();

    submitDialogAction("Remove", "Remove All");

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        "Couldn't remove those wines — try again"
      );
    });
    expect(onClearSelection).not.toHaveBeenCalled();
    expect(screen.getByText("Remove 1 Wines")).toBeInTheDocument();
  });

  it("closes and clears the selection when the batch move succeeds", async () => {
    onBatchMove.mockResolvedValue(undefined);
    renderBar();

    submitDialogAction("Move", "Move");

    await waitFor(() => {
      expect(screen.queryByText("Move 1 Wines")).not.toBeInTheDocument();
    });
    expect(onClearSelection).toHaveBeenCalledTimes(1);
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});
