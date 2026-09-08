import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Wine } from "@/types/wine";

// Same drag/drop/long-press hooks the slot pulls in — stub them so we
// don't need a DragDropProvider for a render-level test.
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

import { UnfiledWines } from "@/components/cellar/unfiled-wines";

function makeWine(overrides: Partial<Wine> = {}): Wine {
  return {
    id: "w-1",
    userId: "u1",
    cabinetId: null,
    barcode: "",
    name: "Unfiled Cab",
    winery: "Some Winery",
    region: "",
    country: "",
    vintage: 2019,
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
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    tags: [],
    addedAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("UnfiledWines", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses effective disposition on the unfiled tile (stored 'H' but window says drink-now → 'D')", () => {
    const wine = makeWine({
      id: "w-eff",
      disposition: "H",
      drinkWindow: "2023-2038",
    });
    render(<UnfiledWines wines={[wine]} onWineClick={vi.fn()} />);
    // Default = expanded, so the bottle is rendered.
    expect(screen.getByText("D")).toBeInTheDocument();
    // The stale 'H' must NOT show in the badge
    expect(screen.queryByText(/^H$/)).not.toBeInTheDocument();
  });

  it("clicking the header toggles expanded → collapsed (bottles disappear)", () => {
    const wine = makeWine({ id: "w-toggle", name: "Toggle Wine" });
    render(<UnfiledWines wines={[wine]} onWineClick={vi.fn()} />);

    // Initially expanded — the help text + bottle are visible.
    expect(
      screen.getByText(/these wines are not placed in any rack/i)
    ).toBeInTheDocument();

    // Click the header (the button with the chevron + label).
    const header = screen
      .getByText(/unfiled wines/i)
      .closest("button") as HTMLButtonElement;
    fireEvent.click(header);

    // Now collapsed — body text is gone.
    expect(
      screen.queryByText(/these wines are not placed in any rack/i)
    ).not.toBeInTheDocument();
  });

  it("clicking a bottle fires onWineClick with that wine", () => {
    const onWineClick = vi.fn();
    const wineA = makeWine({ id: "w-a", name: "Wine A" });
    const wineB = makeWine({ id: "w-b", name: "Wine B", type: "white" });
    render(<UnfiledWines wines={[wineA, wineB]} onWineClick={onWineClick} />);

    // Bottles are role=button with no accessible text (badge is purely
    // decorative). Find via the rendered elements list and click the first
    // wine bottle (skip the header + collapse button).
    const buttons = screen.getAllByRole("button");
    // buttons[0] = header chevron toggle; subsequent = bottles
    const bottleButtons = buttons.filter(
      (b) => !b.textContent?.match(/unfiled wines/i)
    );
    expect(bottleButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(bottleButtons[0]);
    expect(onWineClick).toHaveBeenCalledTimes(1);
    expect(onWineClick).toHaveBeenCalledWith(wineA);
  });

  it("returns null in non-edit mode when there are no unfiled wines", () => {
    const { container } = render(
      <UnfiledWines wines={[]} onWineClick={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});
