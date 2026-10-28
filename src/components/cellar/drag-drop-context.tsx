"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
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
export type {
  DragType,
  DragPayload,
  DropTargetInfo,
  Position,
} from "./drag-drop-types";

// ── Context types ────────────────────────────────────────────────

interface DragDropActions {
  startDrag: (
    payload: import("./drag-drop-types").DragPayload,
    position: import("./drag-drop-types").Position
  ) => void;
  updateDragPosition: (position: import("./drag-drop-types").Position) => void;
  endDrag: () => void;
  cancelDrag: () => void;
  registerDropTarget: (info: import("./drag-drop-types").DropTargetInfo) => void;
  unregisterDropTarget: (id: string) => void;
  /** Subscribe to flips of "is `id` the active drop target". */
  subscribeActiveTarget: (id: string, onChange: () => void) => () => void;
  isActiveTarget: (id: string) => boolean;
  /** Subscribe to any change of which target (if any) is active. */
  subscribeAny: (onChange: () => void) => () => void;
  hasActive: () => boolean;
}

interface DragDropState {
  isDragging: boolean;
  dragPayload: import("./drag-drop-types").DragPayload | null;
}

type DragDropContextValue = DragDropActions & DragDropState;

const DragDropActionsContext = createContext<DragDropActions | null>(null);
const DragDropStateContext = createContext<DragDropState | null>(null);

export function useDragDrop(): DragDropContextValue {
  const actions = useContext(DragDropActionsContext);
  const state = useContext(DragDropStateContext);
  if (!actions || !state) {
    throw new Error("useDragDrop must be used within DragDropProvider");
  }
  return { ...actions, ...state };
}

/**
 * Actions only. The actions context value never changes identity, so
 * consumers of this hook (every drop target on the wall) are never
 * re-rendered by drag lifecycle changes — see use-drop-target.ts.
 */
export function useDragDropActions(): DragDropActions {
  const actions = useContext(DragDropActionsContext);
  if (!actions) {
    throw new Error("useDragDropActions must be used within DragDropProvider");
  }
  return actions;
}

// ── Active-target store ──────────────────────────────────────────

interface ActiveTargetStore {
  get(): string | null;
  set(id: string | null): void;
  subscribe(id: string, onChange: () => void): () => void;
  isActive(id: string): boolean;
  subscribeAny(onChange: () => void): () => void;
  hasActive(): boolean;
}

/**
 * The active drop target flips every time a drag crosses into a new slot.
 * It lives in this subscription store instead of context state because the
 * whole wall consumes the drag context: as context state, each crossing
 * re-rendered every slot to move a highlight between exactly two of them.
 * Per-id subscriptions mean only the slot that gained and the slot that
 * lost the highlight re-render.
 */
function createActiveTargetStore(): ActiveTargetStore {
  let active: string | null = null;
  const listeners = new Map<string, Set<() => void>>();
  const anyListeners = new Set<() => void>();
  const notify = (id: string) => listeners.get(id)?.forEach((cb) => cb());
  return {
    get: () => active,
    set(id) {
      if (id === active) return;
      const prev = active;
      active = id;
      if (prev !== null) notify(prev);
      if (id !== null) notify(id);
      anyListeners.forEach((cb) => cb());
    },
    subscribe(id, onChange) {
      let set = listeners.get(id);
      if (!set) {
        set = new Set();
        listeners.set(id, set);
      }
      set.add(onChange);
      return () => {
        set.delete(onChange);
      };
    },
    isActive: (id) => active === id,
    subscribeAny(onChange) {
      anyListeners.add(onChange);
      return () => {
        anyListeners.delete(onChange);
      };
    },
    hasActive: () => active !== null,
  };
}

// ── Provider ────────────────────────────────────────────────────

