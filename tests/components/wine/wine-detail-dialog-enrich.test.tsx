import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Wine, AiRatings } from "@/types/wine";

// Mock the AI server actions — tests must not call out to real providers.
const aiEnrichWine = vi.fn();
const aiFetchWineImage = vi.fn();
vi.mock("@/server/actions/ai", () => ({
  aiEnrichWine: (...args: unknown[]) => aiEnrichWine(...args),
  aiFetchWineImage: (...args: unknown[]) => aiFetchWineImage(...args),
  aiDecantRecommendation: vi.fn(),
  aiVintageStory: vi.fn(),
  aiTerroirTwins: vi.fn(),
}));

vi.mock("@/server/actions/buy-list", () => ({
  addBuyListItem: vi.fn(),
}));

vi.mock("@/components/ui/custom-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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
    aiUserEnabled: true,
    setAiUserEnabled: vi.fn(),
  }),
}));

vi.mock("@/contexts/wine-data-context", () => ({
  useWineData: () => ({
    wines: [],
    cabinets: [],
    walls: [],
    allTags: [],
    showInCellar: vi.fn(),
  }),
}));

vi.mock("@/lib/data", () => ({
  submitCdRating: vi.fn(),
  fetchCommunityScore: vi.fn().mockResolvedValue(null),
  fetchCommunityRatings: vi.fn().mockResolvedValue([]),
}));

import { toast } from "@/components/ui/custom-toast";
import { WineDetailDialog } from "@/components/wine/wine-detail-dialog";

function makeWine(overrides: Partial<Wine> = {}): Wine {
  return {
    id: "w-1",
    userId: "u1",
    cabinetId: null,
    barcode: "",
    name: "Merge Wine",
    winery: "Merge Winery",
    region: "",
    country: "",
    vintage: 2018,
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

const EXISTING_RATINGS: AiRatings = { rating_ws: 88 };
const FRESH_RATINGS: AiRatings = { rating_ws: 95, rating_rp: 93 };

function enrichmentPayload(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    isMock: false,
    data: {
      description: "AI description",
      foodPairings: "AI pairings",
      pairingNotes: "",
      estimatedPrice: 55,
      priceRange: { low: 40, high: 70 },
      disposition: "D",
      drinkBy: "2027",
      drinkWindow: "2025-2030",
      ratings: FRESH_RATINGS,
      confidence: "high",
      ...overrides,
    },
  };
}

function renderDialog(wine: Wine, onUpdate: (updates: Partial<Wine>) => void) {
  render(
    <WineDetailDialog
      wine={wine}
      open
      onOpenChange={vi.fn()}
      onUpdate={onUpdate}
    />
  );
}

async function clickEnrich() {
  fireEvent.click(await screen.findByRole("button", { name: /enrich/i }));
}

describe("WineDetailDialog — AI enrichment merge", () => {
  beforeEach(() => {
    aiEnrichWine.mockReset();
    aiFetchWineImage.mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("fills only empty fields, refreshes aiRatings even when present, and stamps aiEnrichedAt", async () => {
    aiEnrichWine.mockResolvedValue(enrichmentPayload());
    const onUpdate = vi.fn<(updates: Partial<Wine>) => void>();
    renderDialog(
      makeWine({
        description: "My own notes", // user-entered — must survive
        aiRatings: EXISTING_RATINGS, // single-wine enrich refreshes these
        imageUrl: "https://example.com/label.png", // skips image backfill
      }),
      onUpdate
    );

    await clickEnrich();

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const updates = onUpdate.mock.calls[0][0] as Record<string, unknown>;

    // Non-overwriting merge (shared buildWineUpdates contract)
    expect(updates.description).toBeUndefined();
    expect(updates.foodPairings).toBe("AI pairings");
    expect(updates.retailPrice).toBe(55);
    expect(updates.disposition).toBe("D");
    expect(updates.drinkBy).toBe("2027");
    expect(updates.drinkWindow).toBe("2025-2030");

    // Deliberate divergence from bulk enrichment: the estimate is refreshed
    expect(updates.aiRatings).toEqual(FRESH_RATINGS);

    // Timestamp stamped so bulk-enrich skips this wine later
    expect(updates.aiEnrichedAt).toEqual(expect.any(String));

    // Wine already had an image — no backfill, no imageUrl key
    expect(updates.imageUrl).toBeUndefined();
    expect(aiFetchWineImage).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Wine enriched with AI data");
  });

  it("backfills a found label image (http or data URL only)", async () => {
    aiEnrichWine.mockResolvedValue(enrichmentPayload());
    aiFetchWineImage.mockResolvedValue({
      success: true,
      data: { imageUrl: "https://example.com/found.png", source: "google" },
    });
    const onUpdate = vi.fn<(updates: Partial<Wine>) => void>();
    renderDialog(makeWine({ imageUrl: "" }), onUpdate);

    await clickEnrich();

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const updates = onUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updates.imageUrl).toBe("https://example.com/found.png");
  });

  it("rejects a label image URL that is neither http nor data (silently — backfill is best-effort)", async () => {
    aiEnrichWine.mockResolvedValue(enrichmentPayload());
    aiFetchWineImage.mockResolvedValue({
      success: true,
      data: { imageUrl: "javascript:alert(1)", source: "google" },
    });
    const onUpdate = vi.fn<(updates: Partial<Wine>) => void>();
    renderDialog(makeWine({ imageUrl: "" }), onUpdate);

    await clickEnrich();

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const updates = onUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updates.imageUrl).toBeUndefined();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it("maps quota errors to the friendly message and applies nothing", async () => {
    aiEnrichWine.mockResolvedValue({
      success: false,
      error: "429 RESOURCE_EXHAUSTED: quota exceeded",
    });
    const onUpdate = vi.fn<(updates: Partial<Wine>) => void>();
    renderDialog(makeWine(), onUpdate);

    await clickEnrich();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "AI service quota exceeded — please try again later"
      )
    );
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
