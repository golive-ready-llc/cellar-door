import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Wine } from "@/types/wine";

const aiPourCostCalculation = vi.fn();
vi.mock("@/server/actions/ai", () => ({
  aiPourCostCalculation: (...args: unknown[]) => aiPourCostCalculation(...args),
}));

vi.mock("@/hooks/use-tier", () => ({
  useTier: () => ({
    hasAI: true,
    userId: "user-1",
    tier: "PREMIUM",
  }),
}));

vi.mock("@/components/tier/upgrade-prompt", () => ({
  UpgradePrompt: () => null,
}));

import { PourCostDialog } from "@/components/wine/pour-cost-dialog";

function makeWine(overrides: Partial<Wine> = {}): Wine {
  return {
    id: "w-1",
    userId: "u1",
    cabinetId: null,
    barcode: "",
    name: "Source Wine",
    winery: "Source Winery",
    region: "Bordeaux",
    country: "France",
    vintage: 2018,
    type: "red",
    sparkling: false,
    grapeVariety: "Cabernet Sauvignon",
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
    depth: 1,
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

const RESULT = {
  courses: [
    {
      courseName: "Aperitif",
      wines: [
        {
          wineId: "w-1",
          wineName: "Source Wine",
          winery: "Source Winery",
          vintage: 2018,
          bottlesNeeded: 2,
          poursPerBottle: 5,
          reason: "Crowd-pleasing opener",
        },
      ],
    },
  ],
  totalBottles: 2,
  estimatedCost: 60,
  perGuestCost: 6,
  shoppingList: [],
};

describe("PourCostDialog", () => {
  beforeEach(() => {
    aiPourCostCalculation.mockReset();
  });

  it("renders the plan after the AI call resolves", async () => {
    aiPourCostCalculation.mockResolvedValue({ success: true, data: RESULT });

    render(
      <PourCostDialog open onOpenChange={vi.fn()} wines={[makeWine()]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Plan Wine Tasting/i }));

    await waitFor(() => {
      expect(screen.getByText("Aperitif")).toBeInTheDocument();
    });
    expect(screen.getByText(/\$60/)).toBeInTheDocument();
  });

  it("surfaces a failed AI call as an error banner instead of silently resetting the form", async () => {
    aiPourCostCalculation.mockResolvedValue({
      success: false,
      error: "AI service is busy or rate-limited. Please wait a moment and try again.",
    });

    render(
      <PourCostDialog open onOpenChange={vi.fn()} wines={[makeWine()]} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Plan Wine Tasting/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/AI service is busy or rate-limited/i)
      ).toBeInTheDocument();
    });
    // The form stays up so the button itself is the retry.
    expect(
      screen.getByRole("button", { name: /Plan Wine Tasting/i })
    ).toBeInTheDocument();
  });
});
