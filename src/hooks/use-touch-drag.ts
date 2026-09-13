"use client";

import { useCallback, useRef, useState } from "react";
import { useDragDrop, type DragType } from "@/components/cellar/drag-drop-context";
import { hapticImpact } from "@/lib/capacitor";

interface UseTouchDragOptions {
  type: DragType;
  data: string;
  enabled?: boolean;
  /** Color for ghost (wine type color) */
  ghostColor?: string;
  /** Label for ghost chip */
  ghostLabel?: string;
  /** Wine name for drag ghost display */
  ghostName?: string;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  /** Called on a quick tap (pointer up without dragging) */
  onTap?: () => void;
}

interface UseTouchDragReturn {
  isDragging: boolean;
  dragHandleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    style?: React.CSSProperties;
  };
}

/** Minimum pixels the pointer must move to count as a scroll (cancels long-press) */
const SCROLL_THRESHOLD = 10;
/** Max total travel that still counts as a tap. Larger than SCROLL_THRESHOLD
 *  because fingers always drift a little on a real touchscreen. */
const TAP_SLOP = 24;
/** Minimum pixels mouse must move before drag starts */
const MOUSE_DEAD_ZONE = 5;
/** Long-press duration for touch drag initiation (ms) */
const LONG_PRESS_MS = 300;

