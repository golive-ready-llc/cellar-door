import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { useScrollSuppression } from "@/hooks/use-scroll-suppression";

/**
 * The DragDropProvider's unmount-cleanup effect lists the objects returned by
 * these hooks in its deps ([autoScroll, scroll]). When the hooks returned a
 * fresh literal per render, that "unmount" cleanup ran after every pointermove
 * re-render — cancelling the auto-scroll rAF loop and un-suppressing touch
 * scroll mid-drag. These tests pin the identity stability the effect relies on.
 */

describe("drag hook return-identity stability", () => {
  it("useAutoScroll returns the same object across renders", () => {
    const { result, rerender } = renderHook(() =>
      useAutoScroll({
        getPayload: () => null,
        getPosition: () => null,
        getActiveTarget: () => null,
        setActiveTarget: () => {},
        getDropTargets: () => new Map(),
        computeSpeed: () => 0,
      })
    );
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
    expect(result.current.setSpeed).toBe(first.setSpeed);
    expect(result.current.stop).toBe(first.stop);
  });

  it("useScrollSuppression returns the same object across renders", () => {
    const { result, rerender } = renderHook(() => useScrollSuppression());
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
    expect(result.current.suppress).toBe(first.suppress);
    expect(result.current.restore).toBe(first.restore);
  });
});
