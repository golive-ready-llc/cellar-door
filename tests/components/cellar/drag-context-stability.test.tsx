import { describe, it, expect } from "vitest";
import { render, act } from "@testing-library/react";

import {
  DragDropProvider,
  useDragDrop,
} from "@/components/cellar/drag-drop-context";

/**
 * The provider re-renders on every pointermove (dragPosition lives in its
 * state), but the context value must NOT change while the pointer moves:
 * every wine slot's drag handle and every drop zone consumes this context,
 * and a fresh value per move re-rendered all of them at pointer-move
 * frequency. These tests pin the value identity and the consumer render
 * counts across a simulated drag, and that the ghost still follows the
 * pointer.
 */

let consumerRenders = 0;

function Probe({ captured }: { captured: { current: ReturnType<typeof useDragDrop> | null } }) {
  const ctx = useDragDrop();
  captured.current = ctx;
  consumerRenders++;
  return null;
}

type Ctx = ReturnType<typeof useDragDrop>;

function renderProbe() {
  const captured: { current: Ctx | null } = { current: null };
  consumerRenders = 0;
  const utils = render(
    <DragDropProvider>
      <Probe captured={captured} />
    </DragDropProvider>
  );
  return { captured, ...utils };
}

describe("DragDropProvider context stability during a drag", () => {
  it("keeps the context value identical across pointermove updates", () => {
    const { captured } = renderProbe();
    const api = captured.current!;
    expect(api).not.toBeNull();
    expect(consumerRenders).toBe(1);

    const valueBefore = api;

    act(() => {
      api.startDrag({ type: "wine-id", data: "w1" }, { x: 10, y: 10 });
    });
    // A drag starting legitimately re-renders consumers (isDragging flips)
    expect(consumerRenders).toBe(2);
    const valueDuringDrag = captured.current!;
    expect(valueDuringDrag).not.toBe(valueBefore);
    expect(valueDuringDrag.isDragging).toBe(true);

    for (let i = 0; i < 10; i++) {
      act(() => {
        api.updateDragPosition({ x: 10 + i, y: 10 + i });
      });
    }
    // Position changes must not touch the context: same value, no re-render
    expect(consumerRenders).toBe(2);
    expect(captured.current).toBe(valueDuringDrag);

    act(() => {
      api.endDrag();
    });
    expect(consumerRenders).toBe(3);
    expect(captured.current!.isDragging).toBe(false);
  });

  it("moves the drag ghost to the latest pointer position", () => {
    const { captured } = renderProbe();
    const api = captured.current!;

    act(() => {
      api.startDrag({ type: "wine-id", data: "w1" }, { x: 10, y: 10 });
    });
    const ghost = document.body.querySelector("[data-drag-ghost]") as HTMLElement | null;
    expect(ghost).not.toBeNull();
    expect(ghost!.style.left).toBe("10px");
    expect(ghost!.style.top).toBe("10px");

    act(() => {
      api.updateDragPosition({ x: 123, y: 77 });
    });
    expect(ghost!.style.left).toBe("123px");
    expect(ghost!.style.top).toBe("77px");

    act(() => {
      api.endDrag();
    });
    expect(document.body.querySelector("[data-drag-ghost]")).toBeNull();
  });
});
