import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => useAuthMock(),
}));

import { useTier } from "@/hooks/use-tier";

const KEY = "cellar-door-ai-enabled";

describe("useTier", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthMock.mockReset();
  });

  it("FREE tier: tierHasAI is false, hasAI is false, isPaid is false", () => {
    useAuthMock.mockReturnValue({ tier: "FREE", userId: "u1" });
    const { result } = renderHook(() => useTier());
    expect(result.current.tier).toBe("FREE");
    expect(result.current.tierHasAI).toBe(false);
    expect(result.current.hasAI).toBe(false);
    expect(result.current.isPaid).toBe(false);
    expect(result.current.upgradeTier).toBe("PRO");
  });

  it("PRO tier with toggle on: hasAI true, tierHasAI true, isPaid true", () => {
    useAuthMock.mockReturnValue({ tier: "PRO", userId: "u2" });
    const { result } = renderHook(() => useTier());
    expect(result.current.tierHasAI).toBe(true);
    expect(result.current.hasAI).toBe(true);
    expect(result.current.isPaid).toBe(true);
    expect(result.current.aiUserEnabled).toBe(true);
  });

  it("PRO tier with AI toggle off: tierHasAI stays true but hasAI becomes false", () => {
    localStorage.setItem(KEY, "false");
    useAuthMock.mockReturnValue({ tier: "PRO", userId: "u3" });
    const { result } = renderHook(() => useTier());
    expect(result.current.tierHasAI).toBe(true);
    expect(result.current.hasAI).toBe(false);
    expect(result.current.aiUserEnabled).toBe(false);
  });

  it("PREMIUM tier: upgradeTier is null (already at top)", () => {
    useAuthMock.mockReturnValue({ tier: "PREMIUM", userId: "u4" });
    const { result } = renderHook(() => useTier());
    expect(result.current.tier).toBe("PREMIUM");
    expect(result.current.upgradeTier).toBeNull();
    expect(result.current.isPaid).toBe(true);
    expect(result.current.hasAI).toBe(true);
  });

  it("can() returns true for tier-enabled features regardless of toggle", () => {
    localStorage.setItem(KEY, "false");
    useAuthMock.mockReturnValue({ tier: "PRO", userId: "u5" });
    const { result } = renderHook(() => useTier());
    // Static check ignores AI toggle
    expect(result.current.can("aiEnabled")).toBe(true);
  });

  it("canUseAi() respects the AI user toggle for AI-gated features", () => {
    localStorage.setItem(KEY, "false");
    useAuthMock.mockReturnValue({ tier: "PRO", userId: "u6" });
    const { result } = renderHook(() => useTier());
    expect(result.current.canUseAi("aiEnabled")).toBe(false);
    expect(result.current.canUseAi("labelScanning")).toBe(false);
  });

  it("canUseAi() does NOT gate non-AI features behind the toggle", () => {
    localStorage.setItem(KEY, "false");
    useAuthMock.mockReturnValue({ tier: "PREMIUM", userId: "u7" });
    const { result } = renderHook(() => useTier());
    // apiAccess is a non-AI feature available on PREMIUM
    expect(result.current.canUseAi("apiAccess")).toBe(true);
  });

  it("canAddWine() callable for any tier", () => {
    useAuthMock.mockReturnValue({ tier: "FREE", userId: "u8" });
    const { result } = renderHook(() => useTier());
    expect(typeof result.current.canAddWine(0)).toBe("boolean");
    // Every tier is unlimited since the 2026-08 pricing revamp
    expect(result.current.canAddWine(99999)).toBe(true);
  });
});
