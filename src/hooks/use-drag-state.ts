"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DragPayload, Position } from "@/components/cellar/drag-drop-types";

/**
 * Manages core drag state: payload, position, and isDragging.
 * Keeps refs in sync for use by callbacks that need latest values without stale closures.
 * The active drop target is NOT here — see createActiveTargetStore in
 * drag-drop-context.tsx for why it lives behind subscriptions instead.
 */
export function useDragState() {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dragPosition, setDragPosition] = useState<Position | null>(null);

  // Refs for reading latest values in callbacks (avoids stale closures)
  const payloadRef = useRef<DragPayload | null>(null);
  const positionRef = useRef<Position | null>(null);

  useEffect(() => { payloadRef.current = dragPayload; }, [dragPayload]);
  useEffect(() => { positionRef.current = dragPosition; }, [dragPosition]);

  const getPayload = useCallback(() => payloadRef.current, []);
  const getPosition = useCallback(() => positionRef.current, []);

  const resetState = useCallback(() => {
    setIsDragging(false);
    setDragPayload(null);
    setDragPosition(null);
  }, []);

  return {
    isDragging,
    dragPayload,
    dragPosition,
    setIsDragging,
    setDragPayload,
    setDragPosition,
    getPayload,
    getPosition,
    resetState,
  } as const;
}
