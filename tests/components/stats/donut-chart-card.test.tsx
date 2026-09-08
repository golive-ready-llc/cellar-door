import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
}));
vi.mock("@capacitor-firebase/authentication", () => ({}));
vi.mock("@capacitor/local-notifications", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

// Recharts uses ResizeObserver internally; jsdom doesn't ship one.
beforeAll(() => {
  globalThis.ResizeObserver =
    globalThis.ResizeObserver ||
    (class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver);
});

import { DonutChartCard } from "@/components/stats/stats-charts";

describe("DonutChartCard", () => {
  it("renders a long type name with truncate class and title attribute", () => {
    render(
      <DonutChartCard
        title="Wine Types"
        emptyText="No data"
        data={[{ name: "Sparkling", value: 5, color: "#ff0" }]}
        totalBottles={10}
      />
    );
    const label = screen.getByText("Sparkling");
    expect(label).toHaveClass("truncate");
    expect(label).toHaveAttribute("title", "Sparkling");
  });
});
