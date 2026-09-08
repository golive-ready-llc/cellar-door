import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Stub the data layer — we don't want network calls during the lazy load
// effect that fires on first open. Hoist the wine fixture so vi.mock's
// factory can read it (vi.mock factories run before module-level vars).
const { wines } = vi.hoisted(() => ({
  wines: [
  {
    id: "w-1",
    userId: "u1",
    cabinetId: null,
    barcode: "",
    name: "Caymus Cabernet",
    winery: "Caymus",
    region: "Napa",
    country: "USA",
    vintage: 2019,
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
    depth: 0,
    zone: "",
    tastingNotes: null,
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    tags: [],
    addedAt: "",
    updatedAt: "",
  },
  {
    id: "w-2",
    userId: "u1",
    cabinetId: null,
    barcode: "",
    name: "Domaine Leroy Chambertin",
    winery: "Domaine Leroy",
    region: "Burgundy",
    country: "France",
    vintage: 2015,
    type: "red",
    sparkling: false,
    grapeVariety: "Pinot Noir",
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
    depth: 0,
    zone: "",
    tastingNotes: null,
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    tags: [],
    addedAt: "",
    updatedAt: "",
  },
  ],
}));

vi.mock("@/lib/data", () => ({
  fetchWines: vi.fn().mockResolvedValue(wines),
  fetchCabinets: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ userId: "u1" }),
}));

// Per-test mock state so we can flip "open" between tests without
// re-importing the module.
const searchState = { open: false, setOpen: vi.fn() };
vi.mock("@/components/search/search-provider", () => ({
  useSearch: () => ({
    open: searchState.open,
    setOpen: searchState.setOpen,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

import { SearchCommandPalette } from "@/components/search/search-command-palette";

describe("SearchCommandPalette", () => {
  it("is hidden by default (no input rendered when open=false)", () => {
    searchState.open = false;
    render(<SearchCommandPalette />);
    // Search input is only inside the dialog popup — closed = not present.
    expect(
      screen.queryByPlaceholderText(/search wines/i)
    ).not.toBeInTheDocument();
  });

  it("renders the search input when open=true", async () => {
    searchState.open = true;
    render(<SearchCommandPalette />);
    expect(
      await screen.findByPlaceholderText(/search wines/i)
    ).toBeInTheDocument();
  });

  it("filters wines by typed query (AND across tokens)", async () => {
    searchState.open = true;
    render(<SearchCommandPalette />);
    const input = (await screen.findByPlaceholderText(
      /search wines/i
    )) as HTMLInputElement;

    // Wait for the lazy fetch to settle so `loaded === true`.
    await waitFor(() => {
      expect(screen.getByText(/wines indexed/i)).toBeInTheDocument();
    });

    // Type a query that matches only Caymus.
    fireEvent.change(input, { target: { value: "caymus" } });

    await waitFor(() => {
      expect(screen.getByText("Caymus Cabernet")).toBeInTheDocument();
    });
    expect(screen.queryByText("Domaine Leroy Chambertin")).not.toBeInTheDocument();
  });
});
