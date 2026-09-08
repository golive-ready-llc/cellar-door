"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseLongPressOptions {
  /** Callback fired after long-press duration, receives pointer position */
  onLongPress: (position: { x: number; y: number }) => void;
  /** Callback fired on normal tap (no long-press) */
  onPress?: () => void;
  /** Long-press duration in ms (default 500) */
  ms?: number;
  /** Disable the hook (e.g. in select mode or edit mode) */
  enabled?: boolean;
}

interface UseLongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

/**
 * Detects long-press (touch or mouse). Cancels if the pointer moves
 * more than 10px (indicating a scroll or drag). Fires `onPress` for
 * normal taps, `onLongPress` after the hold duration.
 *
 * Returns event handler props to spread onto the target element.
 */
export function useLongPress({
  onLongPress,
  onPress,
  ms = 500,
  enabled = true,
}: UseLongPressOptions): UseLongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  // The ghost-click suppression timer (set in handlePointerUpWrapped) — tracked
  // so it can be cleared on unmount instead of firing on a torn-down component.
  const ghostClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Clean up any pending timers on component unmount
  useEffect(() => {
    return () => {
      cancel();
      if (ghostClickTimerRef.current) clearTimeout(ghostClickTimerRef.current);
    };
  }, [cancel]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      didLongPressRef.current = false;
      startPosRef.current = { x: e.clientX, y: e.clientY };

      timerRef.current = setTimeout(() => {
        didLongPressRef.current = true;
        timerRef.current = null;
        onLongPress(startPosRef.current!);
      }, ms);
    },
    [enabled, ms, onLongPress]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startPosRef.current || !timerRef.current) return;
      const dx = e.clientX - startPosRef.current.x;
      const dy = e.clientY - startPosRef.current.y;
      // Cancel if moved more than 10px — user is scrolling/dragging
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        cancel();
      }
    },
    [cancel]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      cancel();
      if (!enabled) return;
      if (didLongPressRef.current) {
        // Long-press already fired — don't also fire onPress
        didLongPressRef.current = false;
        e.preventDefault();
        return;
      }
      // Normal tap — prevent default to block synthetic click events
      // (avoids "ghost clicks" on elements that appear after tap, e.g. dialogs)
      e.preventDefault();
      onPress?.();
    },
    [cancel, enabled, onPress]
  );

  const handlePointerLeave = useCallback(() => {
    cancel();
  }, [cancel]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      // Suppress browser context menu on long-press
      if (didLongPressRef.current || timerRef.current) {
        e.preventDefault();
      }
    },
    [enabled]
  );

  // Suppress the synthetic click that fires after pointerup on mobile.
  // Without this, the click event can propagate through to the dialog
  // overlay and immediately close a just-opened dialog ("ghost click").
  const recentPointerUpRef = useRef(false);

  const handlePointerUpWrapped = useCallback(
    (e: React.PointerEvent) => {
      handlePointerUp(e);
      // Mark that we just handled a pointerup — the next click should be suppressed
      recentPointerUpRef.current = true;
      // Clear after a short window (click events fire within ~300ms of pointerup)
      if (ghostClickTimerRef.current) clearTimeout(ghostClickTimerRef.current);
      ghostClickTimerRef.current = setTimeout(() => {
        recentPointerUpRef.current = false;
        ghostClickTimerRef.current = null;
      }, 400);
    },
    [handlePointerUp]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      // Only suppress clicks that follow a recent pointerup (i.e. ghost clicks)
      if (recentPointerUpRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [enabled]
  );

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUpWrapped,
    onPointerLeave: handlePointerLeave,
    onPointerCancel: handlePointerLeave,
    onContextMenu: handleContextMenu,
    onClick: handleClick,
  };
}
