"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

const PULL_THRESHOLD = 80; // px to pull before triggering refresh
const MAX_PULL = 120; // cap the visual pull indicator

/**
 * Get the current scroll-top of whichever element is actually scrolling.
 * Walks up from `el` looking for an ancestor with overflow-y scroll/auto
 * whose content overflows. Falls back to the document/window scroll position
 * (handles flex layouts where overflow escapes to the document level).
 */
function getScrollTop(el: HTMLElement | null): number {
  if (!el) return window.scrollY;

  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
      return node.scrollTop;
    }
    node = node.parentElement;
  }

  // No scrollable ancestor found — scroll is at the document level
  return window.scrollY;
}

/**
 * Pull-to-refresh wrapper. Shows a floating circular indicator that follows
 * the user's finger during drag, then transitions to a top-center spinner
 * while refreshing.
 */
export function PullToRefresh({
  onRefresh,
  children,
  className,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [_touchY, setTouchY] = useState(0);

  const touchStartRef = useRef<{ y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing) return;
      // Only capture if at the very top of the scroll area
      if (getScrollTop(containerRef.current) <= 0) {
        touchStartRef.current = {
          y: e.touches[0].clientY,
        };
        setTouchY(e.touches[0].clientY);
      }
    },
    [refreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing || !touchStartRef.current) return;
      if (getScrollTop(containerRef.current) > 0) {
        // User has scrolled down — cancel the pull
        touchStartRef.current = null;
        setPullDistance(0);
        return;
      }

      const clientY = e.touches[0].clientY;
      const delta = clientY - touchStartRef.current.y;
      if (delta > 0) {
        // Pulling down — apply rubber-band damping
        const dampened = Math.min(MAX_PULL, delta * 0.4);
        setPullDistance(dampened);
        setTouchY(clientY);
      } else {
        setPullDistance(0);
      }
    },
    [refreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!touchStartRef.current) return;
    touchStartRef.current = null;

    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD * 0.5); // keep indicator visible during refresh
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshing, onRefresh]);

  const showIndicator = pullDistance > 0 || refreshing;
  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);
  const atThreshold = progress >= 1;

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Pull indicator — fixed at top, slides down/up */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        style={{
          top: showIndicator
            ? refreshing
              ? 72  // Stay visible at top during refresh
              : Math.max(40, Math.min(120, 40 + pullDistance)) // Slide down with pull
            : -60, // Hidden above viewport when not pulling
          transition: (!showIndicator || refreshing)
            ? "top 0.3s cubic-bezier(0.4, 0, 0.2, 1)"  // Smooth snap up
            : "none", // Follow finger without transition
          opacity: showIndicator ? 1 : 0,
        }}
      >
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 transition-colors duration-200",
            refreshing
              ? "bg-primary/10 border-primary"
              : atThreshold
                ? "bg-primary/10 border-primary"
                : "bg-background border-border"
          )}
        >
          {refreshing ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : (
            <ArrowDown
              className={cn(
                "h-5 w-5 transition-colors duration-200",
                atThreshold ? "text-primary" : "text-muted-foreground"
              )}
              style={{
                transform: `rotate(${progress * 180}deg)`,
                transition: "transform 0.1s ease-out",
              }}
            />
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
