import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// CdScoreBadge (community-score) imports the data layer.
vi.mock("@/lib/data", () => ({
  submitCdRating: vi.fn(),
  fetchCommunityScore: vi.fn().mockResolvedValue(null),
  fetchCommunityRatings: vi.fn().mockResolvedValue([]),
}));

import { WineListItem, type WineDisplayData } from "@/components/inventory/wine-list-item";

const WINE: WineDisplayData = {
  name: "Row Wine",
  winery: "Row Winery",
  vintage: 2020,
  type: "red",
  imageUrl: "",
  grapeVariety: "Merlot",
  region: "Bordeaux",
  country: "France",
  price: 30,
  userRating: 4.5,
  cdScore: 4.1,
  cdRatingCount: 2,
};

const fmt = (n: number) => `$${n.toFixed(0)}`;

describe("WineListItem (canonical row)", () => {
  it("renders the standard anatomy: name, winery/vintage, meta, rating, price", () => {
    render(<WineListItem wine={WINE} formatPrice={fmt} onClick={() => {}} />);
    expect(screen.getByText("Row Wine")).toBeInTheDocument();
    expect(screen.getByText(/Row Winery/)).toBeInTheDocument();
    expect(screen.getByText("Merlot")).toBeInTheDocument();
    expect(screen.getByText(/Bordeaux/)).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument(); // StarRating compact
    expect(screen.getByText("$30")).toBeInTheDocument();
  });

  it("fires onClick and supports keyboard activation", () => {
    const onClick = vi.fn();
    render(<WineListItem wine={WINE} formatPrice={fmt} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("normalizes capitalized AI types instead of falling back to gray", () => {
    render(
      <WineListItem
        wine={{ ...WINE, type: "White", userRating: null, cdScore: null }}
        onClick={() => {}}
      />
    );
    // Label resolves via the lowercase map — "White" chip renders
    expect(screen.getByText("White")).toBeInTheDocument();
  });

  it("trailing slot replaces the built-in price", () => {
    render(
      <WineListItem
        wine={WINE}
        formatPrice={fmt}
        onClick={() => {}}
        trailing={<button>Wishlist</button>}
      />
    );
    expect(screen.getByText("Wishlist")).toBeInTheDocument();
    expect(screen.queryByText("$30")).not.toBeInTheDocument();
  });

  it("renders extraBadge and footer slots", () => {
    render(
      <WineListItem
        wine={WINE}
        formatPrice={fmt}
        onClick={() => {}}
        extraBadge={<span>REASON-BADGE</span>}
        footer={<span>FOOTER-NOTE</span>}
      />
    );
    expect(screen.getByText("REASON-BADGE")).toBeInTheDocument();
    expect(screen.getByText("FOOTER-NOTE")).toBeInTheDocument();
  });

  it("shows the selection checkbox state in select mode", () => {
    const { container, rerender } = render(
      <WineListItem wine={WINE} formatPrice={fmt} onClick={() => {}} selectMode selected={false} />
    );
    const unchecked = container.querySelectorAll("svg").length;
    rerender(
      <WineListItem wine={WINE} formatPrice={fmt} onClick={() => {}} selectMode selected />
    );
    // Selected ring style applied
    expect((container.firstChild as HTMLElement).className).toMatch(/border-primary/);
    expect(unchecked).toBeGreaterThan(0);
  });
});