export function DragDropProvider({ children }: { children: ReactNode }) {
  const {
    isDragging,
    dragPayload,
    dragPosition,
    setDragPayload,
    setDragPosition,
    setIsDragging,
    getPayload,
    getPosition,
    resetState,
  } = useDragState();
  const { register, unregister, getTargets, getTarget } = useDropTargets();
  const { suppress, restore } = useScrollSuppression();

  // Track whether scroll has been suppressed for the current drag
  const scrollSuppressedRef = useRef(false);

  const activeTargets = useMemo(() => createActiveTargetStore(), []);

  const autoScroll = useAutoScroll({
    getPayload,
    getPosition,
    getActiveTarget: activeTargets.get,
    setActiveTarget: activeTargets.set,
    getDropTargets: getTargets,
    computeSpeed: computeEdgeScrollSpeed,
  });
  const { setSpeed: autoScrollSetSpeed, stop: autoScrollStop } = autoScroll;

  const startDrag = useCallback(
    (
      payload: import("./drag-drop-types").DragPayload,
      position: import("./drag-drop-types").Position
    ) => {
      setDragPayload(payload);
      setDragPosition(position);
      setIsDragging(true);
      scrollSuppressedRef.current = false;
      // Defer scroll suppression to first updateDragPosition call.
      // Changing touch-action mid-gesture can cause pointercancel on mobile.
    },
    [setDragPayload, setDragPosition, setIsDragging]
  );

  const updateDragPosition = useCallback(
    (position: import("./drag-drop-types").Position) => {
      // Suppress scroll on first move -- safe because the gesture has already started
      if (!scrollSuppressedRef.current) {
        suppress();
        scrollSuppressedRef.current = true;
      }
      setDragPosition(position);

      // Find drop target under pointer
      const payload = getPayload();
      if (payload) {
        const targetId = findDropTargetAtPoint(
          getTargets(),
          position.x,
          position.y,
          payload
        );
        if (targetId !== activeTargets.get()) {
          activeTargets.set(targetId);
        }
      }

      // Auto-scroll near viewport edges
      autoScrollSetSpeed(computeEdgeScrollSpeed(position.y));
    },
    [suppress, setDragPosition, getPayload, getTargets, activeTargets, autoScrollSetSpeed]
  );

  const cleanupDrag = useCallback(() => {
    if (scrollSuppressedRef.current) {
      autoScrollStop();
      restore();
      scrollSuppressedRef.current = false;
    }
  }, [autoScrollStop, restore]);

  const endDrag = useCallback(() => {
    const targetId = activeTargets.get();
    const payload = getPayload();
    const position = getPosition();

    if (targetId && payload && position) {
      const target = getTarget(targetId);
      if (target && target.accepts.includes(payload.type)) {
        target.onDrop(payload.data, position);
      }
    }

    activeTargets.set(null);
    resetState();
    cleanupDrag();
  }, [getPayload, getPosition, getTarget, activeTargets, resetState, cleanupDrag]);

  const cancelDrag = useCallback(() => {
    activeTargets.set(null);
    resetState();
    cleanupDrag();
  }, [activeTargets, resetState, cleanupDrag]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      autoScrollStop();
      restore();
    };
  }, [autoScrollStop, restore]);

  // The actions value is memoized on dependencies that never change
  // identity, so drop targets consuming it are immune to drag lifecycle
  // updates. The state value deliberately excludes dragPosition (no
  // consumer reads it) and is memoized on the two fields consumers gate
  // on — the provider re-renders on every pointermove for the ghost, and
  // a fresh object here would re-render every consumer per move.
  const actionsValue = useMemo(
    () => ({
      startDrag,
      updateDragPosition,
      endDrag,
      cancelDrag,
      registerDropTarget: register,
      unregisterDropTarget: unregister,
      subscribeActiveTarget: activeTargets.subscribe,
      isActiveTarget: activeTargets.isActive,
      subscribeAny: activeTargets.subscribeAny,
      hasActive: activeTargets.hasActive,
    }),
    [
      startDrag,
      updateDragPosition,
      endDrag,
      cancelDrag,
      register,
      unregister,
      activeTargets,
    ]
  );

  const stateValue = useMemo(
    () => ({ isDragging, dragPayload }),
    [isDragging, dragPayload]
  );

  return (
    <DragDropActionsContext.Provider value={actionsValue}>
      <DragDropStateContext.Provider value={stateValue}>
        {children}
        {isDragging && dragPosition && dragPayload && (
          <DragGhost payload={dragPayload} position={dragPosition} />
        )}
      </DragDropStateContext.Provider>
    </DragDropActionsContext.Provider>
  );
}

// ── Ghost Element ───────────────────────────────────────────────

function DragGhost({
  payload,
  position,
}: {
  payload: import("./drag-drop-types").DragPayload;
  position: import("./drag-drop-types").Position;
}) {
  const { subscribeAny, hasActive } = useDragDropActions();
  const overTarget = useSyncExternalStore(subscribeAny, hasActive, hasActive);
  const ghostContent = renderGhostContent(payload);
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      data-drag-ghost=""
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 99999,
        opacity: overTarget ? 1 : 0.75,
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
