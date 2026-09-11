import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIncrementalList } from "@/hooks/use-incremental-list";

const make = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("useIncrementalList", () => {
  it("shows the first page and reports what's left", () => {
    const items = make(150);
    const { result } = renderHook(() => useIncrementalList(items, 60));
    expect(result.current.visible).toHaveLength(60);
    expect(result.current.remaining).toBe(90);
    expect(result.current.hasMore).toBe(true);
  });

  it("loads the next page on demand until everything is shown", () => {
    const items = make(150);
    const { result } = renderHook(() => useIncrementalList(items, 60));
    act(() => result.current.showMore());
    expect(result.current.visible).toHaveLength(120);
    act(() => result.current.showMore());
    expect(result.current.visible).toHaveLength(150);
    expect(result.current.hasMore).toBe(false);
  });

  it("starts over at the first page when the list changes", () => {
    let items = make(150);
    const { result, rerender } = renderHook(() => useIncrementalList(items, 60));
    act(() => result.current.showMore());
    expect(result.current.visible).toHaveLength(120);
    items = make(140);
    rerender();
    expect(result.current.visible).toHaveLength(60);
  });

  it("shows short lists in full", () => {
    const items = make(12);
    const { result } = renderHook(() => useIncrementalList(items, 60));
    expect(result.current.visible).toHaveLength(12);
    expect(result.current.hasMore).toBe(false);
  });
});
