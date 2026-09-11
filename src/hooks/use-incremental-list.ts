"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const INCREMENTAL_PAGE_SIZE = 60;

/**
 * Mount a long list a page at a time instead of all at once (a big cellar is
 * hundreds of cards with images). A sentinel after the last row loads the
 * next page as it nears the viewport, and `showMore` does the same on demand.
 * A new `items` array (a new filter, search or sort) starts again at page one.
 */
export function useIncrementalList<T>(items: T[], pageSize: number = INCREMENTAL_PAGE_SIZE) {
  const [state, setState] = useState<{ items: T[]; count: number }>({ items, count: pageSize });
  const count = state.items === items ? state.count : pageSize;
  const visibleCount = Math.min(count, items.length);
  const hasMore = visibleCount < items.length;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const showMore = useCallback(() => {
    setState({ items, count: visibleCount + pageSize });
  }, [items, visibleCount, pageSize]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) showMore();
      },
      { rootMargin: "800px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, showMore]);

  return {
    visible: items.slice(0, visibleCount),
    hasMore,
    remaining: items.length - visibleCount,
    showMore,
    sentinelRef,
  };
}
