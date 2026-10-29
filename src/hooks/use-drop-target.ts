"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useDragDropActions } from "@/components/cellar/drag-drop-context";
import type { DragType } from "@/components/cellar/drag-drop-types";

interface UseDropTargetOptions {
  id: string;
  accepts: DragType[];
  /** Called on drop. Receives the drag data string + pointer position for precise hit detection. */
  onDrop: (data: string, position: { x: number; y: number }) => void;
  enabled?: boolean;
}

interface UseDropTargetReturn {
  dropRef: React.RefObject<HTMLElement | null>;
  /** True when a compatible drag item is hovering over this target */
  isOver: boolean;
}

export function useDropTarget({
  id,
  accepts,
  onDrop,
  enabled = true,
}: UseDropTargetOptions): UseDropTargetReturn {
  // Actions context only: its value never changes identity, so a drag in
  // progress (pointer moves, target crossings) cannot re-render every drop
  // target on the wall. The hover highlight arrives by subscription below.
  const {
    registerDropTarget,
    unregisterDropTarget,
    subscribeActiveTarget,
    isActiveTarget,
  } = useDragDropActions();
  const dropRef = useRef<HTMLElement | null>(null);

  // Keep onDrop in a ref so we don't re-register every render
  const onDropRef = useRef(onDrop);
  useEffect(() => { onDropRef.current = onDrop; }, [onDrop]);

  // Stable callback wrapper
  const stableOnDrop = useCallback(
    (data: string, position: { x: number; y: number }) => {
      onDropRef.current(data, position);
    },
    []
  );

  useEffect(() => {
    if (!enabled || !dropRef.current) return;

    registerDropTarget({
      id,
      element: dropRef.current,
      accepts,
      onDrop: stableOnDrop,
    });

    return () => {
      unregisterDropTarget(id);
    };
    // Re-register if id or accepts change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, enabled, registerDropTarget, unregisterDropTarget, stableOnDrop, ...accepts]);

  // Boolean snapshot per target: when the drag crosses into a new slot, only
  // the slot that gained and the slot that lost the highlight re-render.
  const subscribe = useCallback(
    (onChange: () => void) => subscribeActiveTarget(id, onChange),
    [id, subscribeActiveTarget]
  );
  const getSnapshot = useCallback(() => isActiveTarget(id), [id, isActiveTarget]);
  const isOver = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return { dropRef, isOver };
}
