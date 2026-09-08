"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { WINE_TYPE_COLORS } from "@/types/constants";

import { useDragState } from "@/hooks/use-drag-state";
import { useDropTargets } from "@/hooks/use-drop-targets";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { useScrollSuppression } from "@/hooks/use-scroll-suppression";
import { findDropTargetAtPoint, computeEdgeScrollSpeed } from "./drag-drop-utils";

// Re-export types so existing imports continue to work
export type { DragType, DragPayload, DropTargetInfo } from "./drag-drop-types";

// ── Context type ────────────────────────────────────────────────

interface DragDropContextValue {
  isDragging: boolean;
  dragPayload: import("./drag-drop-types").DragPayload | null;
  dragPosition: { x: number; y: number } | null;
  activeDropTargetId: string | null;

  startDrag: (
    payload: import("./drag-drop-types").DragPayload,
    position: { x: number; y: number }
  ) => void;
  updateDragPosition: (position: { x: number; y: number }) => void;
  endDrag: () => void;
  cancelDrag: () => void;

  registerDropTarget: (info: import("./drag-drop-types").DropTargetInfo) => void;
  unregisterDropTarget: (id: string) => void;
}

const DragDropContext = createContext<DragDropContextValue | null>(null);

export function useDragDrop() {
  const ctx = useContext(DragDropContext);
  if (!ctx) throw new Error("useDragDrop must be used within DragDropProvider");
  return ctx;
}

// ── Provider ────────────────────────────────────────────────────

export function DragDropProvider({ children }: { children: ReactNode }) {
  const state = useDragState();
  const targets = useDropTargets();
  const scroll = useScrollSuppression();

  // Track whether scroll has been suppressed for the current drag
  const scrollSuppressedRef = useRef(false);

  const autoScroll = useAutoScroll({
    getPayload: state.getPayload,
    getPosition: state.getPosition,
    getActiveTarget: state.getActiveTarget,
    setActiveTarget: state.setActiveTarget,
    getDropTargets: targets.getTargets,
    computeSpeed: computeEdgeScrollSpeed,
  });

  const startDrag = useCallback(
    (payload: import("./drag-drop-types").DragPayload, position: { x: number; y: number }) => {
      state.setDragPayload(payload);
      state.setDragPosition(position);
      state.setIsDragging(true);
      scrollSuppressedRef.current = false;
      // Defer scroll suppression to first updateDragPosition call.
      // Changing touch-action mid-gesture can cause pointercancel on mobile.
    },
    [state]
  );

  const updateDragPosition = useCallback(
    (position: { x: number; y: number }) => {
      // Suppress scroll on first move -- safe because the gesture has already started
      if (!scrollSuppressedRef.current) {
        scroll.suppress();
        scrollSuppressedRef.current = true;
      }
      state.setDragPosition(position);

      // Find drop target under pointer
      const payload = state.getPayload();
      if (payload) {
        const targetId = findDropTargetAtPoint(
          targets.getTargets(),
          position.x,
          position.y,
          payload
        );
        if (targetId !== state.getActiveTarget()) {
          state.setActiveTarget(targetId);
        }
      }

      // Auto-scroll near viewport edges
      autoScroll.setSpeed(computeEdgeScrollSpeed(position.y));
    },
    [state, targets, scroll, autoScroll]
  );

  const cleanupDrag = useCallback(() => {
    if (scrollSuppressedRef.current) {
      autoScroll.stop();
      scroll.restore();
      scrollSuppressedRef.current = false;
    }
  }, [autoScroll, scroll]);

  const endDrag = useCallback(() => {
    const targetId = state.getActiveTarget();
    const payload = state.getPayload();
    const position = state.getPosition();

    if (targetId && payload && position) {
      const target = targets.getTarget(targetId);
      if (target && target.accepts.includes(payload.type)) {
        target.onDrop(payload.data, position);
      }
    }

    state.resetState();
    cleanupDrag();
  }, [state, targets, cleanupDrag]);

  const cancelDrag = useCallback(() => {
    state.resetState();
    cleanupDrag();
  }, [state, cleanupDrag]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      autoScroll.stop();
      scroll.restore();
    };
  }, [autoScroll, scroll]);

  return (
    <DragDropContext.Provider
      value={{
        isDragging: state.isDragging,
        dragPayload: state.dragPayload,
        dragPosition: state.dragPosition,
        activeDropTargetId: state.activeDropTargetId,
        startDrag,
        updateDragPosition,
        endDrag,
        cancelDrag,
        registerDropTarget: targets.register,
        unregisterDropTarget: targets.unregister,
      }}
    >
      {children}
      {state.isDragging && state.dragPosition && state.dragPayload && (
        <DragGhost
          payload={state.dragPayload}
          position={state.dragPosition}
          activeTargetId={state.activeDropTargetId}
        />
      )}
    </DragDropContext.Provider>
  );
}

// ── Ghost Element ───────────────────────────────────────────────

function DragGhost({
  payload,
  position,
  activeTargetId,
}: {
  payload: import("./drag-drop-types").DragPayload;
  position: { x: number; y: number };
  activeTargetId: string | null;
}) {
  const ghostContent = renderGhostContent(payload);
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 99999,
        opacity: activeTargetId ? 1 : 0.75,
        transition: "opacity 100ms",
        willChange: "transform",
      }}
    >
      {ghostContent}
    </div>,
    document.body
  );
}

function renderGhostContent(payload: import("./drag-drop-types").DragPayload) {
  switch (payload.type) {
    case "wine-id": {
      const color =
        payload.ghostColor ||
        WINE_TYPE_COLORS.red ||
        "#9B2335";
      const name = payload.ghostName || "";
      const truncatedName = name.length > 15 ? name.slice(0, 15) + "..." : name;
      return (
        <div className="flex flex-col items-center gap-1">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
            style={{
              backgroundColor: color,
              border: "2px solid rgba(255,255,255,0.5)",
              boxShadow:
                "0 4px 12px rgba(0,0,0,0.5), 0 0 20px rgba(50,100,255,0.2)",
            }}
          />
          {truncatedName && (
            <span className="text-[10px] leading-tight text-white font-medium px-1.5 py-0.5 rounded bg-black/50 whitespace-nowrap max-w-[100px] truncate">
              {truncatedName}
            </span>
          )}
        </div>
      );
    }
    case "template":
    case "storage-type":
    case "case-size":
      return (
        <div className="px-3 py-1.5 rounded-full bg-primary/90 text-primary-foreground text-xs font-semibold shadow-lg whitespace-nowrap">
          {payload.ghostLabel || payload.type}
        </div>
      );
    case "section-id":
      return (
        <div className="w-8 h-8 rounded bg-muted/90 flex items-center justify-center shadow-lg">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="text-muted-foreground"
          >
            <circle cx="4" cy="4" r="1.5" />
            <circle cx="4" cy="8" r="1.5" />
            <circle cx="4" cy="12" r="1.5" />
            <circle cx="12" cy="4" r="1.5" />
            <circle cx="12" cy="8" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
          </svg>
        </div>
      );
    default:
      return null;
  }
}
