"use client";

import { useCallback, useEffect, useRef } from "react";
import { useDragDrop, type DragType } from "@/components/cellar/drag-drop-context";

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
  const { registerDropTarget, unregisterDropTarget, activeDropTargetId } =
    useDragDrop();
  const dropRef = useRef<HTMLElement | null>(null);

  // Keep onDrop in a ref so we don't re-register every render
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

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

  const isOver = activeDropTargetId === id;

  return { dropRef, isOver };
}
