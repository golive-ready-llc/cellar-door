import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroStatCards } from "@/components/stats/hero-stat-cards";
import type { CoreStats } from "@/lib/stats-utils";
import type { Wine, WineHistoryItem } from "@/types/wine";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
}));
vi.mock("@capacitor-firebase/authentication", () => ({}));
vi.mock("@capacitor/local-notifications", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

const stats: CoreStats = {
  totalBottles: 42,
  totalValue: 1234,
  totalRetailValue: 1500,
  avgPrice: 30,
  avgRating: 4.2,
  oldestVintage: 1995,
  newestVintage: 2022,
  totalConsumed: 7,
};

const wines = [
  { country: "France", grapeVariety: "Pinot Noir, Chardonnay", userRating: 4 },
  { country: "Italy", grapeVariety: "Sangiovese", userRating: 5 },
  { country: "France", grapeVariety: "Pinot Noir", userRating: null },
] as unknown as Wine[];

const history = [
  { reason: "drank" },
  { reason: "drank" },
  { reason: "gifted" },
] as unknown as WineHistoryItem[];

describe("HeroStatCards", () => {
  it("renders all 8 stat cards with correct hrefs", () => {
    render(<HeroStatCards stats={stats} wines={wines} history={history} />);
    const expected = [
      "/stats/bottles",
      "/stats/value",
      "/stats/ratings",
      "/stats/consumed",
      "/stats/price",
      "/stats/vintage",
      "/stats/countries",
      "/stats/grapes",
    ];
    const anchors = screen.getAllByRole("link");
    expect(anchors).toHaveLength(8);
    for (const href of expected) {
      expect(anchors.some((a) => a.getAttribute("href") === href)).toBe(true);
    }
  });

  it("renders all 8 expected labels", () => {
    render(<HeroStatCards stats={stats} wines={wines} history={history} />);
    [
      "Total Bottles",
      "Collection Value",
      "Avg. Rating",
      "Wines Consumed",
      "Avg. Price",
      "Oldest Vintage",
      "Countries",
      "Grape Varieties",
    ].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("formats values from props", () => {
    render(<HeroStatCards stats={stats} wines={wines} history={history} />);
    expect(screen.getByText("42")).toBeInTheDocument(); // total bottles
    expect(screen.getByText("$1,234")).toBeInTheDocument(); // collection value
    expect(screen.getByText("4.2")).toBeInTheDocument(); // avg rating
    expect(screen.getByText("7")).toBeInTheDocument(); // consumed
    expect(screen.getByText("$30")).toBeInTheDocument(); // avg price
    expect(screen.getByText("1995")).toBeInTheDocument(); // oldest vintage
    // 2 unique countries (France, Italy)
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders subtext for retail value when present", () => {
    render(<HeroStatCards stats={stats} wines={wines} history={history} />);
    expect(screen.getByText(/retail/i)).toBeInTheDocument();
  });
});
