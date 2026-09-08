import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { BuyListItem } from "@/types/wine";

vi.mock("@/hooks/use-tier", () => ({
  useTier: () => ({ userId: "u1", tier: "PRO", hasAI: true, can: () => true }),
}));
vi.mock("@/lib/data", () => ({
  submitCdRating: vi.fn(),
  fetchCommunityScore: vi.fn().mockResolvedValue({ cdScore: 4.4, cdRatingCount: 5 }),
  fetchCommunityRatings: vi.fn().mockResolvedValue([]),
}));

import { BuyListDetailDialog } from "@/components/wine/buy-list-detail-dialog";

const ITEM: BuyListItem = {
  id: "b1",
  userId: "u1",
  barcode: "",
  name: "Wishlist Wine",
  winery: "Wish Winery",
  region: "Rioja",
  country: "Spain",
  vintage: 2018,
  type: "red",
  sparkling: false,
  grapeVariety: "Tempranillo",
  imageUrl: "",
  retailPrice: 35,
  notes: "Recommended by a friend",
  description: "Oaky and bold.",
  foodPairings: "Chorizo",
  alcohol: "13.5%",
  disposition: "D",
  drinkWindow: "2024-2028",
  aiRatings: null,
  status: "wanted",
  orderDate: null,
  expectedDelivery: null,
  store: "",
  addedAt: "2026-05-01T12:00:00.000Z",
};

describe("BuyListDetailDialog (shared WineDetailBody)", () => {
  it("renders the unified spec sheet from the shared body", () => {
    render(
      <BuyListDetailDialog
        item={ITEM}
        open
        onOpenChange={() => {}}
        formatPrice={(n) => `$${n.toFixed(0)}`}
      />
    );
    // Name appears in the sr-only DialogTitle AND the body heading
    expect(screen.getAllByText("Wishlist Wine").length).toBeGreaterThan(0);
    expect(screen.getByText("Region")).toBeInTheDocument();
    expect(screen.getByText("Rioja")).toBeInTheDocument();
    expect(screen.getByText("Grape")).toBeInTheDocument();
    expect(screen.getByText("Drink Window")).toBeInTheDocument();
    expect(screen.getByText("Market Value")).toBeInTheDocument();
    expect(screen.getByText("Oaky and bold.")).toBeInTheDocument();
    expect(screen.getByText("Chorizo")).toBeInTheDocument();
    // Wishlist context: added date in headerExtra
    expect(screen.getByText(/Added/)).toBeInTheDocument();
  });

  it("wires contextual actions: Mark Purchased and Remove", () => {
    const onPurchase = vi.fn();
    const onRemove = vi.fn();
    render(
      <BuyListDetailDialog
        item={ITEM}
        open
        onOpenChange={() => {}}
        formatPrice={(n) => `$${n.toFixed(0)}`}
        onPurchase={onPurchase}
        onRemove={onRemove}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Mark Purchased/ }));
    expect(onPurchase).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /Remove/ }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("omits the action row entirely when no handlers are passed", () => {
    render(
      <BuyListDetailDialog
        item={ITEM}
        open
        onOpenChange={() => {}}
        formatPrice={(n) => `$${n.toFixed(0)}`}
      />
    );
    expect(screen.queryByRole("button", { name: /Mark Purchased/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
  });
});
