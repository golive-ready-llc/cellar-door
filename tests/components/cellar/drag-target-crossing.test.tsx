import { describe, it, expect } from "vitest";
import { render, act, screen } from "@testing-library/react";
import { useCallback, useEffect } from "react";

import {
  DragDropProvider,
  useDragDrop,
} from "@/components/cellar/drag-drop-context";
import { useDropTarget } from "@/hooks/use-drop-target";

/**
 * During a drag, every pointer crossing into a new drop target flips
 * `activeDropTargetId`. The whole wine wall consumes the drag context (every
 * slot registers a drop target and a drag handle), so a context-value change
 * there re-renders the entire wall to move a highlight between exactly two
 * slots. These tests pin the render cost of a crossing: only the slot that
 * gained and the slot that lost the highlight may re-render.
 */

const COLS = 12;
const ROWS = 10;
const CELL = 40;
// Rows start below the top auto-scroll edge zone so no rAF loop kicks in.
const GRID_TOP = 130;
const TARGET_COUNT = COLS * ROWS;
const CROSSINGS = 20;

let targetRenders = 0;

function Target({ id, x, y }: { id: string; x: number; y: number }) {
  const { dropRef, isOver } = useDropTarget({
    id,
    accepts: ["wine-id"],
    onDrop: () => {},
  });
  targetRenders++;
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      dropRef.current = el;
      if (el) {
        el.getBoundingClientRect = () =>
          ({
            left: x,
            top: y,
            right: x + CELL,
            bottom: y + CELL,
            width: CELL,
            height: CELL,
            x,
            y,
            toJSON: () => ({}),
          }) as DOMRect;
      }
    },
    [dropRef, x, y]
  );
  return <div ref={setRef} data-testid={id} data-isover={isOver ? "1" : "0"} />;
}

function pointForIndex(i: number) {
  return {
    x: (i % COLS) * CELL + CELL / 2,
    y: GRID_TOP + Math.floor(i / COLS) * CELL + CELL / 2,
  };
}

function ApiProbe({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useDragDrop>) => void;
}) {
  const ctx = useDragDrop();
  useEffect(() => {
    onReady(ctx);
  }, [ctx, onReady]);
  return null;
}

describe("drop-target crossing render cost", () => {
  it("re-renders only the two slots a crossing touches, not the whole wall", () => {
    const captured: { current: ReturnType<typeof useDragDrop> | null } = {
      current: null,
    };
    targetRenders = 0;
    render(
      <DragDropProvider>
        <ApiProbe
          onReady={(api) => {
            captured.current = api;
          }}
        />
        {Array.from({ length: TARGET_COUNT }, (_, i) => (
          <Target
            key={i}
            id={`target-${i}`}
            x={(i % COLS) * CELL}
            y={GRID_TOP + Math.floor(i / COLS) * CELL}
          />
        ))}
      </DragDropProvider>
    );
    const api = captured.current!;
    expect(targetRenders).toBe(TARGET_COUNT);

    act(() => {
      api.startDrag({ type: "wine-id", data: "w1" }, pointForIndex(0));
    });
    // startDrag does not hit-test — the first move resolves the target.
    act(() => {
      api.updateDragPosition(pointForIndex(0));
    });
    expect(screen.getByTestId("target-0").dataset.isover).toBe("1");
    const baseline = targetRenders;

    for (let i = 1; i <= CROSSINGS; i++) {
      act(() => {
        api.updateDragPosition(pointForIndex(i));
      });
    }
    const crossingRenders = targetRenders - baseline;

    // Highlight followed the pointer and the previous slot released it.
    expect(screen.getByTestId(`target-${CROSSINGS}`).dataset.isover).toBe("1");
    expect(screen.getByTestId(`target-${CROSSINGS - 1}`).dataset.isover).toBe(
      "0"
    );

    // Each crossing may re-render at most the slot that gained the highlight
    // and the slot that lost it. Before this was fixed, every one of the
    // TARGET_COUNT consumers re-rendered on every crossing.
    expect(crossingRenders).toBeLessThanOrEqual(2 * CROSSINGS);
  });
});
