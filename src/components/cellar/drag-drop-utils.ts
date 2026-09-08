import type { DragPayload, DropTargetInfo } from "./drag-drop-types";

/**
 * Hit-test all registered drop targets against a pointer position.
 * Uses bounding-rect hit-testing instead of elementFromPoint to avoid
 * issues with z-index layers, overlays, and overflow:hidden during drag.
 * When multiple targets overlap, picks the smallest (most specific) one.
 */
export function findDropTargetAtPoint(
  targets: Map<string, DropTargetInfo>,
  x: number,
  y: number,
  payload: DragPayload
): string | null {
  let bestId: string | null = null;
  let bestArea = Infinity;

  for (const [id, info] of targets) {
    if (!info.accepts.includes(payload.type)) continue;
    if (!info.element.isConnected) continue;

    const rect = info.element.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      const area = rect.width * rect.height;
      if (area < bestArea) {
        bestArea = area;
        bestId = id;
      }
    }
  }

  return bestId;
}

// px from edge where scrolling starts. Generous because on a tall phone the
// bottom band is partly covered by the nav bar / mode indicator, and a 70px
// target was hard to hold a finger inside while dragging.
const EDGE_ZONE = 110;
const MAX_SPEED = 12; // max px per frame

/**
 * Calculate auto-scroll speed based on pointer proximity to viewport edges.
 * Returns negative for up, positive for down, 0 for no scroll.
 */
export function computeEdgeScrollSpeed(y: number): number {
  const vh = window.innerHeight;

  if (y < EDGE_ZONE) {
    // Near top -- scroll up (negative)
    const intensity = 1 - y / EDGE_ZONE;
    return -Math.round(MAX_SPEED * intensity);
  }

  if (y > vh - EDGE_ZONE) {
    // Near bottom -- scroll down (positive)
    const intensity = 1 - (vh - y) / EDGE_ZONE;
    return Math.round(MAX_SPEED * intensity);
  }

  return 0;
}
