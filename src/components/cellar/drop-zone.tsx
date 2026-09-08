"use client";

import { cn } from "@/lib/utils";
import { useDragDrop } from "@/components/cellar/drag-drop-context";
import { useDropTarget } from "@/hooks/use-drop-target";
import type { DragType } from "@/components/cellar/drag-drop-types";

interface DropZoneProps {
  index: number;
  onDropTemplate: (index: number, data: string) => void;
  onDropReorder: (fromId: string, toIndex: number) => void;
  className?: string;
}

const COMPATIBLE_TYPES: DragType[] = ["template", "section-id"];

export function DropZone({
  index,
  onDropTemplate,
  onDropReorder,
  className,
}: DropZoneProps) {
  const { isDragging, dragPayload } = useDragDrop();
  const { dropRef, isOver } = useDropTarget({
    id: `dropzone-${index}`,
    accepts: COMPATIBLE_TYPES,
    onDrop: (data) => {
      if (dragPayload?.type === "template") {
        onDropTemplate(index, data);
      } else if (dragPayload?.type === "section-id") {
        onDropReorder(data, index);
      }
    },
  });

  // Three states: idle (no drag), active (compatible drag in progress), over (hovering this zone)
  const isActiveDrag =
    isDragging &&
    dragPayload != null &&
    COMPATIBLE_TYPES.includes(dragPayload.type);

  return (
    <div
      ref={dropRef as React.RefObject<HTMLDivElement>}
      className={cn(
        "transition-all duration-200 rounded-lg self-stretch flex items-center justify-center",
        isOver
          ? "w-16 border-2 border-dashed border-primary bg-primary/10"
          : isActiveDrag
            ? "w-8 border border-dashed border-muted-foreground/40 bg-muted/20"
            : "w-1",
        className
      )}
    >
      {isOver && (
        <span className="text-xs font-medium text-primary whitespace-nowrap [writing-mode:vertical-lr] rotate-180">
          Drop here
        </span>
      )}
      {!isOver && isActiveDrag && (
        <span className="text-[10px] text-muted-foreground/60">
          ＋
        </span>
      )}
    </div>
  );
}
