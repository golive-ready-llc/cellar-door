import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Wine } from "@/types/wine";

// ─── Mock hooks/contexts that the dialog reaches into ─────────────
vi.mock("@/contexts/wine-data-context", () => ({
  useWineData: () => ({
    wines: [],
    cabinets: [],
    walls: [],
    allTags: [],
    showInCellar: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-tier", () => ({
  useTier: () => ({
    userId: "u1",
    tier: "PRO",
    isLoading: false,
    canUseAi: true,
    hasAI: true,
    can: () => true,
    hasApiAccess: false,
    showAds: false,
  }),
}));

vi.mock("@/hooks/use-ai-toggle", () => ({
  useAiToggle: () => ({
    aiUserEnabled: false,
    setAiUserEnabled: vi.fn(),
  }),
}));

vi.mock("@/server/actions/ai", () => ({
  aiEnrichWine: vi.fn(),
  aiFetchWineImage: vi.fn(),
  aiDecantRecommendation: vi.fn(),
  aiVintageStory: vi.fn(),
  aiTerroirTwins: vi.fn(),
}));

vi.mock("@/server/actions/buy-list", () => ({
  addBuyListItem: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  submitCdRating: vi.fn(),
  fetchCommunityScore: vi.fn().mockResolvedValue(null),
  fetchCommunityRatings: vi.fn().mockResolvedValue([]),
}));

// next/navigation isn't reached (no router push during render here),
// but the dialog imports @/contexts/wine-data-context's provider via
// ../detail children chain — keep this safe.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

import { WineDetailDialog } from "@/components/wine/wine-detail-dialog";

function makeWine(overrides: Partial<Wine>): Wine {
  return {
    id: "w-1",
    userId: "u1",
    cabinetId: null,
    barcode: "",
    name: "Mock Châteauneuf",
    winery: "Domaine Test",
    region: "Rhône",
    country: "France",
    vintage: 2018,
    type: "red",
    sparkling: false,
    grapeVariety: "Grenache",
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
    disposition: "H", // stored disposition is Hold
    drinkWindow: "2023-2038", // but window says drink-now (2026)
    aiRatings: null,
    tags: [],
    addedAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("WineDetailDialog — effective disposition badge", () => {
  it("shows 'Drink Now' (NOT 'Hold') when stored disposition is 'H' but drinkWindow puts the wine in its drinking range today", () => {
    // Pin the year so we don't depend on real wall-clock
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T12:00:00Z"));

    const wine = makeWine({ disposition: "H", drinkWindow: "2023-2038" });
    render(
      <WineDetailDialog
        wine={wine}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    // The effective-disposition badge should read "Drink Now"
    expect(screen.getByText("Drink Now")).toBeInTheDocument();
    // The stale stored "Hold" disposition should NOT appear as a badge
    // (the badge derives from getEffectiveDisposition, not wine.disposition)
    expect(screen.queryByText("Hold")).not.toBeInTheDocument();
    // And the raw drinkWindow string is shown alongside.
    expect(screen.getByText("2023-2038")).toBeInTheDocument();

    vi.useRealTimers();
  });
});
