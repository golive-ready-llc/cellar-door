import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Wine, WineHistoryItem } from "@/types/wine";

const winesMock = vi.fn<() => Promise<Partial<Wine>[]>>(async () => []);
const historyMock = vi.fn<() => Promise<Partial<WineHistoryItem>[]>>(async () => []);

vi.mock("@/lib/data", () => ({
  // The page reads slim rating entries now; the fixtures below stay shaped as
  // wines/history rows and are converted here exactly the way the server
  // action does (consumeRating preferred, nulls for unrated).
  fetchTasteProfileEntries: async () => [
    ...(await winesMock()).map((w) => ({
      id: w.id ?? "",
      source: "cellar" as const,
      type: w.type ?? "red",
      region: w.region ?? "",
      country: w.country ?? "",
      grapeVariety: w.grapeVariety ?? "",
      rating: w.userRating ?? null,
    })),
    ...(await historyMock()).map((h) => ({
      id: h.id ?? "",
      source: "history" as const,
      type: h.type ?? "red",
      region: h.region ?? "",
      country: h.country ?? "",
      grapeVariety: h.grapeVariety ?? "",
      rating: (h.consumeRating ?? h.rating) ?? null,
    })),
  ],
}));
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ userId: "u1", user: null, tier: "PRO" }),
}));

import TasteProfilePage from "@/app/(app)/taste-profile/page";

function wine(over: Partial<Wine>): Partial<Wine> {
  return {
    id: Math.random().toString(36).slice(2),
    type: "red",
    region: "",
    country: "",
    grapeVariety: "",
    userRating: null,
    ...over,
  };
}

describe("TasteProfilePage aggregation", () => {
  it("shows the empty state when nothing is rated", async () => {
    winesMock.mockResolvedValueOnce([wine({ type: "red" })]);
    historyMock.mockResolvedValueOnce([]);
    render(<TasteProfilePage />);
    expect(await screen.findByText("Rate some wines first")).toBeInTheDocument();
  });

  it("buckets likes (avg ≥ 4, ≥ 2 rated) and most-explored by style", async () => {
    winesMock.mockResolvedValueOnce([
      wine({ type: "red", userRating: 4.5 }),
      wine({ type: "red", userRating: 4.5 }),
      wine({ type: "white", userRating: 3 }),
      wine({ type: "white", userRating: 3 }),
      wine({ type: "white" }),
    ]);
    historyMock.mockResolvedValueOnce([]);
    render(<TasteProfilePage />);
    // "What you like" contains Red (avg 4.5 over 2 rated). Buckets can appear
    // in both "likes" and "most explored", so assert presence, not uniqueness.
    expect(await screen.findByText("What you like")).toBeInTheDocument();
    expect(screen.getAllByText("Red").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4.5").length).toBeGreaterThan(0);
    // Most explored lists White (3 bottles) too
    expect(screen.getByText("Most explored")).toBeInTheDocument();
    expect(screen.getAllByText("White").length).toBeGreaterThan(0);
    expect(screen.getByText("3 bottles")).toBeInTheDocument();
  });

  it("splits multi-grape strings when the Grape dimension is selected", async () => {
    winesMock.mockResolvedValueOnce([
      wine({ grapeVariety: "Cabernet Sauvignon, Merlot", userRating: 4 }),
      wine({ grapeVariety: "Merlot", userRating: 5 }),
    ]);
    historyMock.mockResolvedValueOnce([]);
    render(<TasteProfilePage />);
    await screen.findByText("What you like");
    fireEvent.click(screen.getByRole("button", { name: "Grape" }));
    // Merlot has 2 rated entries (4 and 5 → avg 4.5) — appears in likes
    // (and again in most-explored, hence getAllByText).
    const merlot = await screen.findAllByText("Merlot");
    expect(merlot.length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cabernet Sauvignon").length).toBeGreaterThan(0);
  });

  it("counts history ratings (consumeRating preferred) toward the profile", async () => {
    winesMock.mockResolvedValueOnce([]);
    historyMock.mockResolvedValueOnce([
      { type: "rosé", region: "", country: "", grapeVariety: "", rating: 2, consumeRating: 5 },
      { type: "rosé", region: "", country: "", grapeVariety: "", rating: 4.5, consumeRating: null },
    ] as WineHistoryItem[]);
    render(<TasteProfilePage />);
    // avg of (5, 4.5) = 4.75 → rounds to 4.8 in the star display; likes shows Rosé
    expect(await screen.findByText("What you like")).toBeInTheDocument();
    expect(screen.getAllByText("Rosé").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4.8").length).toBeGreaterThan(0);
  });
});
