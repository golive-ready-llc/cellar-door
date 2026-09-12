import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { WineHistoryItem } from "@/types/wine";

const historyMock = vi.fn<() => Promise<WineHistoryItem[]>>();
const editHistoryItemMock = vi.fn(async () => ({ success: true }));
const removeHistoryItemMock = vi.fn(async () => ({ success: true }));
const communityScoreMock =
  vi.fn<
    (name: string, winery: string, vintage: number | null) => Promise<{
      cdScore: number;
      cdRatingCount: number;
    }>
  >(async () => ({ cdScore: 4.2, cdRatingCount: 4 }));

vi.mock("@/lib/data", () => ({
  fetchHistory: (...args: unknown[]) => historyMock(...(args as [])),
  editHistoryItem: (...args: unknown[]) => editHistoryItemMock(...(args as [])),
  removeHistoryItem: (...args: unknown[]) => removeHistoryItemMock(...(args as [])),
  fetchCommunityScore: (name: string, winery: string, vintage: number | null) =>
    communityScoreMock(name, winery, vintage),
}));
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ userId: "u1", user: null, devMode: false, tier: "PRO" }),
}));

import HistoryPage from "@/app/(app)/history/page";

function historyItem(partial: Partial<WineHistoryItem>): WineHistoryItem {
  return {
    id: "h-x",
    originalId: null,
    name: "Wine",
    winery: "Winery",
    vintage: 2019,
    type: "red",
    region: "Region",
    country: "Country",
    grapeVariety: "Grape",
    rating: null,
    consumeRating: null,
    consumeNotes: "",
    price: null,
    retailPrice: null,
    imageUrl: "",
    description: "",
    foodPairings: "",
    alcohol: "",
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    addedAt: null,
    removedAt: "2026-08-01T12:00:00.000Z",
    reason: "drank",
    ...partial,
  };
}

const ITEM_A = historyItem({ id: "h1", name: "Alpha", winery: "Alpha Winery", price: 30 });
const ITEM_B = historyItem({ id: "h2", name: "Beta", winery: "Beta Winery", price: 55 });

/**
 * Regression: the detail dialog keeps the edit form (and the community
 * score) in its own state and closing it does not unmount it — so opening
 * item B after item A left A's values in the form, and Save wrote them onto
 * B's history record. The dialog is now keyed by item id.
 */
describe("HistoryPage detail dialog", () => {
  beforeEach(() => {
    historyMock.mockReset();
    editHistoryItemMock.mockClear();
    editHistoryItemMock.mockResolvedValue({ success: true });
    communityScoreMock.mockReset();
    communityScoreMock.mockResolvedValue({ cdScore: 4.2, cdRatingCount: 4 });
  });

  async function openItem(name: string) {
    fireEvent.click(await screen.findByText(name));
  }

  it("saves the item the user opened, not the one opened first", async () => {
    historyMock.mockResolvedValue([ITEM_A, ITEM_B]);
    render(<HistoryPage />);

    await openItem("Alpha");
    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    expect(screen.getByPlaceholderText("Wine name")).toHaveValue("Alpha");
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    fireEvent.click(screen.getByRole("button", { name: /Close/ }));

    await openItem("Beta");
    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    expect(screen.getByPlaceholderText("Wine name")).toHaveValue("Beta");

    fireEvent.click(screen.getByRole("button", { name: /Save/ }));

    await waitFor(() => {
      expect(editHistoryItemMock).toHaveBeenCalledWith(
        "h2",
        expect.objectContaining({ name: "Beta", winery: "Beta Winery" }),
        "u1"
      );
    });
  });

  it("shows the community score of the item that is open", async () => {
    historyMock.mockResolvedValue([ITEM_A, ITEM_B]);
    communityScoreMock.mockImplementation(async (name: string) =>
      name === "Alpha"
        ? { cdScore: 4.2, cdRatingCount: 4 }
        : { cdScore: 3.1, cdRatingCount: 9 }
    );
    render(<HistoryPage />);

    await openItem("Alpha");
    expect(await screen.findByText("4.2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Close/ }));

    await openItem("Beta");
    // Without the per-item key the dialog kept Alpha's score for Beta and
    // never asked for Beta's.
    expect(await screen.findByText("3.1")).toBeInTheDocument();
    expect(screen.queryByText("4.2")).not.toBeInTheDocument();
  });
});
