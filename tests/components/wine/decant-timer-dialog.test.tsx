import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { Wine } from "@/types/wine";

// Mock the AI server action — tests must not call out to the real
// Gemini provider.
const aiDecantRecommendation = vi.fn();
vi.mock("@/server/actions/ai", () => ({
  aiDecantRecommendation: (...args: unknown[]) => aiDecantRecommendation(...args),
}));

// Avoid shadcn toast pulling in Sonner during a render test.
vi.mock("@/components/ui/custom-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { DecantTimerDialog } from "@/components/wine/decant-timer-dialog";

function makeWine(overrides: Partial<Wine> = {}): Wine {
  return {
    id: "w-1",
    userId: "u1",
    cabinetId: null,
    barcode: "",
    name: "Decant Wine",
    winery: "Decant Winery",
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

describe("DecantTimerDialog", () => {
  beforeEach(() => {
    aiDecantRecommendation.mockReset();
    // The dialog now persists an active decant to localStorage so the timer
    // survives close / background. Isolate that state between tests.
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens with the AI-recommended decant minutes shown in the timer", async () => {
    aiDecantRecommendation.mockResolvedValue({
      success: true,
      data: {
        decantMinutes: 30,
        recommended: true,
        explanation: "Tannins need time to soften.",
      },
    });

    render(
      <DecantTimerDialog
        wine={makeWine()}
        open
        onOpenChange={vi.fn()}
      />
    );

    // Wait for the recommendation to land + initial timer display
    await waitFor(() => {
      expect(screen.getByText(/Decant for 30 minutes/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Tannins need time to soften/i)).toBeInTheDocument();
    // Initial display is "30:00" (countdown not started yet)
    expect(screen.getByText("30:00")).toBeInTheDocument();
  });

  it("counts down when Play is pressed (advance fake timers by 3 seconds)", async () => {
    aiDecantRecommendation.mockResolvedValue({
      success: true,
      data: { decantMinutes: 1, recommended: true, explanation: "ok" },
    });

    render(
      <DecantTimerDialog wine={makeWine()} open onOpenChange={vi.fn()} />
    );

    // Wait for recommendation to load
    await waitFor(() => expect(screen.getByText("1:00")).toBeInTheDocument());

    // Now switch to fake timers and press Play. Note: useFakeTimers
    // AFTER the async recommendation has settled — otherwise the
    // promise callbacks in the useEffect never run.
    vi.useFakeTimers();
    // The play button is the only large rounded button; first lucide
    // icon button after the ring. Find by SVG class is brittle, so just
    // grab all buttons and click the play one (lg + rounded-full).
    const playBtn = document.querySelector("button.rounded-full.w-14.h-14") as HTMLElement;
    expect(playBtn).toBeTruthy();
    fireEvent.click(playBtn);

    // Advance 3 seconds → "0:57"
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("0:57")).toBeInTheDocument();
  });

  it("Reset returns the timer to the full duration", async () => {
    aiDecantRecommendation.mockResolvedValue({
      success: true,
      data: { decantMinutes: 2, recommended: true, explanation: "ok" },
    });

    render(
      <DecantTimerDialog wine={makeWine()} open onOpenChange={vi.fn()} />
    );

    await waitFor(() => expect(screen.getByText("2:00")).toBeInTheDocument());

    vi.useFakeTimers();
    const playBtn = document.querySelector("button.rounded-full.w-14.h-14") as HTMLElement;
    fireEvent.click(playBtn);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("1:55")).toBeInTheDocument();

    // Reset is the icon button with RotateCcw — find by aria-less lookup
    // via the SVG class. There's exactly one rotate-ccw icon while running.
    const resetBtn = document
      .querySelector("svg.lucide-rotate-ccw")
      ?.closest("button") as HTMLElement;
    expect(resetBtn).toBeTruthy();
    fireEvent.click(resetBtn);

    // Should be back to 2:00 and idle
    expect(screen.getByText("2:00")).toBeInTheDocument();
  });

  it("invokes onOpenChange(false) when the Skip button is clicked", async () => {
    aiDecantRecommendation.mockResolvedValue({
      success: true,
      data: { decantMinutes: 30, recommended: true, explanation: "ok" },
    });
    const onOpenChange = vi.fn();

    render(
      <DecantTimerDialog wine={makeWine()} open onOpenChange={onOpenChange} />
    );

    await waitFor(() =>
      expect(screen.getByText(/Decant for 30 minutes/i)).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /^Skip$/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
