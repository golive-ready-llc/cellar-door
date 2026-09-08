"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { DragPayload, DropTargetInfo, Position } from "@/components/cellar/drag-drop-types";
import { findDropTargetAtPoint } from "@/components/cellar/drag-drop-utils";

interface AutoScrollCallbacks {
  getPayload: () => DragPayload | null;
  getPosition: () => Position | null;
  getActiveTarget: () => string | null;
  setActiveTarget: (id: string | null) => void;
  getDropTargets: () => Map<string, DropTargetInfo>;
  /** Edge-scroll speed for a given viewport Y — re-evaluated every frame so
   *  scrolling continues while the pointer is held still near an edge. */
  computeSpeed: (y: number) => number;
}

/**
 * Manages auto-scroll during drag near viewport edges.
 * Uses a requestAnimationFrame loop and refs to avoid circular
 * useCallback dependencies with findDropTarget.
 */
export function useAutoScroll(callbacks: AutoScrollCallbacks) {
  const rafRef = useRef<number | null>(null);
  const speedRef = useRef(0);

  // Store callbacks in a ref to keep the loop stable.
  // Updating refs must happen in an effect, not during render.
  const cbRef = useRef(callbacks);
  useEffect(() => {
    cbRef.current = callbacks;
  });

  // Hold the rAF loop in a ref so it can reference itself. Installed via
  // effect to avoid the "cannot update ref during render" rule.
  const loopRef = useRef<() => void>(() => {});
  useEffect(() => {
    loopRef.current = () => {
      // Recompute the speed from the CURRENT pointer position every frame.
      // Previously the speed was only refreshed inside updateDragPosition —
      // i.e. on pointer *movement* — so holding the finger still at the edge
      // stopped the scroll, which is why dragging required constant wiggling.
      const livePos = cbRef.current.getPosition();
      if (livePos) {
        speedRef.current = cbRef.current.computeSpeed(livePos.y);
      }
      const speed = speedRef.current;
      if (speed === 0) {
        rafRef.current = null;
        return;
      }
      window.scrollBy(0, speed);

      // Re-evaluate drop target after scrolling (elements moved under finger)
      const pos = cbRef.current.getPosition();
      const payload = cbRef.current.getPayload();
      if (pos && payload) {
        const targets = cbRef.current.getDropTargets();
        const targetId = findDropTargetAtPoint(targets, pos.x, pos.y, payload);
        if (targetId !== cbRef.current.getActiveTarget()) {
          cbRef.current.setActiveTarget(targetId);
        }
      }

      rafRef.current = requestAnimationFrame(() => loopRef.current());
    };
  }, []);

  const setSpeed = useCallback(
    (speed: number) => {
      speedRef.current = speed;
      if (speed !== 0 && rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => loopRef.current());
      }
    },
    []
  );

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    speedRef.current = 0;
  }, []);

  // Stable identity across renders — the DragDropProvider's unmount-cleanup
  // effect lists this object in its deps, so a fresh literal per render made
  // the cleanup fire after every pointermove, cancelling the rAF loop and
  // freezing edge auto-scroll the moment the finger stopped moving.
  return useMemo(() => ({ setSpeed, stop }), [setSpeed, stop]);
}
