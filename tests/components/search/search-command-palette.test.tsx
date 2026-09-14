import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Stub the data layer — we don't want network calls during the lazy load
// effect that fires on first open. Hoist the wine fixture so vi.mock's
// factory can read it (vi.mock factories run before module-level vars).
const { wines } = vi.hoisted(() => {
  const makeWine = (id: string, name: string, winery: string, grapeVariety: string) => ({
    id,
    userId: "u1",
    cabinetId: null,
    barcode: "",
    name,
    winery,
    region: "",
    country: "",
    vintage: 2020,
    type: "red",
    sparkling: false,
    grapeVariety,
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
  });
  return {
    wines: [
      makeWine("w-1", "Caymus Cabernet", "Caymus", "Cabernet Sauvignon"),
      makeWine("w-2", "Domaine Leroy Chambertin", "Domaine Leroy", "Pinot Noir"),
      ...Array.from({ length: 4 }, (_, i) =>
        makeWine(`w-bulk-${i}`, `Bulk Bin Red ${i}`, "Bulk Winery", "Merlot")
      ),
    ],
  };
});

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

  it("keeps the highlight inside the results when typing shrinks the list", async () => {
    searchState.open = true;
    render(<SearchCommandPalette />);
    const input = (await screen.findByPlaceholderText(
      /search wines/i
    )) as HTMLInputElement;
    await waitFor(() => {
      expect(screen.getByText(/wines indexed/i)).toBeInTheDocument();
    });

    // Four "Bulk Bin Red" matches; walk the highlight down to the last row.
    fireEvent.change(input, { target: { value: "bulk bin red" } });
    await waitFor(() => {
      expect(screen.getByText("Bulk Bin Red 0")).toBeInTheDocument();
    });
    for (let i = 0; i < 3; i++) {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    }

    // Narrow to one match. During that render the list is already short but
    // the highlight index still points at row 3 — the palette must not read
    // past the end of the new results.
    fireEvent.change(input, { target: { value: "bulk bin red 1" } });

    expect(await screen.findByText("Bulk Bin Red 1")).toBeInTheDocument();
    expect(screen.queryByText("Bulk Bin Red 0")).not.toBeInTheDocument();
  });
});
