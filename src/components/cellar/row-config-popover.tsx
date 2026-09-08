"use client";

import { useEffect, useRef, useState } from "react";
import { Grid3X3, Archive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Stepper } from "./stepper";
import { CASE_SIZES, BOTTLE_SIZE_SHORT } from "@/types/constants";
import type { StorageRow, BottleSize } from "@/types/wine";
import { BOTTLE_SIZE_ORDER } from "@/types/wine";
import { cn } from "@/lib/utils";

interface RowConfigPopoverProps {
  rowIndex: number;
  currentType: "slots" | "bulk";
  storageRow?: StorageRow;
  cols: number;
  depth: number;
  onChangeType: (type: "slots" | "bulk") => void;
  onUpdateStorageRow: (updates: Partial<StorageRow>) => void;
  /** Max bottle size this row's slots accept (slot rows only). */
  rowMaxSize?: BottleSize;
  onChangeRowMaxSize?: (maxSize: BottleSize) => void;
  onClose: () => void;
  /** Anchor element to position near */
  anchorRect?: DOMRect | null;
}

function computePosition(anchorRect: DOMRect | null | undefined): React.CSSProperties {
  if (!anchorRect) return {};

  const popoverWidth = 260;
  const popoverHeight = 200;
  const pad = 8;

  // Try positioning to the right of the badge
  let left = anchorRect.right + pad;
  // If it would overflow the right edge, position to the left of the badge
  if (left + popoverWidth > window.innerWidth - pad) {
    left = Math.max(pad, anchorRect.left - popoverWidth - pad);
  }

  // Try positioning below the badge top
  let top = anchorRect.top;
  // If it would overflow the bottom, push it up
  if (top + popoverHeight > window.innerHeight - pad) {
    top = Math.max(pad, window.innerHeight - popoverHeight - pad);
  }
  // Ensure it's not above viewport
  top = Math.max(pad, top);

  return { top, left };
}

export function RowConfigPopover({
  rowIndex,
  currentType,
  storageRow,
  cols,
  depth,
  onChangeType,
  onUpdateStorageRow,
  rowMaxSize = "standard",
  onChangeRowMaxSize,
  onClose,
  anchorRect,
}: RowConfigPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<React.CSSProperties>(() =>
    computePosition(anchorRect)
  );

  // Recompute position after mount to account for actual popover size
  useEffect(() => {
    if (!ref.current || !anchorRect) return;
    const rect = ref.current.getBoundingClientRect();
    const pad = 8;

    let left = anchorRect.right + pad;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, anchorRect.left - rect.width - pad);
    }

    let top = anchorRect.top;
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    top = Math.max(pad, top);

    setPosition({ top, left });
  }, [anchorRect]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // delay attaching to avoid closing from the same click that opened
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  const boxes = storageRow?.boxes || [];
  const totalBoxCapacity = boxes.reduce((sum, b) => sum + b, 0);
  const looseCapacity = (storageRow?.capacity || 0) - totalBoxCapacity;

  const addCase = (size: number) => {
    const newBoxes = [...boxes, size];
    const newTotalBoxCap = newBoxes.reduce((s, b) => s + b, 0);
    onUpdateStorageRow({
      boxes: newBoxes,
      capacity: Math.max(storageRow?.capacity || 0, newTotalBoxCap),
    });
  };

  const removeCase = (idx: number) => {
    const newBoxes = boxes.filter((_, i) => i !== idx);
    onUpdateStorageRow({
      boxes: newBoxes.length > 0 ? newBoxes : undefined,
      capacity: storageRow?.capacity || 20,
    });
  };

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg p-3 space-y-2.5 min-w-[240px] animate-in fade-in zoom-in-95 duration-150"
      style={position}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Row label + type toggle buttons */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground shrink-0">
          Row {rowIndex + 1}
        </span>
        <div className="flex rounded-md border border-border overflow-hidden">
          <button
            type="button"
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors",
              currentType === "slots"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
            onClick={() => onChangeType("slots")}
          >
            <Grid3X3 className="h-3 w-3" />
            Slots
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors border-l border-border",
              currentType === "bulk"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
            onClick={() => onChangeType("bulk")}
          >
            <Archive className="h-3 w-3" />
            Bulk
          </button>
        </div>
      </div>

      {/* Slots info */}
      {currentType === "slots" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {cols} columns x {depth} deep = {cols * depth} bottles
          </p>
          {/* Max bottle size — the Sort Assistant only routes bottles into
              rows that fit them (magnums need magnum/large rows). */}
          {onChangeRowMaxSize && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Fits up to
              </span>
              <div className="flex gap-1">
                {BOTTLE_SIZE_ORDER.filter((s) => s !== "half").map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={cn(
                      "h-6 px-2 flex items-center justify-center text-xs border rounded transition-colors",
                      rowMaxSize === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                    onClick={() => onChangeRowMaxSize(s)}
                  >
                    {BOTTLE_SIZE_SHORT[s]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk config */}
      {currentType === "bulk" && storageRow && (
        <div className="space-y-2">
          {/* Name */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Name</span>
            <Input
              value={storageRow.name}
              onChange={(e) => onUpdateStorageRow({ name: e.target.value })}
              className="h-7 text-xs"
              placeholder="Bulk Storage"
            />
          </div>

          {/* Total capacity */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">
              Capacity
            </span>
            <Stepper
              value={storageRow.capacity}
              min={Math.max(1, totalBoxCapacity)}
              max={100}
              size="sm"
              onChange={(capacity) => onUpdateStorageRow({ capacity })}
            />
          </div>

          {/* Cases section */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Cases
            </span>
            {boxes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {boxes.map((size, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs"
                  >
                    <span className="font-medium">{size}-pk</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                      onClick={() => removeCase(idx)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/70">
                No cases — add one below
              </p>
            )}

            {/* Add case buttons */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0">Add:</span>
              {CASE_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className="h-6 px-2 flex items-center justify-center text-xs border rounded hover:bg-muted transition-colors"
                  onClick={() => addCase(size)}
                >
                  {size}-pk
                </button>
              ))}
            </div>

            {/* Capacity breakdown */}
            {boxes.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Cases: {totalBoxCapacity} + Loose: {Math.max(0, looseCapacity)} ={" "}
                {storageRow.capacity} total
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
