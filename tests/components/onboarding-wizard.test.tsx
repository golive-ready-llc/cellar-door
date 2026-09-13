import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OnboardingWizard, shouldShowOnboarding } from "@/components/onboarding/onboarding-wizard";

/**
 * The wizard used to store "setup done" and the cellar name in localStorage,
 * so every new browser showed it again. It now hands the name to its caller,
 * which saves both on the account.
 */

describe("OnboardingWizard", () => {
  beforeEach(() => localStorage.clear());

  it("hands back the typed cellar name when setup finishes", () => {
    const onFinish = vi.fn();
    render(<OnboardingWizard onFinish={onFinish} />);
    fireEvent.change(screen.getByPlaceholderText("My Wine Collection"), { target: { value: "The Vault" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /do this later/i }));
    fireEvent.click(screen.getByRole("button", { name: /explore your cellar/i }));
    expect(onFinish).toHaveBeenCalledWith("The Vault");
  });

  it("reports setup as done when skipped", () => {
    const onFinish = vi.fn();
    render(<OnboardingWizard onFinish={onFinish} />);
    fireEvent.click(screen.getByRole("button", { name: /skip setup/i }));
    expect(onFinish).toHaveBeenCalledWith("");
  });

  it("writes nothing to browser storage", () => {
    render(<OnboardingWizard onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /skip setup/i }));
    expect(localStorage.length).toBe(0);
  });
});

describe("shouldShowOnboarding", () => {
  const base = { loading: false, onboarded: false as boolean | null, wineCount: 0, demoMode: false };

  it("shows for a loaded, empty account that has not finished setup", () => {
    expect(shouldShowOnboarding(base)).toBe(true);
  });

  it("stays hidden while loading or before the setting is known", () => {
    expect(shouldShowOnboarding({ ...base, loading: true })).toBe(false);
    expect(shouldShowOnboarding({ ...base, onboarded: null })).toBe(false);
  });

  it("stays hidden once setup is done, when the cellar has wines, or in demo mode", () => {
    expect(shouldShowOnboarding({ ...base, onboarded: true })).toBe(false);
    expect(shouldShowOnboarding({ ...base, wineCount: 3 })).toBe(false);
    expect(shouldShowOnboarding({ ...base, demoMode: true })).toBe(false);
  });
});
