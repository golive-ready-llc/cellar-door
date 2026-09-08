import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// CdScoreInline lives in community-score, which imports the data layer.
vi.mock("@/lib/data", () => ({
  submitCdRating: vi.fn(),
  fetchCommunityScore: vi.fn().mockResolvedValue(null),
  fetchCommunityRatings: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/hooks/use-tier", () => ({
  useTier: () => ({ userId: "u1", tier: "PRO", hasAI: true, can: () => true }),
}));

import { WineDetailBody } from "@/components/wine/wine-detail-body";

const FULL = {
  name: "Château Test",
  winery: "Domaine Spec",
  vintage: 2019,
  type: "red",
  imageUrl: "",
  region: "Rhône",
  country: "France",
  grapeVariety: "Syrah",
  alcohol: "14%",
  drinkWindow: "2024-2030",
  drinkBy: "2030",
  price: 25,
  retailPrice: 40,
  purchaseDate: "2026-01-15",
  barcode: "123456",
  description: "A spec-sheet wine.",
  foodPairings: "Lamb",
  tastingNotes: "Peppery.",
  notes: "Bought on vacation.",
  disposition: "D",
  sparkling: false,
  tags: ["favorite"],
  aiRatings: { rating_ws: 92 },
  cdScore: 4.2,
  cdRatingCount: 3,
};

describe("WineDetailBody", () => {
  it("renders every populated field as a complete spec sheet", () => {
    render(<WineDetailBody data={FULL} />);
    // Title block
    expect(screen.getByText("Château Test")).toBeInTheDocument();
    expect(screen.getByText(/Domaine Spec · 2019/)).toBeInTheDocument();
    // Spec grid labels + values
    for (const [label, value] of [
      ["Region", "Rhône"],
      ["Country", "France"],
      ["Grape", "Syrah"],
      ["ABV", "14%"],
      ["Drink Window", "2024-2030"],
      ["Drink By", "2030"],
      ["Purchase Price", "$25.00"],
      ["Market Value", "$40.00"],
      ["Purchased", "2026-01-15"],
      ["Barcode", "123456"],
    ] as const) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    // Sections
    expect(screen.getByText("A spec-sheet wine.")).toBeInTheDocument();
    expect(screen.getByText("Lamb")).toBeInTheDocument();
    expect(screen.getByText("Peppery.")).toBeInTheDocument();
    expect(screen.getByText("Bought on vacation.")).toBeInTheDocument();
    // AI critic scores
    expect(screen.getByText(/AI-Estimated Critic Scores/)).toBeInTheDocument();
    // Community score badge shows (ratingCount > 0)
    expect(screen.getByText("4.2")).toBeInTheDocument();
  });

  it("hides empty fields and sections", () => {
    render(
      <WineDetailBody
        data={{ name: "Bare Wine", type: "white", cdScore: null, cdRatingCount: 0 }}
      />
    );
    for (const label of ["Region", "Grape", "ABV", "Drink Window", "Purchase Price", "Barcode"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/Food Pairings/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tasting Notes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Critic Scores/)).not.toBeInTheDocument();
    // CD score placeholder, not a number
    expect(screen.getByText("–")).toBeInTheDocument();
  });

  it("renders contextual slots: actions, ratingSlot, headerExtra, children", () => {
    const onAction = vi.fn();
    render(
      <WineDetailBody
        data={{ name: "Slotted", type: "red" }}
        actions={<button onClick={onAction}>Context Action</button>}
        ratingSlot={<span>RATING-SLOT</span>}
        headerExtra={<span>HEADER-EXTRA</span>}
      >
        <div>EXTRA-SECTION</div>
      </WineDetailBody>
    );
    expect(screen.getByText("RATING-SLOT")).toBeInTheDocument();
    expect(screen.getByText("HEADER-EXTRA")).toBeInTheDocument();
    expect(screen.getByText("EXTRA-SECTION")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Context Action"));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("normalizes capitalized types for badge label", () => {
    render(<WineDetailBody data={{ name: "CapType", type: "White" }} />);
    expect(screen.getByText("White")).toBeInTheDocument();
  });
});
