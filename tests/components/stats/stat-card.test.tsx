import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Wine } from "lucide-react";
import { StatCard } from "@/components/stats/stat-card";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
}));
vi.mock("@capacitor-firebase/authentication", () => ({}));
vi.mock("@capacitor/local-notifications", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

describe("StatCard", () => {
  it("renders label, value, subtext and icon", () => {
    const { container } = render(
      <StatCard
        label="Total Bottles"
        value="42"
        icon={Wine}
        color="#000"
        subtext="all cellars"
      />
    );
    expect(screen.getByText("Total Bottles")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("all cellars")).toBeInTheDocument();
    // icon = svg
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("wraps in a Next.js anchor when href is provided", () => {
    render(
      <StatCard
        label="Bottles"
        value="10"
        icon={Wine}
        color="#000"
        href="/stats/bottles"
      />
    );
    const anchor = screen.getByRole("link");
    expect(anchor).toHaveAttribute("href", "/stats/bottles");
    expect(anchor).toHaveTextContent("Bottles");
  });

  it("renders no anchor when href is omitted", () => {
    render(
      <StatCard
        label="Plain"
        value="1"
        icon={Wine}
        color="#000"
      />
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("omits subtext element when subtext prop is not given", () => {
    render(
      <StatCard label="X" value="0" icon={Wine} color="#000" />
    );
    expect(screen.queryByText("all cellars")).toBeNull();
  });
});
