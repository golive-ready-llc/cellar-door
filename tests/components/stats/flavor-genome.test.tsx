import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
}));
vi.mock("@capacitor-firebase/authentication", () => ({}));
vi.mock("@capacitor/local-notifications", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/hooks/use-tier", () => ({
  useTier: () => ({ hasAI: true, userId: "user-1" }),
}));
vi.mock("@/hooks/use-ai-toggle", () => ({
  useAiToggle: () => ({ aiUserEnabled: true }),
}));
vi.mock("@/components/ui/custom-toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const generateTasteProfile = vi.fn();
vi.mock("@/server/actions/taste-profile", () => ({
  generateTasteProfile: (...args: unknown[]) => generateTasteProfile(...args),
}));

import { FlavorGenome } from "@/components/stats/flavor-genome";

const BUNDLE = {
  all: { body: 5, tannin: 3, acidity: 6, sweetness: 2, fruit: 7, oak: 4, summary: "x" },
  red: null,
  white: { body: 5, tannin: 1, acidity: 8, sweetness: 3, fruit: 7, oak: 3, summary: "y" },
};

describe("FlavorGenome", () => {
  beforeEach(() => {
    generateTasteProfile.mockReset();
    generateTasteProfile.mockResolvedValue({ success: true, data: BUNDLE });
  });

  it("calls generateTasteProfile exactly once on mount", async () => {
    render(<FlavorGenome wineCount={10} />);
    await waitFor(() => {
      expect(screen.getByText("x")).toBeInTheDocument();
    });
    expect(generateTasteProfile).toHaveBeenCalledTimes(1);
  });

  it("shows empty state when switching to Reds tab without an additional fetch", async () => {
    const user = userEvent.setup();
    render(<FlavorGenome wineCount={10} />);
    await waitFor(() => expect(screen.getByText("x")).toBeInTheDocument());
    expect(generateTasteProfile).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Reds" }));

    expect(
      screen.getByText(/Add at least 3 reds/i)
    ).toBeInTheDocument();
    expect(generateTasteProfile).toHaveBeenCalledTimes(1);
  });

  it("renders white profile on Whites tab without an additional fetch", async () => {
    const user = userEvent.setup();
    render(<FlavorGenome wineCount={10} />);
    await waitFor(() => expect(screen.getByText("x")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Whites" }));
    expect(screen.getByText("y")).toBeInTheDocument();
    expect(generateTasteProfile).toHaveBeenCalledTimes(1);
  });

  it("refresh button calls generateTasteProfile a second time with force: true", async () => {
    const user = userEvent.setup();
    const { container } = render(<FlavorGenome wineCount={10} />);
    await waitFor(() => expect(screen.getByText("x")).toBeInTheDocument());
    expect(generateTasteProfile).toHaveBeenCalledTimes(1);

    // The refresh button is the icon-only button containing the rotating
    // arrow (RefreshCw) — find it by class h-8 w-8 that does NOT have the
    // share icon. Easiest: pick the second icon-button (Share is first,
    // Refresh is second when profile present).
    const iconButtons = Array.from(
      container.querySelectorAll("button.h-8.w-8")
    ) as HTMLButtonElement[];
    // Last icon-button is the refresh
    const refreshBtn = iconButtons[iconButtons.length - 1];
    expect(refreshBtn).toBeDefined();
    await user.click(refreshBtn);

    await waitFor(() => {
      expect(generateTasteProfile).toHaveBeenCalledTimes(2);
    });
    const secondCall = generateTasteProfile.mock.calls[1];
    // signature: generateTasteProfile(userId, { force })
    expect(secondCall[1]).toEqual({ force: true });
  });
});
