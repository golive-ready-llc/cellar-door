"use client";

import { useMemo, useCallback, useRef, useEffect, useState } from "react";
import { Archive, Package, X, Wine as WineIcon, GripVertical, CheckSquare, Square, Trash2 } from "lucide-react";
import { useTouchDrag } from "@/hooks/use-touch-drag";
import { useDropTarget } from "@/hooks/use-drop-target";
import { useLongPress } from "@/hooks/use-long-press";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WINE_TYPE_COLORS, WINE_TYPE_LABELS } from "@/types/constants";
import { isLightWineType, type Wine, type StorageRow } from "@/types/wine";

interface BulkZoneSideViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storageRow: StorageRow;
  wines: Wine[];
  sectionName: string;
  editable?: boolean;
  onWineClick?: (wine: Wine) => void;
  /** Called on long-press of a wine (opens edit mode) */
  onWineLongPress?: (wine: Wine) => void;
  onWineDrop?: (wineId: string) => void;
  onWineRemove?: (wineId: string) => void;
  /** Called with IDs of wines to batch-remove (consume/delete). */
  onBatchRemove?: (wineIds: string[]) => Promise<void>;
}

export function BulkZoneSideView({
  open,
  onOpenChange,
  storageRow,
  wines,
  sectionName,
  editable = false,
  onWineClick,
  onWineLongPress,
  onWineDrop,
  onWineRemove,
  onBatchRemove,
}: BulkZoneSideViewProps) {
  // Guard against synthesized close on mobile (same fix as DepthSideView)
  const openedAtRef = useRef<number>(0);
  useEffect(() => {
    if (open) openedAtRef.current = Date.now();
  }, [open]);

  // ── Multi-select state ──────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset selection when the sheet closes or wines change
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

  // ── End multi-select state ──────────────────────────────────

  const boxes = storageRow.boxes;
  const hasBoxes = boxes && boxes.length > 0;
  const totalBoxCapacity = hasBoxes
    ? boxes.reduce((sum, b) => sum + b, 0)
    : 0;
  const looseCapacity = storageRow.capacity - totalBoxCapacity;

  // Sort wines by col for col-range-based distribution
  const sortedWines = useMemo(
    () => [...wines].sort((a, b) => (a.col ?? 0) - (b.col ?? 0)),
    [wines]
  );

  // Distribute wines across boxes using col ranges, remainder is loose.
  const boxRanges: { start: number; end: number }[] = hasBoxes
    ? boxes.reduce<{ start: number; end: number }[]>((acc, boxSize) => {
        const prevEnd = acc.length > 0 ? acc[acc.length - 1].end : 0;
        acc.push({ start: prevEnd, end: prevEnd + boxSize });
        return acc;
      }, [])
    : [];
  const boxColOffsets: number[] = boxRanges.map((r) => r.start);
  const boxWineGroups: Wine[][] = boxRanges.map(({ start, end }) =>
    sortedWines.filter((w) => {
      const col = w.col ?? 0;
      return col >= start && col < end;
    })
  );
  const looseWines: Wine[] = hasBoxes
    ? sortedWines.filter((w) => (w.col ?? 0) >= totalBoxCapacity)
    : sortedWines;

  const isFull = wines.length >= storageRow.capacity;
  const fillPct = Math.min(100, Math.round((wines.length / storageRow.capacity) * 100));

  const handleLooseDrop = useCallback(
    (data: string) => {
      if (data && !isFull) onWineDrop?.(data);
    },
    [isFull, onWineDrop]
  );

  const { dropRef: looseDropRef, isOver: isLooseDropTarget } = useDropTarget({
    id: "loose-bottles",
    accepts: ["wine-id"],
    onDrop: handleLooseDrop,
    enabled: editable && !isFull,
  });

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(newOpen) => {
          if (!newOpen && Date.now() - openedAtRef.current < 400) return;
          onOpenChange(newOpen);
        }}
      >
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-muted-foreground" />
              {storageRow.name || "Bulk Storage"}
            </SheetTitle>
            <SheetDescription className="flex items-center justify-between">
              <span>{sectionName}</span>
              {/* Select mode toggle */}
              {wines.length > 0 && (
                <button
                  onClick={() => {
                    if (selectMode) {
                      deselectAll();
                      setSelectMode(false);
                    } else {
                      setSelectMode(true);
                    }
                  }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {selectMode ? "Cancel" : "Select"}
                </button>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">
            {/* Select All / Deselect All bar */}
            {selectMode && (
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5 h-7"
                  onClick={() => {
                    if (selectedIds.size === wines.length) {
                      deselectAll();
                    } else {
                      selectAll();
                    }
                  }}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  {selectedIds.size === wines.length
                    ? "Deselect All"
                    : `Select All (${wines.length})`}
                </Button>
                {selectedIds.size > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.size} selected
                  </span>
                )}
              </div>
            )}

            {/* Capacity bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-semibold">
                  {wines.length} / {storageRow.capacity}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${fillPct}%`,
                    backgroundColor: isFull ? "#ef4444" : fillPct > 80 ? "#f59e0b" : "#22c55e",
                  }}
                />
              </div>
            </div>

            {/* Case boxes */}
            {hasBoxes && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Cases
                </p>
                {boxes.map((boxSize, bi) => {
                  const winesInBox = boxWineGroups[bi] || [];
                  const colOffset = boxColOffsets[bi] ?? 0;
                  return (
                    <CaseBoxCard
                      key={bi}
                      boxIndex={bi}
                      boxSize={boxSize}
                      wines={winesInBox}
                      colOffset={colOffset}
                      editable={editable}
                      selectMode={selectMode}
                      selectedIds={selectedIds}
                      onToggleSelection={toggleSelection}
                      onWineClick={onWineClick}
                      onWineLongPress={onWineLongPress}
                      onWineRemove={onWineRemove}
                      onWineDrop={onWineDrop}
                    />
                  );
                })}
              </div>
            )}

            {/* Loose bottles */}
            {(looseCapacity > 0 || !hasBoxes) && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {hasBoxes ? "Loose Bottles" : "Bottles"}
                </p>
                <div
                  ref={looseDropRef as React.RefObject<HTMLDivElement>}
                  className={cn(
                    "rounded-lg transition-all",
                    isLooseDropTarget && "ring-2 ring-emerald-400/60 bg-emerald-500/10"
                  )}
                >
                  {looseWines.length === 0 ? (
                    <div
                      className={cn(
                        "py-6 text-center rounded-lg border border-dashed transition-colors",
                        isLooseDropTarget
                          ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-600"
                          : "border-border text-muted-foreground/60"
                      )}
                    >
                      <p className="text-xs">
                        {editable
                          ? isLooseDropTarget
                            ? "Drop to add wine"
                            : "Drag wines here to store them"
                          : "No loose bottles"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {looseWines.map((wine) => (
                        <WineCard
                          key={wine.id}
                          wine={wine}
                          editable={editable}
                          selectMode={selectMode}
                          selected={selectedIds.has(wine.id)}
                          onToggleSelection={toggleSelection}
                          onWineClick={onWineClick}
                          onWineLongPress={onWineLongPress}
                          onWineRemove={onWineRemove}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Full indicator */}
            {editable && isFull && (
              <div className="py-3 text-center rounded-lg border border-dashed border-destructive/40 bg-destructive/5">
                <p className="text-xs text-destructive font-medium">
                  Zone is full — remove a wine to make space
                </p>
              </div>
            )}
          </div>

          {/* Batch actions floating bar */}
          {selectMode && selectedIds.size > 0 && (
            <div className="sticky bottom-0 px-4 pb-4 pt-2 bg-card border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{selectedIds.size} selected</span>
                <div className="flex gap-2">
                  <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteConfirmOpen(true)}
          className="hover:bg-destructive/10 gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Batch Remove Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
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
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBatchRemove} disabled={deleting}>
              {deleting ? "Removing..." : "Remove All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// CaseBoxCard — shows a case with its wines
// ============================================================

function CaseBoxCard({
  boxIndex,
  boxSize,
  wines,
  editable,
  selectMode,
  selectedIds,
  onToggleSelection,
  onWineClick,
  onWineLongPress,
  onWineRemove,
  onWineDrop,
}: {
  boxIndex: number;
  boxSize: number;
  wines: Wine[];
  colOffset: number;
  editable?: boolean;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onWineClick?: (wine: Wine) => void;
  onWineLongPress?: (wine: Wine) => void;
  onWineRemove?: (wineId: string) => void;
  onWineDrop?: (wineId: string) => void;
}) {
  const boxIsFull = wines.length >= boxSize;

  const handleBoxDrop = useCallback(
    (data: string) => {
      if (data && !boxIsFull) onWineDrop?.(data);
    },
    [boxIsFull, onWineDrop]
  );

  const { dropRef, isOver: isDropTarget } = useDropTarget({
    id: `case-box-${boxIndex}`,
    accepts: ["wine-id"],
    onDrop: handleBoxDrop,
    enabled: !!editable && !boxIsFull,
  });

  return (
    <div
      ref={dropRef as React.RefObject<HTMLDivElement>}
      className={cn(
        "rounded-lg border bg-card overflow-hidden transition-all",
        isDropTarget
          ? "border-emerald-400/70 ring-2 ring-emerald-400/40"
          : "border-border"
      )}
    >
      {/* Case header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 border-b transition-colors",
          isDropTarget
            ? "bg-emerald-500/15 border-emerald-400/40"
            : "bg-muted/50 border-border"
        )}
      >
        <Package className={cn(
          "h-4 w-4",
          isDropTarget ? "text-emerald-500" : "text-muted-foreground"
        )} />
        <span className="text-xs font-semibold">
          Case {boxIndex + 1}
        </span>
        <span className={cn(
          "text-xs ml-auto",
          isDropTarget ? "text-emerald-600 font-semibold" : "text-muted-foreground"
        )}>
          {wines.length}/{boxSize}
        </span>
      </div>
      {/* Wine list in case */}
      <div className="divide-y divide-border">
        {wines.length === 0 ? (
          <div className={cn(
            "px-3 py-4 text-center text-xs",
            isDropTarget ? "text-emerald-600" : "text-muted-foreground/60"
          )}>
            {isDropTarget ? "Drop wine here" : "Empty case"}
          </div>
        ) : (
          wines.map((wine) => (
            <WineCard
              key={wine.id}
              wine={wine}
              editable={editable}
              selectMode={selectMode}
              selected={selectedIds?.has(wine.id)}
              onToggleSelection={onToggleSelection}
              onWineClick={onWineClick}
              onWineLongPress={onWineLongPress}
              onWineRemove={onWineRemove}
              compact
            />
          ))
        )}
        {/* Empty slot indicators */}
        {wines.length < boxSize && !isDropTarget &&
          Array.from({ length: Math.min(3, boxSize - wines.length) }, (_, i) => (
            <div
              key={`empty-${i}`}
              className="px-3 py-2 text-xs text-muted-foreground/40 italic"
            >
              Empty slot
            </div>
          ))}
        {boxSize - wines.length > 3 && !isDropTarget && (
          <div className="px-3 py-1.5 text-xs text-muted-foreground/40 italic text-center">
            +{boxSize - wines.length - 3} more empty
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// WineCard — single wine row in the side sheet
// ============================================================

function WineCard({
  wine,
  editable,
  selectMode,
  selected,
  onToggleSelection,
  onWineClick,
  onWineLongPress,
  onWineRemove,
  compact,
}: {
  wine: Wine;
  editable?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelection?: (id: string) => void;
  onWineClick?: (wine: Wine) => void;
  onWineLongPress?: (wine: Wine) => void;
  onWineRemove?: (wineId: string) => void;
  compact?: boolean;
}) {
  const typeColor =
    WINE_TYPE_COLORS[wine.type as keyof typeof WINE_TYPE_COLORS] || "#666";
  const typeLabel =
    WINE_TYPE_LABELS[wine.type as keyof typeof WINE_TYPE_LABELS] || wine.type;

  const { isDragging, dragHandleProps } = useTouchDrag({
    type: "wine-id",
    data: wine.id,
    enabled: !!editable && !selectMode,
    ghostColor: typeColor,
    ghostName: wine.name,
  });

  const longPressHandlers = useLongPress({
    onLongPress: () => onWineLongPress?.(wine),
    onPress: () => onWineClick?.(wine),
    ms: 500,
    enabled: !editable && !!onWineLongPress && !selectMode,
  });

  return (
    <div
      role={!editable && !selectMode ? "button" : undefined}
      tabIndex={!editable && !selectMode ? 0 : undefined}
      className={cn(
        "flex items-center gap-3 transition-colors",
        compact ? "px-3 py-2" : "p-3 rounded-lg border border-border bg-card",
        !editable && !selectMode && "cursor-pointer hover:bg-accent/50",
        editable && !selectMode && "cursor-grab active:cursor-grabbing",
        selectMode && "cursor-pointer hover:bg-accent/30",
        isDragging && "opacity-30",
        selected && selectMode && "bg-primary/5"
      )}
      {...(selectMode
        ? { onClick: () => onToggleSelection?.(wine.id) }
        : editable
          ? dragHandleProps
          : onWineLongPress
            ? longPressHandlers
            : {}
      )}
      onClick={
        selectMode
          ? () => onToggleSelection?.(wine.id)
          : !editable && !onWineLongPress
            ? () => onWineClick?.(wine)
            : undefined
      }
      onKeyDown={
        !editable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                if (selectMode) onToggleSelection?.(wine.id);
                else onWineClick?.(wine);
              }
            }
          : undefined
      }
    >
      {/* Select checkbox */}
      {selectMode && (
        <div className="shrink-0">
          {selected ? (
            <CheckSquare className="h-5 w-5 text-primary" />
          ) : (
            <Square className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      )}

      {/* Drag handle in edit mode */}
      {editable && !selectMode && (
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
      )}

      {/* Wine type dot */}
      <div
        className={cn(
          "shrink-0 rounded-full flex items-center justify-center",
          compact ? "w-7 h-7" : "w-9 h-9"
        )}
        style={{ backgroundColor: typeColor }}
      >
        <WineIcon
          className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")}
          style={{ color: isLightWineType(wine.type) ? "#333" : "#fff" }}
        />
      </div>

      {/* Wine info */}
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium truncate", compact ? "text-xs" : "text-sm")}>
          {wine.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {wine.winery}
          {wine.vintage ? ` · ${wine.vintage}` : ""}
        </p>
      </div>

      {/* Type badge */}
      <span
        className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
        style={{
          backgroundColor: typeColor,
          color: isLightWineType(wine.type) ? "#333" : "#fff",
        }}
      >
        {typeLabel}
      </span>

      {/* Remove button in edit mode (hidden in select mode) */}
      {editable && onWineRemove && !selectMode && (
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={(e) => {
            e.stopPropagation();
            onWineRemove(wine.id);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
