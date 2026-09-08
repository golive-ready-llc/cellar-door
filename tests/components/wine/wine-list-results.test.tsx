import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  WineListResults,
  WineListResultsFooter,
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

  it("renders an 'In your cellar!' badge when the wine name matches a user wine", () => {
    const extracted = [makeExtracted({ name: "Match Wine", winery: "X" })];
    const userWines = [makeUserWine({ id: "u1", name: "Match Wine" })];
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
