import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Wine, Wall } from "@/types/wine";

const winesMock = vi.fn<() => Promise<Partial<Wine>[]>>(async () => []);
const wallsMock = vi.fn<() => Promise<Partial<Wall>[]>>(async () => []);

vi.mock("@/lib/data", () => ({
  fetchWines: (...args: unknown[]) => winesMock(...(args as [])),
  fetchWalls: (...args: unknown[]) => wallsMock(...(args as [])),
}));
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    userId: "u1",
    user: { displayName: "Owner", email: "owner@example.com" },
    devMode: false,
  }),
}));
vi.mock("@/hooks/use-tier", () => ({
  useTier: () => ({ tier: "PREMIUM" }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

import InsuranceReportPage from "@/app/(app)/insurance-report/page";

/**
 * Regression (ledger N27): a failed load used to fall through try/finally
 * with no catch and render a printable $0 insurance report while the
 * rejection went unhandled. The #39 shape (loadError + EmptyState retry)
 * applies here too.
 */
describe("InsuranceReportPage load failures", () => {
  beforeEach(() => {
    winesMock.mockReset();
    wallsMock.mockReset();
    wallsMock.mockResolvedValue([]);
  });

  it("a failed load shows an error state with retry, not a zeroed report", async () => {
    winesMock.mockRejectedValue(new Error("network down"));
    render(<InsuranceReportPage />);

    expect(await screen.findByText("Couldn't load your collection")).toBeInTheDocument();
    expect(
      screen.queryByText("Wine Collection Insurance Report")
    ).not.toBeInTheDocument();
  });

  it("Try again refetches and renders the report", async () => {
    winesMock.mockRejectedValueOnce(new Error("network down"));
    winesMock.mockResolvedValue([
      { id: "w1", name: "Chianti", winery: "Ruffino", type: "red", price: 20 },
    ]);
    render(<InsuranceReportPage />);

    expect(await screen.findByText("Couldn't load your collection")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText("Wine Collection Insurance Report")
    ).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load your collection")).not.toBeInTheDocument();
  });
});
