"use client";

import type { RefObject } from "react";
import { Button } from "@/components/ui/button";

/**
 * End-of-list sentinel for useIncrementalList: scrolling near it loads the
 * next page automatically, and the button does the same for keyboard users
 * or browsers without IntersectionObserver.
 */
export function LoadMore({
  onMore,
  remaining,
  sentinelRef,
}: {
  onMore: () => void;
  remaining: number;
  sentinelRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={sentinelRef} className="flex justify-center py-6">
      <Button variant="outline" size="sm" onClick={onMore}>
        Show more ({remaining} left)
      </Button>
    </div>
  );
}
