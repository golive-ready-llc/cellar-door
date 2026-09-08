import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Wine } from "@/types/wine";

// Mock the AI server action
const aiTerroirTwins = vi.fn();
vi.mock("@/server/actions/ai", () => ({
  aiTerroirTwins: (...args: unknown[]) => aiTerroirTwins(...args),
}));

// Mock buy-list — the dialog imports it but our tests don't exercise the
// "Add to Buy List" path on the per-twin button.
vi.mock("@/server/actions/buy-list", () => ({
  addBuyListItem: vi.fn().mockResolvedValue(undefined),
}));

// Mock useTier — return an AI-enabled tier so the upgrade prompt
// doesn't replace the dialog body.
vi.mock("@/hooks/use-tier", () => ({
  useTier: () => ({
    hasAI: true,
    userId: "user-1",
    tierHasAI: true,
    aiUserEnabled: true,
  }),
}));

// Sonner toast — keep silent
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// UpgradePrompt is unused when hasAI is true, but the import path is
// still loaded — stub it to be safe.
vi.mock("@/components/tier/upgrade-prompt", () => ({
  UpgradePrompt: () => null,
}));

import { TerroirTwinDialog } from "@/components/wine/terroir-twin-dialog";

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

describe("TerroirTwinDialog", () => {
  beforeEach(() => {
    aiTerroirTwins.mockReset();
  });

  it("renders the source wine info and a 'Find Terroir Twins' button initially", () => {
    render(
      <TerroirTwinDialog
        open
        onOpenChange={vi.fn()}
        wine={makeWine()}
        cellarWines={[]}
      />
    );
    expect(screen.getAllByText(/Source Wine/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /Find Terroir Twins/i })
    ).toBeInTheDocument();
  });

  it("clicking 'Find Terroir Twins' calls aiTerroirTwins with the wine + cellar inputs", async () => {
    aiTerroirTwins.mockResolvedValue({
      success: true,
      data: { twins: [] },
    });
    const cellarWines = [makeWine({ id: "c1", name: "Cellar Wine 1" })];

    render(
      <TerroirTwinDialog
        open
        onOpenChange={vi.fn()}
        wine={makeWine()}
        cellarWines={cellarWines}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Find Terroir Twins/i }));

    await waitFor(() => expect(aiTerroirTwins).toHaveBeenCalledTimes(1));
    const [wineInput, userWines] = aiTerroirTwins.mock.calls[0];
    expect(wineInput).toMatchObject({ name: "Source Wine", winery: "Source Winery" });
    expect(userWines).toHaveLength(1);
    expect(userWines[0]).toMatchObject({ id: "c1", name: "Cellar Wine 1" });
  });

  it("renders matched twins after the AI call resolves", async () => {
    aiTerroirTwins.mockResolvedValue({
      success: true,
      data: {
        twins: [
          {
            name: "Twin Wine",
            winery: "Twin Winery",
            region: "Mendoza",
            country: "Argentina",
            grapeVariety: "Malbec",
            sharedTerroir: "High-altitude limestone soil",
            explanation: "Volcanic minerality echoes the Bordeaux gravel terroir.",
            inCellar: false,
          },
        ],
      },
    });

    render(
      <TerroirTwinDialog
        open
        onOpenChange={vi.fn()}
        wine={makeWine()}
        cellarWines={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Find Terroir Twins/i }));

    await waitFor(() => {
      expect(screen.getByText("Twin Wine")).toBeInTheDocument();
    });
    expect(screen.getByText("Twin Winery")).toBeInTheDocument();
    expect(screen.getByText(/High-altitude limestone soil/i)).toBeInTheDocument();
  });

  it("renders the empty state when AI returns zero twins", async () => {
    aiTerroirTwins.mockResolvedValue({
      success: true,
      data: { twins: [] },
    });

    render(
      <TerroirTwinDialog
        open
        onOpenChange={vi.fn()}
        wine={makeWine()}
        cellarWines={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Find Terroir Twins/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Could not find terroir twins/i)
      ).toBeInTheDocument();
    });
  });
});
