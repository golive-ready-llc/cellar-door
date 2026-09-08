"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DragPayload, Position } from "@/components/cellar/drag-drop-types";

/**
 * Manages core drag state: payload, position, active target, and isDragging.
 * Keeps refs in sync for use by callbacks that need latest values without stale closures.
 */
export function useDragState() {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dragPosition, setDragPosition] = useState<Position | null>(null);
  const [activeDropTargetId, setActiveDropTargetId] = useState<string | null>(null);

  // Refs for reading latest values in callbacks (avoids stale closures)
  const activeTargetRef = useRef<string | null>(null);
  const payloadRef = useRef<DragPayload | null>(null);
  const positionRef = useRef<Position | null>(null);

  useEffect(() => { payloadRef.current = dragPayload; }, [dragPayload]);
  useEffect(() => { positionRef.current = dragPosition; }, [dragPosition]);

  const setActiveTarget = useCallback((id: string | null) => {
    activeTargetRef.current = id;
    setActiveDropTargetId(id);
  }, []);

  const getPayload = useCallback(() => payloadRef.current, []);
  const getPosition = useCallback(() => positionRef.current, []);
  const getActiveTarget = useCallback(() => activeTargetRef.current, []);

  const resetState = useCallback(() => {
    activeTargetRef.current = null;
    setIsDragging(false);
    setDragPayload(null);
    setDragPosition(null);
    setActiveDropTargetId(null);
  }, []);

  return {
    isDragging,
    dragPayload,
    dragPosition,
    activeDropTargetId,
    setIsDragging,
    setDragPayload,
    setDragPosition,
    setActiveTarget,
    getPayload,
    getPosition,
    getActiveTarget,
    resetState,
  } as const;
}
