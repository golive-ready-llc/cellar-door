import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Wine, WineHistoryItem } from "@/types/wine";

const winesMock = vi.fn<() => Promise<Partial<Wine>[]>>(async () => []);
const historyMock = vi.fn<() => Promise<Partial<WineHistoryItem>[]>>(async () => []);

vi.mock("@/lib/data", () => ({
  fetchWines: (...args: unknown[]) => winesMock(...(args as [])),
  fetchHistory: (...args: unknown[]) => historyMock(...(args as [])),
}));
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ userId: "u1", user: null, tier: "PRO" }),
}));
// Stub the heavy detail dialog — we assert the page passes the right wine.
vi.mock("@/components/wine/wine-detail-dialog", () => ({
  WineDetailDialog: ({ wine, open }: { wine: { name: string }; open: boolean }) =>
    open ? <div data-testid="detail-stub">{wine.name}</div> : null,
}));

import ActivityPage from "@/app/(app)/activity/page";

const NOW = Date.now();

function wine(over: Partial<Wine>): Partial<Wine> {
  return {
    id: Math.random().toString(36).slice(2),
    name: "W",
    winery: "Wy",
    vintage: 2020,
    type: "red",
    imageUrl: "",
    userRating: null,
    addedAt: new Date(NOW - 60_000).toISOString(),
    ...over,
  };
}

describe("ActivityPage feed", () => {
  it("shows the empty state when there are no events", async () => {
    winesMock.mockResolvedValueOnce([]);
    historyMock.mockResolvedValueOnce([]);
    render(<ActivityPage />);
    expect(await screen.findByText("No activity yet")).toBeInTheDocument();
  });

  it("merges added + removed events newest-first with the right verbs", async () => {
    winesMock.mockResolvedValueOnce([
      wine({ name: "Newest Added", addedAt: new Date(NOW - 1_000).toISOString() }),
      wine({ name: "Old Added", addedAt: new Date(NOW - 3_600_000).toISOString() }),
    ]);
    historyMock.mockResolvedValueOnce([
      {
        id: "h1",
        name: "Tasted Wine",
        winery: "Hist Winery",
        vintage: 2019,
        type: "red",
        imageUrl: "",
        rating: 4,
        consumeRating: 4.5,
        consumeNotes: "Lovely",
        removedAt: new Date(NOW - 120_000).toISOString(),
        reason: "drank",
      },
    ] as WineHistoryItem[]);
    render(<ActivityPage />);

    expect(await screen.findByText("Newest Added")).toBeInTheDocument();
    expect(screen.getByText("Tasted Wine")).toBeInTheDocument();
    expect(screen.getAllByText("Added").length).toBe(2);
    expect(screen.getByText("Tasted")).toBeInTheDocument();
    // Ordering: Newest Added (1s) → Tasted Wine (2m) → Old Added (1h)
    const cards = screen.getAllByRole("button");
    const names = cards.map((c) => c.textContent);
    const idxNew = names.findIndex((t) => t?.includes("Newest Added"));
    const idxTasted = names.findIndex((t) => t?.includes("Tasted Wine"));
    const idxOld = names.findIndex((t) => t?.includes("Old Added"));
    expect(idxNew).toBeLessThan(idxTasted);
    expect(idxTasted).toBeLessThan(idxOld);
    // consumeRating shown for the tasted event
    expect(screen.getByText("4.5")).toBeInTheDocument();
  });

  it("opens the wine detail when an event is tapped", async () => {
    winesMock.mockResolvedValueOnce([wine({ name: "Tap Me" })]);
    historyMock.mockResolvedValueOnce([]);
    render(<ActivityPage />);
    fireEvent.click(await screen.findByText("Tap Me"));
    expect(screen.getByTestId("detail-stub")).toHaveTextContent("Tap Me");
  });

  it("skips records with unparseable timestamps instead of crashing", async () => {
    winesMock.mockResolvedValueOnce([wine({ name: "Good" }), wine({ name: "Bad", addedAt: "not-a-date" })]);
    historyMock.mockResolvedValueOnce([]);
    render(<ActivityPage />);
    expect(await screen.findByText("Good")).toBeInTheDocument();
    expect(screen.queryByText("Bad")).not.toBeInTheDocument();
  });
});
