"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckSquare, Square, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Wine } from "@/types/wine";

/**
 * Shared multi-select + batch-remove flow for the cellar drill-down sheets
 * (BulkZoneSideView, DepthSideView). Both sheets grew identical copies of
 * this state machine and its four UI blocks; they now share one, so a fix
 * to one view's selection behavior reaches the other.
 */

export function useBatchSelection(
  wines: Wine[],
  open: boolean,
  onBatchRemove?: (wineIds: string[]) => Promise<void>
) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset selection when the sheet closes
  useEffect(() => {
    if (!open) {
      setSelectMode(false);
      setSelectedIds(new Set());
    }
  }, [open]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(wines.map((w) => w.id)));
  }, [wines]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const enterSelectMode = useCallback(() => setSelectMode(true), []);

  const exitSelectMode = useCallback(() => {
    setSelectedIds(new Set());
    setSelectMode(false);
  }, []);

  const handleBatchRemove = useCallback(async () => {
    if (!onBatchRemove || selectedIds.size === 0) return;
    setDeleting(true);
    try {
      await onBatchRemove(Array.from(selectedIds));
      setDeleteConfirmOpen(false);
      setSelectMode(false);
      setSelectedIds(new Set());
    } finally {
      setDeleting(false);
    }
  }, [onBatchRemove, selectedIds]);

  return {
    selectMode,
    selectedIds,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    deleting,
    toggleSelection,
    selectAll,
    deselectAll,
    enterSelectMode,
    exitSelectMode,
    openDeleteConfirm: useCallback(() => setDeleteConfirmOpen(true), []),
    handleBatchRemove,
  };
}

export type BatchSelection = ReturnType<typeof useBatchSelection>;

/** Header "Select"/"Cancel" link; hidden when there is nothing to select. */
export function SelectModeToggle({
  wines,
  selection,
}: {
  wines: Wine[];
  selection: BatchSelection;
}) {
  if (wines.length === 0) return null;
  return (
    <button
      onClick={() =>
        selection.selectMode ? selection.exitSelectMode() : selection.enterSelectMode()
      }
      className="text-xs font-medium text-primary hover:underline"
    >
      {selection.selectMode ? "Cancel" : "Select"}
    </button>
  );
}

/** Select All / Deselect All row shown while in select mode. */
export function SelectAllBar({
  wines,
  selection,
}: {
  wines: Wine[];
  selection: BatchSelection;
}) {
  if (!selection.selectMode) return null;
  const allSelected = selection.selectedIds.size === wines.length;
  return (
    <div className="flex items-center gap-2 pt-1">
      <Button
        variant="ghost"
        size="sm"
        className="text-xs gap-1.5 h-7"
        onClick={() => (allSelected ? selection.deselectAll() : selection.selectAll())}
      >
        <CheckSquare className="h-3.5 w-3.5" />
        {allSelected ? "Deselect All" : `Select All (${wines.length})`}
      </Button>
      {selection.selectedIds.size > 0 && (
        <span className="text-xs text-muted-foreground">
          {selection.selectedIds.size} selected
        </span>
      )}
    </div>
  );
}

/** Sticky bar with the batch Remove action; needs at least one selection. */
export function BatchRemoveBar({ selection }: { selection: BatchSelection }) {
  if (!selection.selectMode || selection.selectedIds.size === 0) return null;
  return (
    <div className="sticky bottom-0 px-4 pb-4 pt-2 bg-card border-t border-border">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{selection.selectedIds.size} selected</span>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={selection.openDeleteConfirm}
            className="hover:bg-destructive/10 gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Confirmation dialog listing the selected wines before removal. */
export function BatchRemoveDialog({
  wines,
  selection,
}: {
  wines: Wine[];
  selection: BatchSelection;
}) {
  const { selectedIds, deleting } = selection;
  return (
    <Dialog
      open={selection.deleteConfirmOpen}
      onOpenChange={selection.setDeleteConfirmOpen}
    >
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Remove {selectedIds.size} Wines
          </DialogTitle>
          <DialogDescription>
            This will remove selected wines from your cellar and move them to
            your history. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 max-h-48 overflow-y-auto space-y-1">
          {wines
            .filter((w) => selectedIds.has(w.id))
            .map((wine) => (
              <div
                key={wine.id}
                className="text-sm text-muted-foreground truncate"
              >
                {wine.name}
                {wine.vintage ? ` (${wine.vintage})` : ""}
              </div>
            ))}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => selection.setDeleteConfirmOpen(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={selection.handleBatchRemove}
            disabled={deleting}
          >
            {deleting ? "Removing..." : "Remove All"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
