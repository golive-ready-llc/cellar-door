import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  WineListResults,
  WineListResultsFooter,
  fuzzyMatch,
  type UserWineForScan,
} from "@/components/wine/wine-list-results";
import type { WineIdentification } from "@/lib/ai/types";

function makeExtracted(overrides: Partial<WineIdentification> = {}): WineIdentification {
  return {
    name: "Sample Wine",
    winery: "Sample Winery",
    vintage: 2020,
    type: "red",
    region: "Bordeaux",
    country: "France",
    grapeVariety: "Cabernet Sauvignon",
    description: "",
    estimatedPrice: null,
    alcohol: "",
    disposition: "",
    drinkBy: "",
    drinkWindow: "",
    ratings: null,
    ...overrides,
  };
}

function makeUserWine(overrides: Partial<UserWineForScan> = {}): UserWineForScan {
  return {
    id: "uw-1",
    name: "Sample Wine",
    winery: "Sample Winery",
    vintage: 2020,
    type: "red",
    region: "Bordeaux",
    grapeVariety: "Cabernet Sauvignon",
    disposition: "",
    drinkWindow: "",
    userRating: null,
    aiRatings: null,
    cdScore: null,
    ...overrides,
  };
}

describe("WineListResults", () => {
  it("renders all extracted wines with their names and wineries", () => {
    const extracted = [
      makeExtracted({ name: "Wine A", winery: "Winery A" }),
      makeExtracted({ name: "Wine B", winery: "Winery B" }),
    ];
    render(
      <WineListResults
        extractedWines={extracted}
        sourceName="Test Bistro"
        userWines={[]}
        addedWines={new Set()}
      />
    );
    expect(screen.getByText("Wine A")).toBeInTheDocument();
    expect(screen.getByText("Wine B")).toBeInTheDocument();
    expect(screen.getByText("Test Bistro")).toBeInTheDocument();
  });

  it("renders an 'In your cellar!' badge when name and winery match a user wine", () => {
    const extracted = [makeExtracted({ name: "Match Wine", winery: "X" })];
    const userWines = [makeUserWine({ id: "u1", name: "Match Wine", winery: "X" })];
    render(
      <WineListResults
        extractedWines={extracted}
        sourceName={null}
        userWines={userWines}
        addedWines={new Set()}
      />
    );
    expect(screen.getAllByText(/In your cellar/i).length).toBeGreaterThan(0);
  });

  it("calls onAddToBuyList with the extracted wine when the Add button is clicked", () => {
    const onAdd = vi.fn();
    const extracted = [makeExtracted({ name: "Add Me", winery: "Some Winery", vintage: 2019 })];
    render(
      <WineListResults
        extractedWines={extracted}
        sourceName={null}
        userWines={[]}
        addedWines={new Set()}
        onAddToBuyList={onAdd}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Add to Buy List/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({
      name: "Add Me",
      winery: "Some Winery",
      vintage: 2019,
    });
  });

  it("disables the Add button and shows 'Added to Buy List' when wine key is in addedWines", () => {
    const extracted = [makeExtracted({ name: "Added", winery: "W" })];
    render(
      <WineListResults
        extractedWines={extracted}
        sourceName={null}
        userWines={[]}
        addedWines={new Set(["Added-W"])}
        onAddToBuyList={vi.fn()}
      />
    );
    const btn = screen.getByRole("button", { name: /Added to Buy List/i });
    expect(btn).toBeDisabled();
  });

  it("renders the empty state when extractedWines is empty", () => {
    render(
      <WineListResults
        extractedWines={[]}
        sourceName={null}
        userWines={[]}
        addedWines={new Set()}
      />
    );
    expect(screen.getByText(/No wines detected/i)).toBeInTheDocument();
  });

  it("footer wires Done and Scan-Another callbacks correctly", () => {
    const onDone = vi.fn();
    const onScan = vi.fn();
    render(<WineListResultsFooter onDone={onDone} onScanAnother={onScan} />);
    fireEvent.click(screen.getByRole("button", { name: /Scan Another/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Done$/i }));
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("fuzzyMatch", () => {
  it("matches exactly through punctuation and case noise when name and winery align", () => {
    const extracted = makeExtracted({
      name: "Opus -- One!!",
      winery: "Opus",
      region: "Napa",
      grapeVariety: "Cabernet Franc",
    });
    const cellar = makeUserWine({
      name: "Opus One",
      winery: "Opus Winery",
      region: "Bordeaux",
      grapeVariety: "Merlot",
    });
    expect(fuzzyMatch(extracted, [cellar]).type).toBe("exact");
  });

  it("an extraction with no name matches nothing — not the first cellar wine", () => {
    const extracted = makeExtracted({
      name: "",
      winery: "",
      region: "Nowhere",
      grapeVariety: "Chardonnay",
    });
    const cellar = [
      makeUserWine({ name: "First Wine", winery: "W1" }),
      makeUserWine({ name: "Second Wine", winery: "W2" }),
    ];
    expect(fuzzyMatch(extracted, cellar).type).toBe("none");
  });

  it("a name that is a substring of an unrelated cellar wine, with a different winery, is not an exact match", () => {
    const extracted = makeExtracted({
      name: "One",
      winery: "Z Winery",
      region: "R1",
      grapeVariety: "G1",
    });
    const cellar = makeUserWine({
      name: "Opus One",
      winery: "Opus Winery",
      region: "R2",
      grapeVariety: "G2",
    });
    expect(fuzzyMatch(extracted, [cellar]).type).toBe("none");
  });

  it("same name but a different winery is not an exact match", () => {
    const extracted = makeExtracted({
      name: "Reserve",
      winery: "Alpha Winery",
      region: "R1",
      grapeVariety: "G1",
    });
    const cellar = makeUserWine({
      name: "Reserve",
      winery: "Beta Winery",
      region: "R2",
      grapeVariety: "G2",
    });
    expect(fuzzyMatch(extracted, [cellar]).type).toBe("none");
  });

  it("a cellar wine with an empty name matches nothing", () => {
    const extracted = makeExtracted({
      name: "Anything",
      winery: "W",
      region: "R1",
      grapeVariety: "G1",
    });
    const cellar = makeUserWine({
      name: "",
      winery: "W",
      region: "R2",
      grapeVariety: "G2",
    });
    expect(fuzzyMatch(extracted, [cellar]).type).toBe("none");
  });

  it("similar requires a shared name word plus the same grape or region", () => {
    const extracted = makeExtracted({
      name: "Caymus Special Selection",
      winery: "Caymus",
      region: "Napa",
      grapeVariety: "Cabernet Sauvignon",
    });
    const cellar = makeUserWine({
      name: "Caymus Reserve",
      winery: "Caymus Vineyards",
      region: "Napa",
      grapeVariety: "Cabernet Sauvignon",
    });
    expect(fuzzyMatch(extracted, [cellar]).type).toBe("similar");
  });

  it("the same grape alone, with no name overlap, is not similar", () => {
    const extracted = makeExtracted({
      name: "Mystery Blend",
      winery: "Caymus",
      region: "Napa",
      grapeVariety: "Cabernet Sauvignon",
    });
    const cellar = makeUserWine({
      name: "Totally Different",
      winery: "Other Winery",
      region: "Napa",
      grapeVariety: "Cabernet Sauvignon",
    });
    expect(fuzzyMatch(extracted, [cellar]).type).toBe("none");
  });
});
