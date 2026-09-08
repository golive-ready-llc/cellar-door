"use client";

import { Check, X, Pencil } from "lucide-react";

interface FloatingModeIndicatorProps {
  moveMode: boolean;
  editMode: boolean;
  saving: boolean;
  onExitMoveMode: () => void;
  onSaveEditMode: () => void;
  onShowDiscardConfirm: (show: boolean) => void;
}

export function FloatingModeIndicator({
  moveMode,
  editMode,
  saving,
  onExitMoveMode,
  onSaveEditMode,
  onShowDiscardConfirm,
}: FloatingModeIndicatorProps) {
  if (!moveMode && !editMode) return null;

  return (
    <div className="fixed bottom-[4.5rem] md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-2xl shadow-black/40 px-4 py-2 text-sm font-semibold whitespace-nowrap animate-in fade-in slide-in-from-bottom-4 duration-200 border border-slate-700 dark:border-slate-300">
      {moveMode && (
        <>
          <span className="animate-pulse">{"\u21C4"}</span>
          Move Mode
          <button
            type="button"
            onClick={onExitMoveMode}
            className="ml-1 rounded-full p-0.5 hover:bg-primary-foreground/20 transition-colors"
            aria-label="Done moving"
          >
            <Check className="h-4 w-4" />
          </button>
        </>
      )}
      {editMode && (
        <>
          <Pencil className="h-3.5 w-3.5" />
          Edit Mode
          <div className="flex items-center gap-2 ml-1">
            <button
              type="button"
              onClick={onSaveEditMode}
              disabled={saving}
              className="rounded-full p-1.5 hover:bg-green-500/30 active:bg-green-500/50 transition-colors"
              aria-label="Save layout"
            >
              <Check className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onShowDiscardConfirm(true)}
              disabled={saving}
              className="rounded-full p-1.5 hover:bg-red-500/30 active:bg-red-500/50 transition-colors"
              aria-label="Cancel editing"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
