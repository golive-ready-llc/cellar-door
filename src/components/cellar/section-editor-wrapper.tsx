"use client";

import { useState } from "react";
import { GripVertical, Trash2, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEditMode } from "./edit-mode-context";
import { useTouchDrag } from "@/hooks/use-touch-drag";
import type { ReactNode } from "react";

interface SectionEditorWrapperProps {
  sectionId: string;
  children: ReactNode;
  /** Number of wines that would be unassigned if grid shrinks */
  outOfBoundsCount?: number;
}

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export function SectionEditorWrapper({
  sectionId,
  children,
  outOfBoundsCount = 0,
}: SectionEditorWrapperProps) {
  const {
    selectedSectionId,
    selectSection,
    updateDraft,
    removeDraft,
    draftSections,
  } = useEditMode();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { isDragging, dragHandleProps } = useTouchDrag({
    type: "section-id",
    data: sectionId,
  });

  const isSelected = selectedSectionId === sectionId;
  const draft = draftSections.find((s) => s.id === sectionId);

  if (!draft) return null;

  const adjustSize = (axis: "row" | "col", delta: number) => {
    const newRows = axis === "row" ? clamp(draft.rows + delta, 1, 20) : draft.rows;
    const newCols = axis === "col" ? clamp(draft.cols + delta, 1, 20) : draft.cols;

    // Filter storage rows that would be beyond new row count
    const filteredStorage = draft.storageRows.filter(
      (sr) => sr.row < newRows
    );

    updateDraft(sectionId, {
      rows: newRows,
      cols: newCols,
      storageRows: filteredStorage,
    });

    // Select this section when adjusting
    if (!isSelected) selectSection(sectionId);
  };

  return (
    <div
      className={cn(
        "relative group/editor transition-all inline-block",
        isSelected && "ring-2 ring-primary rounded-xl mx-12 mb-14",
        !isSelected && "mx-2",
        isDragging && "opacity-50"
      )}
      onClick={(e) => {
        e.stopPropagation();
        selectSection(sectionId);
      }}
    >
      {/* Drag handle for reorder */}
      <div
        {...dragHandleProps}
        className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 cursor-grab active:cursor-grabbing bg-card border border-border rounded-full p-1 shadow-sm opacity-0 group-hover/editor:opacity-100 transition-opacity"
        style={dragHandleProps.style}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {/* Delete button */}
      <div className="absolute -top-3 -right-3 z-20 opacity-0 group-hover/editor:opacity-100 transition-opacity">
        {showDeleteConfirm ? (
          <div className="flex items-center gap-1 bg-card border border-destructive rounded-lg px-2 py-1 shadow-md">
            <span className="text-xs text-destructive font-medium">
              Delete?
            </span>
            <Button
              size="icon"
              variant="destructive"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation();
                removeDraft(sectionId);
                setShowDeleteConfirm(false);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(false);
              }}
            >
              <span className="text-xs">✕</span>
            </Button>
          </div>
        ) : (
          <Button
            size="icon"
            variant="outline"
            className="h-6 w-6 rounded-full bg-card hover:bg-destructive hover:text-destructive-foreground shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* ========= +/- Resize Controls ========= */}

      {/* Column controls — left side */}
      {isSelected && (
        <div className="absolute top-1/2 -left-11 -translate-y-1/2 z-20 flex flex-col items-center gap-1">
          <button
            type="button"
            className="h-9 w-9 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-[0_0_10px_2px] shadow-primary/50 hover:shadow-[0_0_14px_4px] hover:shadow-primary/60 hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-30 disabled:shadow-none text-sm font-bold"
            onClick={(e) => { e.stopPropagation(); adjustSize("col", 1); }}
            disabled={draft.cols >= 20}
            aria-label="Add column"
          >
            <Plus className="h-4 w-4" />
          </button>
          <span className="text-xs font-bold text-foreground bg-card border border-border rounded-full min-w-[1.5rem] text-center py-0.5 shadow-sm">{draft.cols}</span>
          <button
            type="button"
            className="h-9 w-9 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-[0_0_10px_2px] shadow-primary/50 hover:shadow-[0_0_14px_4px] hover:shadow-primary/60 hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-30 disabled:shadow-none text-sm font-bold"
            onClick={(e) => { e.stopPropagation(); adjustSize("col", -1); }}
            disabled={draft.cols <= 1}
            aria-label="Remove column"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Row controls — bottom */}
      {isSelected && (
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1">
          <button
            type="button"
            className="h-9 w-9 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-[0_0_10px_2px] shadow-primary/50 hover:shadow-[0_0_14px_4px] hover:shadow-primary/60 hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-30 disabled:shadow-none text-sm font-bold"
            onClick={(e) => { e.stopPropagation(); adjustSize("row", -1); }}
            disabled={draft.rows <= 1}
            aria-label="Remove row"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="text-xs font-bold text-foreground bg-card border border-border rounded-full min-w-[1.5rem] text-center py-0.5 shadow-sm">{draft.rows}</span>
          <button
            type="button"
            className="h-9 w-9 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-[0_0_10px_2px] shadow-primary/50 hover:shadow-[0_0_14px_4px] hover:shadow-primary/60 hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-30 disabled:shadow-none text-sm font-bold"
            onClick={(e) => { e.stopPropagation(); adjustSize("row", 1); }}
            disabled={draft.rows >= 20}
            aria-label="Add row"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      {children}

      {/* Out of bounds warning */}
      {outOfBoundsCount > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1 px-2">
          {"\u26A0"} Shrinking will unassign {outOfBoundsCount} wine
          {outOfBoundsCount !== 1 ? "s" : ""} outside new bounds
        </p>
      )}
    </div>
  );
}
