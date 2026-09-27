import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { BuyListItem } from "@/types/wine";

const buyListMock = vi.fn<() => Promise<BuyListItem[]>>();
const createWineMock = vi.fn(async () => ({ success: true }));
const communityScoreMock =
  vi.fn<
    (name: string, winery: string, vintage: number | null) => Promise<{
      cdScore: number;
      cdRatingCount: number;
    }>
  >(async () => ({ cdScore: 4.2, cdRatingCount: 4 }));

vi.mock("@/lib/data", () => ({
  fetchBuyList: (...args: unknown[]) => buyListMock(...(args as [])),
  fetchCabinets: async () => [],
  addBuyListItem: async () => ({ success: true }),
  removeBuyListItem: async () => ({ success: true }),
  createWine: (...args: unknown[]) => createWineMock(...(args as [])),
  fetchCommunityScore: (name: string, winery: string, vintage: number | null) =>
    communityScoreMock(name, winery, vintage),
}));
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ userId: "u1", user: null, devMode: false, tier: "PRO" }),
}));

// The toast viewport lives in the app layout, not the page — spy on the
// calls instead of asserting rendered DOM.
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  default: vi.fn(),
}));
vi.mock("@/components/ui/custom-toast", () => ({ toast: toastMock }));

import BuyListPage from "@/app/(app)/buy-list/page";

function buyListItem(partial: Partial<BuyListItem>): BuyListItem {
  return {
    id: "b-x",
    userId: "u1",
    barcode: "",
    name: "Wine",
    winery: "Winery",
    region: "Region",
    country: "Country",
    vintage: 2019,
    type: "red",
    sparkling: false,
    grapeVariety: "Grape",
    imageUrl: "",
    retailPrice: 40,
    notes: "",
    description: "",
    foodPairings: "",
    alcohol: "",
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    status: "wanted",
    orderDate: null,
    expectedDelivery: null,
    store: "",
    addedAt: "2026-08-01T12:00:00.000Z",
    ...partial,
  };
}

const ITEM_A = buyListItem({ id: "b1", name: "Alpha", winery: "Alpha Winery" });
const ITEM_B = buyListItem({ id: "b2", name: "Beta", winery: "Beta Winery" });

/**
 * Regression: the wishlist detail dialog caches the community score in its
 * own state and closing it does not unmount it, so opening item B after item
 * A showed A's score (and never fetched B's). The dialog is now keyed by
 * item id.
 */
describe("BuyListPage detail dialog", () => {
  beforeEach(() => {
    buyListMock.mockReset();
    createWineMock.mockReset();
    createWineMock.mockResolvedValue({ success: true });
    toastMock.error.mockClear();
    communityScoreMock.mockReset();
    communityScoreMock.mockImplementation(async (name: string) =>
      name === "Alpha"
        ? { cdScore: 4.2, cdRatingCount: 4 }
        : { cdScore: 3.1, cdRatingCount: 9 }
    );
  });

  it("shows the community score of the item that is open", async () => {
    buyListMock.mockResolvedValue([ITEM_A, ITEM_B]);
    render(<BuyListPage />);

    fireEvent.click(await screen.findByText("Alpha"));
    expect(await screen.findByText("4.2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Close/ }));

    fireEvent.click(screen.getByText("Beta"));
    expect(await screen.findByText("3.1")).toBeInTheDocument();
    expect(screen.queryByText("4.2")).not.toBeInTheDocument();
  });

  it("Mark Purchased adds the wine even when an identical one is already in the cellar, and removes the item", async () => {
    buyListMock.mockResolvedValue([ITEM_A]);
    render(<BuyListPage />);

    fireEvent.click(await screen.findByText("Alpha"));
    fireEvent.click(await screen.findByRole("button", { name: /Mark Purchased/ }));

    // Buying another bottle of a wine you already own is the normal wishlist
    // case: the create must carry skipDuplicateCheck so the duplicate
    // sentinel can't escape as an uncaught error that silently no-ops the
    // button (and kills the rest of a batch purchase).
    await waitFor(() => {
      expect(createWineMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Alpha", skipDuplicateCheck: true }),
        "u1"
      );
    });
    await waitFor(() => {
      expect(screen.queryByText("Alpha")).toBeNull();
    });
  });

  it("toasts instead of silently no-opping when the cellar add fails", async () => {
    buyListMock.mockResolvedValue([ITEM_A]);
    createWineMock.mockRejectedValue(new Error("network down"));
    render(<BuyListPage />);

    fireEvent.click(await screen.findByText("Alpha"));
    fireEvent.click(await screen.findByRole("button", { name: /Mark Purchased/ }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        expect.stringContaining("Couldn't add Alpha")
      );
    });
    // The item stays — it was not purchased.
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
  });
});
