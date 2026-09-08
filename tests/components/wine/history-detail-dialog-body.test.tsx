import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { WineHistoryItem } from "@/types/wine";

vi.mock("@/hooks/use-tier", () => ({
  useTier: () => ({ userId: "u1", tier: "PRO", hasAI: true, can: () => true }),
}));
vi.mock("@/lib/data", () => ({
  submitCdRating: vi.fn(),
  fetchCommunityScore: vi.fn().mockResolvedValue(null),
  fetchCommunityRatings: vi.fn().mockResolvedValue([]),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { HistoryDetailDialog } from "@/components/wine/history-detail-dialog";

const ITEM: WineHistoryItem = {
  id: "h1",
  userId: "u1",
  wineId: "w1",
  barcode: "",
  name: "Drunk Wine",
  winery: "Past Winery",
  region: "Napa",
  country: "USA",
  vintage: 2015,
  type: "red",
  grapeVariety: "Cabernet Sauvignon",
  imageUrl: "",
  price: 60,
  retailPrice: 90,
  rating: 4,
  consumeRating: 4.5,
  consumeNotes: "Fantastic with steak",
  notes: "",
  description: "Classic Napa cab.",
  foodPairings: "Steak",
  alcohol: "14.8%",
  disposition: "D",
  drinkWindow: "2020-2027",
  aiRatings: null,
  tags: [],
  addedAt: "2025-01-01T00:00:00.000Z",
  removedAt: "2026-03-05T20:00:00.000Z",
  reason: "drank",
} as unknown as WineHistoryItem;

describe("HistoryDetailDialog (shared WineDetailBody)", () => {
  it("renders the unified read-only spec sheet with history context", () => {
    render(
      <HistoryDetailDialog
        item={ITEM}
        open
        onOpenChange={() => {}}
        formatPrice={(n) => `$${n.toFixed(0)}`}
      />
    );
    // Shared body fields (name appears in sr-only title + body heading)
    expect(screen.getAllByText("Drunk Wine").length).toBeGreaterThan(0);
    expect(screen.getByText("Region")).toBeInTheDocument();
    expect(screen.getByText("Napa")).toBeInTheDocument();
    expect(screen.getByText("Purchase Price")).toBeInTheDocument();
    expect(screen.getByText("Classic Napa cab.")).toBeInTheDocument();
    // History context: reason badge + removed date
    expect(screen.getByText("Drank")).toBeInTheDocument();
    expect(screen.getByText(/Removed March 5, 2026/)).toBeInTheDocument();
    // Final rating (consumeRating wins over rating)
    expect(screen.getByText("FINAL RATING", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
    // consumeNotes surface as tasting notes
    expect(screen.getByText(/Fantastic with steak/)).toBeInTheDocument();
  });

  it("shows contextual actions and toggles into the edit form", () => {
    const onUpdate = vi.fn().mockResolvedValue({ success: true });
    const onDelete = vi.fn();
    render(
      <HistoryDetailDialog
        item={ITEM}
        open
        onOpenChange={() => {}}
        formatPrice={(n) => `$${n.toFixed(0)}`}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    );
    // Consistent action row
    for (const label of ["Edit", "Enrich", "Share", "Delete"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
    // Edit → inline form replaces the read-only body
    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    expect(screen.getByPlaceholderText("Wine name")).toBeInTheDocument();
    expect(screen.getByText("Reason Removed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save/ })).toBeInTheDocument();
    // Cancel returns to read-only
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(screen.queryByPlaceholderText("Wine name")).not.toBeInTheDocument();
    expect(screen.getByText("Classic Napa cab.")).toBeInTheDocument();
  });

  it("hides Edit/Enrich when read-only (no onUpdate)", () => {
    render(
      <HistoryDetailDialog
        item={ITEM}
        open
        onOpenChange={() => {}}
        formatPrice={(n) => `$${n.toFixed(0)}`}
      />
    );
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Enrich/ })).not.toBeInTheDocument();
    // Share is always available
    expect(screen.getByRole("button", { name: /Share/ })).toBeInTheDocument();
  });
});
