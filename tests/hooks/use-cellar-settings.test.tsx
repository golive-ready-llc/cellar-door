import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { ReactNode } from "react";

/**
 * The cellar name and the "setup done" flag now live on the account instead of
 * browser localStorage. Values an existing browser already saved are copied up
 * once, so nobody loses a name they set before this change.
 */

const h = vi.hoisted(() => ({
  fetchCellarSettings: vi.fn(),
  saveCellarSettings: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  fetchWines: vi.fn(async () => []),
  fetchCabinets: vi.fn(async () => []),
  fetchWalls: vi.fn(async () => []),
  fetchHistory: vi.fn(async () => []),
  fetchBuyList: vi.fn(async () => []),
  invalidateReadCache: vi.fn(),
  editWine: vi.fn(async () => ({})),
  bulkDeleteWines: vi.fn(async () => 0),
  createCabinet: vi.fn(async () => ({})),
  editCabinet: vi.fn(async () => ({})),
  removeCabinet: vi.fn(async () => {}),
  createWall: vi.fn(async () => ({})),
  editWall: vi.fn(async () => ({})),
  removeWall: vi.fn(async () => {}),
  fetchCellarSettings: (...args: unknown[]) => h.fetchCellarSettings(...args),
  saveCellarSettings: (...args: unknown[]) => h.saveCellarSettings(...args),
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: { displayName: "Joel Stolk" }, devMode: false, demoMode: false, userId: "u1" }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import { useCellar } from "@/hooks/use-cellar";
import { EditModeProvider } from "@/components/cellar/edit-mode-context";

const wrapper = ({ children }: { children: ReactNode }) => (
  <EditModeProvider>{children}</EditModeProvider>
);

describe("useCellar cellar settings", () => {
  beforeEach(() => {
    localStorage.clear();
    h.fetchCellarSettings.mockReset();
    h.saveCellarSettings.mockReset();
    h.saveCellarSettings.mockImplementation(async (data: { onboarded?: boolean; cellarName?: string }) => ({
      onboarded: data.onboarded ?? false,
      cellarName: data.cellarName ?? "",
    }));
  });

  it("uses the account's setup flag and falls back to the default name", async () => {
    h.fetchCellarSettings.mockResolvedValue({ onboarded: false, cellarName: "" });
    const { result } = renderHook(() => useCellar(), { wrapper });
    await waitFor(() => expect(result.current.data.onboarded).toBe(false));
    expect(result.current.data.displayName).toBe("Joel's Cellar");
    expect(h.fetchCellarSettings).toHaveBeenCalledWith("u1");
  });

  it("shows the cellar name saved on the account", async () => {
    h.fetchCellarSettings.mockResolvedValue({ onboarded: true, cellarName: "The Vault" });
    const { result } = renderHook(() => useCellar(), { wrapper });
    await waitFor(() => expect(result.current.data.displayName).toBe("The Vault"));
    expect(result.current.data.onboarded).toBe(true);
  });

  it("copies a name and setup flag saved in this browser up to the account, once", async () => {
    localStorage.setItem("cellar-door-cellar-name", "Old Name");
    localStorage.setItem("cellar-door-onboarded", "true");
    h.fetchCellarSettings.mockResolvedValue({ onboarded: false, cellarName: "" });
    const { result } = renderHook(() => useCellar(), { wrapper });
    await waitFor(() =>
      expect(h.saveCellarSettings).toHaveBeenCalledWith({ onboarded: true, cellarName: "Old Name" }, "u1")
    );
    await waitFor(() => expect(result.current.data.displayName).toBe("Old Name"));
    expect(result.current.data.onboarded).toBe(true);
    expect(localStorage.getItem("cellar-door-cellar-name")).toBeNull();
    expect(localStorage.getItem("cellar-door-onboarded")).toBeNull();
  });

  it("saves a renamed cellar to the account", async () => {
    h.fetchCellarSettings.mockResolvedValue({ onboarded: true, cellarName: "" });
    const { result } = renderHook(() => useCellar(), { wrapper });
    await waitFor(() => expect(result.current.data.onboarded).toBe(true));
    await act(async () => {
      result.current.data.handleNameSave("New Name");
    });
    expect(h.saveCellarSettings).toHaveBeenCalledWith({ cellarName: "New Name" }, "u1");
    expect(result.current.data.displayName).toBe("New Name");
  });

  it("marks setup done on the account with the chosen name", async () => {
    h.fetchCellarSettings.mockResolvedValue({ onboarded: false, cellarName: "" });
    const { result } = renderHook(() => useCellar(), { wrapper });
    await waitFor(() => expect(result.current.data.onboarded).toBe(false));
    await act(async () => {
      await result.current.data.completeOnboarding("The Vault");
    });
    expect(h.saveCellarSettings).toHaveBeenCalledWith({ onboarded: true, cellarName: "The Vault" }, "u1");
    expect(result.current.data.onboarded).toBe(true);
    expect(result.current.data.displayName).toBe("The Vault");
  });
});
