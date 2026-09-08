"use client";

import { useCallback, useRef } from "react";
import type { DropTargetInfo } from "@/components/cellar/drag-drop-types";

/**
 * Manages registration and lookup of drop targets.
 * Stored in a ref to avoid re-renders on register/unregister.
 */
export function useDropTargets() {
  const targetsRef = useRef<Map<string, DropTargetInfo>>(new Map());

  const register = useCallback((info: DropTargetInfo) => {
    targetsRef.current.set(info.id, info);
  }, []);

  const unregister = useCallback((id: string) => {
    targetsRef.current.delete(id);
  }, []);

  const getTargets = useCallback(() => targetsRef.current, []);

  const getTarget = useCallback(
    (id: string) => targetsRef.current.get(id),
    []
  );

  return { register, unregister, getTargets, getTarget } as const;
}
