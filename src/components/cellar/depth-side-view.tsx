"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Wine as WineIcon, ArrowRight, Layers, Plus, CheckSquare, Square, Trash2 } from "lucide-react";
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
import { isLightWineType, type Wine } from "@/types/wine";
import { useLongPress } from "@/hooks/use-long-press";

interface DepthSideViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Row index (0-based) */
  row: number;
  /** Column index (0-based) */
  col: number;
  /** Max depth of the cabinet */
  depth: number;
  /** Wines at this (row, col) position across all depths */
  wines: Wine[];
  /** Cabinet/section name for context */
  sectionName: string;
  /** Called when a wine is clicked to view details */
  onWineClick?: (wine: Wine) => void;
  /** Called on long-press of a wine (opens edit mode) */
  onWineLongPress?: (wine: Wine) => void;
  /** Called when an empty slot is clicked */
  onEmptySlotClick?: () => void;
  /** Called with IDs of wines to batch-remove (consume/delete). */
  onBatchRemove?: (wineIds: string[]) => Promise<void>;
}

export function DepthSideView({
  open,
  onOpenChange,
  row,
  col,
  depth,
  wines,
  sectionName,
  onWineClick,
  onWineLongPress,
  onEmptySlotClick,
  onBatchRemove,
}: DepthSideViewProps) {
  const openedAtRef = useRef<number>(0);
  useEffect(() => {
    if (open) openedAtRef.current = Date.now();
  }, [open]);

  // ── Multi-select state ──────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const sortedWines = [...wines].sort((a, b) => a.depth - b.depth);
  const wineByDepth = new Map<number, Wine>();
  for (const wine of sortedWines) {
    wineByDepth.set(wine.depth, wine);
  }

  const depthLabel = (d: number) => {
    if (depth === 2) return d === 0 ? "Front" : "Back";
    if (d === 0) return "Front";
    if (d === depth - 1) return "Back";
    return `Layer ${d + 1}`;
  };

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
              <Layers className="h-5 w-5 text-muted-foreground" />
              Depth View
            </SheetTitle>
            <SheetDescription className="flex items-center justify-between">
              <span>
                {sectionName} — Row {row + 1}, Column {col + 1}
              </span>
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

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
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

            {/* Cross-section illustration */}
            <CrossSectionDiagram
              depth={depth}
              wineByDepth={wineByDepth}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelection={toggleSelection}
            />

            {/* Depth layers list */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Bottles at this position
              </p>
              {Array.from({ length: depth }, (_, d) => {
                const wine = wineByDepth.get(d);
                return (
                  <DepthLayerCard
                    key={d}
                    depthIndex={d}
                    label={depthLabel(d)}
                    wine={wine}
                    selectMode={selectMode}
                    selected={!!(wine && selectedIds.has(wine.id))}
                    onToggleSelection={() => wine && toggleSelection(wine.id)}
                    onWineClick={onWineClick}
                    onWineLongPress={onWineLongPress}
                    onEmptyClick={onEmptySlotClick}
                  />
                );
              })}
            </div>

            {/* Summary */}
            <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
              {wines.length} of {depth} positions filled
            </div>
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
// Cross-section diagram — visual side view of the rack slot
// ============================================================

function CrossSectionDiagram({
  depth,
  wineByDepth,
  selectMode,
  selectedIds,
  onToggleSelection,
}: {
  depth: number;
  wineByDepth: Map<number, Wine>;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Side-view label */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Front</span>
        <ArrowRight className="h-3 w-3" />
        <span>Back</span>
      </div>

      {/* The cross-section */}
      <div
        className="flex items-center gap-1 p-3 rounded-lg w-full justify-center"
        style={{
          background: `linear-gradient(180deg, var(--rack-interior-from, #0d1b3e) 0%, var(--rack-interior-to, #1a2744) 100%)`,
        }}
      >
        {Array.from({ length: depth }, (_, d) => {
          const wine = wineByDepth.get(d);
          const bgColor = wine
            ? WINE_TYPE_COLORS[wine.type as keyof typeof WINE_TYPE_COLORS] || "#666"
            : undefined;
          const isSelected = wine && selectedIds?.has(wine.id);

          return (
            <div
              key={d}
              className="flex flex-col items-center gap-1"
              onClick={
                selectMode && wine
                  ? () => onToggleSelection?.(wine.id)
                  : undefined
              }
            >
              {/* Bottle circle */}
              <div
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-transform",
                  wine
                    ? selectMode
                      ? "cursor-pointer"
                      : "cursor-pointer hover:scale-110"
                    : "border border-dashed border-white/20",
                  isSelected && "ring-2 ring-white scale-110"
                )}
                style={
                  wine
                    ? {
                        backgroundColor: bgColor,
                        border: "2px solid rgba(255,255,255,0.4)",
                        boxShadow:
                          "0 2px 8px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.3)",
                      }
                    : { backgroundColor: "rgba(255,255,255,0.05)" }
                }
              >
                {wine ? (
                  selectMode ? (
                    isSelected ? (
                      <CheckSquare className="h-5 w-5 text-white" />
                    ) : (
                      <Square className="h-5 w-5 text-white/60" />
                    )
                  ) : (
                    <WineIcon
                      className="h-5 w-5"
                      style={{ color: isLightWineType(wine.type) ? "#333" : "#fff" }}
                    />
                  )
                ) : (
                  <span className="text-[10px] text-white/30">Empty</span>
                )}
              </div>
              {/* Depth label */}
              <span className="text-[10px] text-white/50">
                {d === 0 ? "F" : d === depth - 1 ? "B" : d + 1}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// DepthLayerCard — one layer showing wine details or empty state
// ============================================================

function DepthLayerCard({
  label,
  wine,
  selectMode,
  selected,
  onToggleSelection,
  onWineClick,
  onWineLongPress,
  onEmptyClick,
}: {
  depthIndex: number;
  label: string;
  wine: Wine | undefined;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelection?: () => void;
  onWineClick?: (wine: Wine) => void;
  onWineLongPress?: (wine: Wine) => void;
  onEmptyClick?: () => void;
}) {
  const longPressHandlers = useLongPress({
    onLongPress: () => wine && onWineLongPress?.(wine),
    onPress: () => wine && onWineClick?.(wine),
    ms: 500,
    enabled: !!wine && !!onWineLongPress && !selectMode,
  });

  if (!wine) {
    return (
      <div
        role={onEmptyClick ? "button" : undefined}
        tabIndex={onEmptyClick ? 0 : undefined}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border border-dashed border-border bg-muted/30",
          onEmptyClick && "cursor-pointer hover:bg-muted/60 transition-colors"
        )}
        onClick={onEmptyClick}
        onKeyDown={(e) => {
          if (onEmptyClick && (e.key === "Enter" || e.key === " "))
            onEmptyClick();
        }}
      >
        <div className="shrink-0 w-10 h-10 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center">
          <Plus className="h-4 w-4 text-muted-foreground/40" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-xs text-muted-foreground/60">
            {onEmptyClick ? "Tap to add wine" : "Empty slot"}
          </p>
        </div>
      </div>
    );
  }

  const typeColor =
    WINE_TYPE_COLORS[wine.type as keyof typeof WINE_TYPE_COLORS] || "#666";
  const typeLabel =
    WINE_TYPE_LABELS[wine.type as keyof typeof WINE_TYPE_LABELS] || wine.type;

  // When long-press is available (and not in select mode), the hook's pointer
  // handlers replace the plain onClick — its onPress routes taps to
  // onWineClick. They were previously constructed but never spread, so
  // long-press in the depth view silently did nothing.
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
        selectMode
          ? selected
            ? "border-primary bg-primary/5"
            : "border-border hover:bg-accent/30"
          : "border-border bg-card hover:bg-accent/50"
      )}
      {...(onWineLongPress && !selectMode
        ? longPressHandlers
        : {
            onClick: () => {
              if (selectMode) onToggleSelection?.();
              else onWineClick?.(wine);
            },
          })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (selectMode) onToggleSelection?.();
          else onWineClick?.(wine);
        }
      }}
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

      {/* Wine type circle */}
      <div
        className={cn(
          "shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
          isLightWineType(wine.type) && "border-2 border-border"
        )}
        style={{ backgroundColor: typeColor }}
      >
        <WineIcon
          className="h-5 w-5"
          style={{ color: isLightWineType(wine.type) ? "#333" : "#fff" }}
        />
      </div>

      {/* Wine info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
            {label}
          </span>
          <span
            className="text-[10px] px-1.5 py-0 rounded-full"
            style={{
              backgroundColor: typeColor,
              color: isLightWineType(wine.type) ? "#333" : "#fff",
            }}
          >
            {typeLabel}
          </span>
        </div>
        <p className="text-sm font-medium truncate mt-0.5">{wine.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {wine.winery}
          {wine.vintage ? ` · ${wine.vintage}` : ""}
        </p>
      </div>
    </div>
  );
}
