"use client";

import { useCallback, useMemo, useRef } from "react";

/**
 * Manages touch scroll suppression during drag operations.
 * Uses touchmove preventDefault instead of body.overflow = "hidden"
 * so that programmatic window.scrollBy() still works for auto-scroll.
 */
export function useScrollSuppression() {
  const touchMoveHandlerRef = useRef<((e: TouchEvent) => void) | null>(null);
  const suppressedRef = useRef(false);

  const suppress = useCallback(() => {
    document.documentElement.style.touchAction = "none";
    const handler = (e: TouchEvent) => e.preventDefault();
    document.addEventListener("touchmove", handler, { passive: false });
    touchMoveHandlerRef.current = handler;
    suppressedRef.current = true;
  }, []);

  const restore = useCallback(() => {
    document.documentElement.style.touchAction = "";
    if (touchMoveHandlerRef.current) {
      document.removeEventListener("touchmove", touchMoveHandlerRef.current);
      touchMoveHandlerRef.current = null;
    }
    suppressedRef.current = false;
  }, []);

  // Stable identity across renders — listed in the DragDropProvider cleanup
  // effect's deps; a fresh literal per render restored touch scrolling (and
  // via the same effect, killed auto-scroll) after every pointermove.
  return useMemo(() => ({ suppress, restore, suppressedRef }), [suppress, restore]);
}
