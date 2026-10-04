import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Wine } from "@/types/wine";

const aiMealPairing = vi.fn();
vi.mock("@/server/actions/ai", () => ({
  aiMealPairing: (...args: unknown[]) => aiMealPairing(...args),
}));

vi.mock("@/hooks/use-tier", () => ({
  useTier: () => ({
    hasAI: true,
    userId: "user-1",
  }),
}));

vi.mock("@/components/tier/upgrade-prompt", () => ({
  UpgradePrompt: () => null,
}));

import { CorkAndForkDialog } from "@/components/wine/cork-and-fork-dialog";

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

describe("CorkAndForkDialog", () => {
  beforeEach(() => {
    aiMealPairing.mockReset();
  });

  it("renders matches after the AI call resolves", async () => {
    aiMealPairing.mockResolvedValue({
      success: true,
      data: {
        matches: [
          {
            wineId: "w-1",
            wineName: "Source Wine",
            winery: "Source Winery",
            vintage: 2018,
            confidence: "perfect",
            pairingExplanation: "Cabernet tannin stands up to the char.",
          },
        ],
        buySuggestions: [],
      },
    });

    render(
      <CorkAndForkDialog open onOpenChange={vi.fn()} wines={[makeWine()]} />
    );

    fireEvent.change(screen.getByPlaceholderText(/What are you eating/i), {
      target: { value: "Steak and potatoes" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Find My Wine/i }));

    await waitFor(() => {
      expect(screen.getByText("Perfect Match")).toBeInTheDocument();
    });
  });

  it("surfaces a failed AI call as an error banner instead of silently resetting the form", async () => {
    aiMealPairing.mockResolvedValue({
      success: false,
      error: "AI provider authentication failed (401). Check your API key is valid.",
    });

    render(
      <CorkAndForkDialog open onOpenChange={vi.fn()} wines={[makeWine()]} />
    );

    fireEvent.change(screen.getByPlaceholderText(/What are you eating/i), {
      target: { value: "Pizza night" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Find My Wine/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/AI provider authentication failed/i)
      ).toBeInTheDocument();
    });
    // The search row stays up so the button itself is the retry.
    expect(
      screen.getByRole("button", { name: /Find My Wine/i })
    ).toBeInTheDocument();
  });
});