export function useTouchDrag({
  type,
  data,
  enabled = true,
  ghostColor,
  ghostLabel,
  ghostName,
  onDragStart,
  onDragEnd,
  onTap,
}: UseTouchDragOptions): UseTouchDragReturn {
  const { startDrag, updateDragPosition, endDrag, cancelDrag, isDragging: contextIsDragging } =
    useDragDrop();

  const [localDragging, setLocalDragging] = useState(false);

  // Last known pointer position, kept fresh on every move. The drag context's
  // edge auto-scroll re-reads this so scrolling continues while the finger is
  // held still at the top/bottom of the screen.
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  // Refs for tracking the drag lifecycle (avoids stale closures in window listeners)
  const stateRef = useRef<{
    startX: number;
    startY: number;
    pointerId: number;
    pointerType: string;
    longPressTimer: ReturnType<typeof setTimeout> | null;
    isActiveDrag: boolean;
    scrollPreventer: ((e: TouchEvent) => void) | null;
    /** Set once the pointer drifts past SCROLL_THRESHOLD — the gesture is a
     *  scroll, so drag initiation is cancelled (but a tap can still fire). */
    scrollCancelled: boolean;
    /** How far the pointer travelled in total — a tap must stay small. */
    maxDistance: number;
  } | null>(null);

  const cleanup = useCallback(() => {
    const s = stateRef.current;
    if (s?.longPressTimer) {
      clearTimeout(s.longPressTimer);
    }
    if (s?.scrollPreventer) {
      document.removeEventListener("touchmove", s.scrollPreventer);
    }
    stateRef.current = null;
  }, []);

  const handleWindowPointerMove = useCallback(
    (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s) return;

      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > s.maxDistance) s.maxDistance = distance;
      // Remember where the finger is so the auto-scroll loop can keep
      // resolving drop targets while the pointer is held completely still.
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      if (!s.isActiveDrag) {
        // Not yet dragging — check thresholds
        if (s.pointerType === "touch") {
          // Touch: moving past the threshold means the user is scrolling, not
          // pressing — cancel the pending long-press so we don't hijack the
          // scroll. We deliberately KEEP the pointerup listener: a tap that
          // drifts a few px is still a tap, and dropping the listener here is
          // what made taps in move mode do nothing (the slot has no onClick).
          if (distance > SCROLL_THRESHOLD && !s.scrollCancelled) {
            s.scrollCancelled = true;
            if (s.longPressTimer) {
              clearTimeout(s.longPressTimer);
              s.longPressTimer = null;
            }
          }
          // Otherwise wait for long-press timer to fire
        } else {
          // Mouse: start drag once past dead zone
          if (distance > MOUSE_DEAD_ZONE) {
            s.isActiveDrag = true;
            setLocalDragging(true);
            onDragStart?.();
            startDrag(
              { type, data, ghostColor, ghostLabel, ghostName },
              { x: e.clientX, y: e.clientY }
            );
          }
        }
      } else {
        // Active drag — update position
        updateDragPosition({ x: e.clientX, y: e.clientY });
      }
    },
    // handleWindowPointerUp is declared below but referenced here — this
    // circular ref is intentional (all three window handlers tear each
    // other down), so we can't cleanly list it as a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, data, ghostColor, ghostLabel, ghostName, startDrag, updateDragPosition, onDragStart, cleanup]
  );

  const handleWindowPointerCancel = useCallback(
    () => {
      const s = stateRef.current;
      if (s?.isActiveDrag) {
        // The browser took the gesture mid-drag — end it as a cancel, not a
        // drop. Skipping this leaves the context stuck in isDragging, and
        // every later pointerdown bails at the contextIsDragging guard.
        cancelDrag();
        setLocalDragging(false);
        onDragEnd?.();
      }
      cleanup();
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerCancel);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cleanup, cancelDrag, onDragEnd]
  );

  const handleWindowPointerUp = useCallback(
    () => {
      const s = stateRef.current;
      if (s?.isActiveDrag) {
        endDrag();
        setLocalDragging(false);
        onDragEnd?.();
      } else if (s) {
        // No drag started. Treat it as a tap as long as the finger stayed
        // roughly in place — TAP_SLOP is deliberately larger than
        // SCROLL_THRESHOLD so ordinary finger drift still opens the wine
        // (previously any drift silently swallowed the tap in move mode).
        if (s.maxDistance <= TAP_SLOP) {
          onTap?.();
        }
      }
      cleanup();
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerCancel);
    },
    [endDrag, onDragEnd, onTap, cleanup, handleWindowPointerMove, handleWindowPointerCancel]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      // Only respond to primary button (left click / single touch)
      if (e.button !== 0) return;
      // Don't start a new drag if one is already in progress
      if (contextIsDragging) return;

      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;

      stateRef.current = {
        startX,
        startY,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        longPressTimer: null,
        isActiveDrag: false,
        scrollPreventer: null,
        scrollCancelled: false,
        maxDistance: 0,
      };
      lastPointerRef.current = { x: startX, y: startY };

      window.addEventListener("pointermove", handleWindowPointerMove);
      window.addEventListener("pointerup", handleWindowPointerUp);
      window.addEventListener("pointercancel", handleWindowPointerCancel);

      if (e.pointerType === "touch") {
        // Touch: use long-press to initiate
        stateRef.current.longPressTimer = setTimeout(() => {
          const s = stateRef.current;
          if (!s || s.isActiveDrag) return;
          // The finger already moved far enough to be a scroll — don't hijack it.
          if (s.scrollCancelled) return;

          // Long-press fired! Initiate drag
          s.isActiveDrag = true;
          setLocalDragging(true);
          onDragStart?.();
          hapticImpact();

          // Prevent browser scroll while dragging
          const preventScroll = (ev: TouchEvent) => ev.preventDefault();
          document.addEventListener("touchmove", preventScroll, { passive: false });
          s.scrollPreventer = preventScroll;

          startDrag(
            { type, data, ghostColor, ghostLabel, ghostName },
            { x: s.startX, y: s.startY }
          );
        }, LONG_PRESS_MS);
      }
      // Mouse: drag starts on pointermove (handled in handleWindowPointerMove)
    },
    [
      enabled,
      contextIsDragging,
      type,
      data,
      ghostColor,
      ghostLabel,
      ghostName,
      startDrag,
      onDragStart,
      handleWindowPointerMove,
      handleWindowPointerUp,
      handleWindowPointerCancel,
    ]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // Suppress native context menu on long-press in edit mode
      if (enabled) {
        e.preventDefault();
      }
    },
    [enabled]
  );

  return {
    isDragging: localDragging,
    dragHandleProps: enabled
      ? {
          onPointerDown: handlePointerDown,
          onContextMenu: handleContextMenu,
          style: {
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
          } as React.CSSProperties,
        }
      : {
          onPointerDown: () => {},
        },
  };
}
