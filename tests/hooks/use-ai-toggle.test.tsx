import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAiToggle } from "@/hooks/use-ai-toggle";

const KEY = "cellar-door-ai-enabled";

describe("useAiToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to true when localStorage is empty", () => {
    const { result } = renderHook(() => useAiToggle());
    expect(result.current.aiUserEnabled).toBe(true);
  });

  it("reads 'false' from localStorage", () => {
    localStorage.setItem(KEY, "false");
    const { result } = renderHook(() => useAiToggle());
    expect(result.current.aiUserEnabled).toBe(false);
  });

  it("setAiUserEnabled(false) writes 'false' to localStorage and updates value", () => {
    const { result } = renderHook(() => useAiToggle());
    act(() => {
      result.current.setAiUserEnabled(false);
    });
    expect(localStorage.getItem(KEY)).toBe("false");
    expect(result.current.aiUserEnabled).toBe(false);
  });

  it("setAiUserEnabled(true) writes 'true' to localStorage", () => {
    localStorage.setItem(KEY, "false");
    const { result } = renderHook(() => useAiToggle());
    act(() => {
      result.current.setAiUserEnabled(true);
    });
    expect(localStorage.getItem(KEY)).toBe("true");
    expect(result.current.aiUserEnabled).toBe(true);
  });

  it("notifies subscribers across multiple hook instances in the same tab", () => {
    const a = renderHook(() => useAiToggle());
    const b = renderHook(() => useAiToggle());
    expect(a.result.current.aiUserEnabled).toBe(true);
    expect(b.result.current.aiUserEnabled).toBe(true);
    act(() => {
      a.result.current.setAiUserEnabled(false);
    });
    expect(a.result.current.aiUserEnabled).toBe(false);
    expect(b.result.current.aiUserEnabled).toBe(false);
  });

  it("cross-tab storage event with matching key updates the value", () => {
    const { result } = renderHook(() => useAiToggle());
    expect(result.current.aiUserEnabled).toBe(true);
    // Simulate write happening in another tab
    localStorage.setItem(KEY, "false");
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: KEY,
          newValue: "false",
          oldValue: "true",
          storageArea: localStorage,
        })
      );
    });
    expect(result.current.aiUserEnabled).toBe(false);
  });

  it("ignores storage events with non-matching keys", () => {
    const { result } = renderHook(() => useAiToggle());
    localStorage.setItem("some-other-key", "false");
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "some-other-key",
          newValue: "false",
        })
      );
    });
    // unchanged
    expect(result.current.aiUserEnabled).toBe(true);
  });
});
