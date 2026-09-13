import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { DragDropProvider, useDragDrop } from "@/components/cellar/drag-drop-context";
import { useTouchDrag } from "@/hooks/use-touch-drag";

/**
 * pointercancel is what the browser fires when it takes over a gesture
 * (scroll, notification pull-down, incoming call sheet). Before the cancel
 * path ended active drags, the context stayed isDragging forever — the ghost
 * froze and every later pointerdown bailed at the contextIsDragging guard
 * until a reload.
 */

function DragHarness({
  onDragStart,
  onDragEnd,
  onTap,
}: {
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onTap?: () => void;
}) {
  const { isDragging: contextDragging } = useDragDrop();
  const { isDragging, dragHandleProps } = useTouchDrag({
    type: "wine-id",
    data: "wine-1",
    onDragStart,
    onDragEnd,
    onTap,
  });
  return (
    <div
      role="button"
      aria-label="drag handle"
      data-context={String(contextDragging)}
      data-local={String(isDragging)}
      {...dragHandleProps}
    />
  );
}

function renderHarness(handlers: Parameters<typeof DragHarness>[0]) {
  const utils = render(
    <DragDropProvider>
      <DragHarness {...handlers} />
    </DragDropProvider>
  );
  return { handle: screen.getByLabelText("drag handle"), ...utils };
}

function pointerDown(handle: HTMLElement, pointerId: number) {
  fireEvent.pointerDown(handle, {
    button: 0,
    pointerId,
    pointerType: "mouse",
    clientX: 10,
    clientY: 10,
  });
}

function windowPointerMove(x: number, y: number) {
  fireEvent(window, new MouseEvent("pointermove", { clientX: x, clientY: y }));
}

describe("useTouchDrag pointercancel", () => {
  it("ends an active drag and allows a new one to start", () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    const onTap = vi.fn();
    const { handle } = renderHarness({ onDragStart, onDragEnd, onTap });

    pointerDown(handle, 1);
    windowPointerMove(30, 12);
    expect(handle).toHaveAttribute("data-context", "true");
    expect(handle).toHaveAttribute("data-local", "true");
    expect(onDragStart).toHaveBeenCalledTimes(1);

    fireEvent(window, new Event("pointercancel"));
    expect(handle).toHaveAttribute("data-context", "false");
    expect(handle).toHaveAttribute("data-local", "false");
    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(onTap).not.toHaveBeenCalled();

    // The regression: a cancelled drag used to wedge the context, so this
    // second drag never started.
    pointerDown(handle, 2);
    windowPointerMove(40, 10);
    expect(handle).toHaveAttribute("data-context", "true");
    expect(onDragStart).toHaveBeenCalledTimes(2);
  });

  it("fires neither onTap nor onDragEnd when no drag was active", () => {
    const onDragEnd = vi.fn();
    const onTap = vi.fn();
    const { handle } = renderHarness({ onDragEnd, onTap });

    pointerDown(handle, 1);
    fireEvent(window, new Event("pointercancel"));
    expect(handle).toHaveAttribute("data-context", "false");
    expect(onDragEnd).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });
});
