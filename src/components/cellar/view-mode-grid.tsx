"use client";

import { memo, useMemo, useCallback } from "react";
import {
  Wine as WineIcon,
  Plus,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CabinetGrid } from "@/components/cellar/cabinet-grid";
import { AddWineDialog } from "@/components/wine/add-wine-dialog";
import { WallSettingsDialog, type WallChanges } from "@/components/cellar/wall-settings-dialog";
import type { Wine, Wall, Cabinet, StorageRow } from "@/types/wine";

interface ViewModeGridProps {
  wallCabinets: Cabinet[];
  walls: Wall[];
  cabinets: Cabinet[];
  displayWines: Wine[];
  moveMode: boolean;
  highlightedWineId: string | null;
  /** Empty slot to glow gold (sort assistant destination). */
  highlightedSlot?: import("./cabinet-grid-types").HighlightSlot | null;
  allTags: string[];
  onWineClick: (wine: Wine) => void;
  onWineLongPress: () => void;
  onWineDrop: (wineId: string, cabinetId: string, row: number, col: number) => void;
  onSlotClick: (cabinetId: string, row: number, col: number) => void;
  onDepthSlotClick: (
    cabinetId: string,
    row: number,
    col: number,
    winesAtPos: Wine[],
    depth: number,
    sectionName: string
  ) => void;
  onBulkZoneClick: (
    cabinetId: string,
    rowIndex: number,
    storageRow: StorageRow,
    sectionName: string
  ) => void;
  onEnterEditMode: () => void;
  onWallChanges: (changes: WallChanges) => Promise<void>;
  onWallsChanged: () => Promise<void>;
  onAddWine: (
    data: Omit<Wine, "id" | "addedAt" | "updatedAt" | "userId">
  ) => Promise<void>;
}

// Memoized: ViewModeGrid hands each wrapper a highlight already scoped to its
// cabinet (null everywhere else), so a highlight flash re-renders the one
// cabinet that shows it and the memos inside skip the rest.
const CabinetGridWrapper = memo(function CabinetGridWrapper({
  cabinet,
  wines,
  moveMode,
  onWineClick,
  onWineLongPress,
  onWineDrop,
  onSlotClick,
  onDepthSlotClick,
  onBulkZoneClick,
  highlightedWineId,
  highlightedSlot,
}: {
  cabinet: import("@/types/wine").Cabinet;
  wines: import("@/types/wine").Wine[];
  moveMode: boolean;
  onWineClick: ViewModeGridProps["onWineClick"];
  onWineLongPress: ViewModeGridProps["onWineLongPress"];
  onWineDrop: ViewModeGridProps["onWineDrop"];
  onSlotClick: ViewModeGridProps["onSlotClick"];
  onDepthSlotClick: ViewModeGridProps["onDepthSlotClick"];
  onBulkZoneClick: ViewModeGridProps["onBulkZoneClick"];
  highlightedWineId: ViewModeGridProps["highlightedWineId"];
  highlightedSlot: ViewModeGridProps["highlightedSlot"];
}) {
  const handleWineDrop = useCallback(
    (wineId: string, row: number, col: number) => onWineDrop(wineId, cabinet.id, row, col),
    [onWineDrop, cabinet.id]
  );

  const handleSlotClick = useCallback(
    (row: number, col: number) => onSlotClick(cabinet.id, row, col),
    [onSlotClick, cabinet.id]
  );

  const handleDepthSlotClick = useCallback(
    (row: number, col: number, winesAtPos: import("@/types/wine").Wine[]) =>
      onDepthSlotClick(cabinet.id, row, col, winesAtPos, cabinet.depth ?? 2, cabinet.name),
    [onDepthSlotClick, cabinet.id, cabinet.depth, cabinet.name]
  );

  const handleBulkZoneClick = useCallback(
    (rowIndex: number, storageRow: import("@/types/wine").StorageRow) =>
      onBulkZoneClick(cabinet.id, rowIndex, storageRow, cabinet.name),
    [onBulkZoneClick, cabinet.id, cabinet.name]
  );

  if (moveMode) {
    return (
      <CabinetGrid
        cabinet={cabinet}
        wines={wines}
        editable
        moveOnly
        onWineClick={onWineClick}
        onWineDrop={handleWineDrop}
        onBulkZoneClick={handleBulkZoneClick}
        highlightedWineId={highlightedWineId}
        highlightedSlot={highlightedSlot}
      />
    );
  }
  return (
    <CabinetGrid
      cabinet={cabinet}
      wines={wines}
      onWineClick={onWineClick}
      onWineLongPress={onWineLongPress}
      onSlotClick={handleSlotClick}
      onDepthSlotClick={handleDepthSlotClick}
      onBulkZoneClick={handleBulkZoneClick}
      highlightedWineId={highlightedWineId}
      highlightedSlot={highlightedSlot}
    />
  );
});

// Memoized: the cellar page re-renders on every search keystroke and highlight
// flash, and this grid is hundreds of slots deep. With stable handler props and
// an unchanged wines array (see the page's useDeferredValue filter), skipped
// renders here are what keep typing and taps responsive on a full wall.
export const ViewModeGrid = memo(function ViewModeGrid({
  wallCabinets,
  walls,
  cabinets,
  displayWines,
  moveMode,
  highlightedWineId,
  highlightedSlot,
  allTags,
  onWineClick,
  onWineLongPress,
  onWineDrop,
  onSlotClick,
  onDepthSlotClick,
  onBulkZoneClick,
  onEnterEditMode,
  onWallChanges,
  onWallsChanged,
  onAddWine,
}: ViewModeGridProps) {
  // Memoize per-cabinet wine lookups to avoid re-filtering on every render,
  // particularly important during move-mode transitions on mobile.
  const cabinetWineMap = useMemo(() => {
    const map = new Map<string, import("@/types/wine").Wine[]>();
    for (const w of displayWines) {
      if (!w.cabinetId) continue;
      const arr = map.get(w.cabinetId) || [];
      arr.push(w);
      map.set(w.cabinetId, arr);
    }
    return map;
  }, [displayWines]);

  // A highlight flash must not re-render every cabinet on the wall. Scope the
  // pulsing wine to its one cabinet and the gold slot to its one cabinet, so
  // the memoized wrappers elsewhere see unchanged props and bail out.
  const highlightedCabinetId = useMemo(() => {
    if (!highlightedWineId) return null;
    return displayWines.find((w) => w.id === highlightedWineId)?.cabinetId ?? null;
  }, [highlightedWineId, displayWines]);

  if (wallCabinets.length > 0) {
    return (
      <div className="flex flex-wrap gap-6 overflow-hidden">
        {wallCabinets.map((cabinet) => {
          const cabinetWines = cabinetWineMap.get(cabinet.id) || [];
          const cabinetOwnsHighlight =
            highlightedWineId != null && highlightedCabinetId === cabinet.id;
          return (
            <div
              key={cabinet.id}
              id={`cabinet-${cabinet.id}`}
              className="max-w-full"
            >
              <CabinetGridWrapper
                cabinet={cabinet}
                wines={cabinetWines}
                moveMode={moveMode}
                onWineClick={onWineClick}
                onWineLongPress={onWineLongPress}
                onWineDrop={onWineDrop}
                onSlotClick={onSlotClick}
                onDepthSlotClick={onDepthSlotClick}
                onBulkZoneClick={onBulkZoneClick}
                highlightedWineId={cabinetOwnsHighlight ? highlightedWineId : null}
                highlightedSlot={
                  highlightedSlot && highlightedSlot.cabinetId === cabinet.id
                    ? highlightedSlot
                    : null
                }
              />
            </div>
          );
        })}
      </div>
    );
  }

  if (walls.length > 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-muted p-4 mb-4">
            <WineIcon className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">
            No sections on this wall
          </h3>
          <p className="text-muted-foreground text-center max-w-sm mb-4">
            Add rack sections, bulk bins, or case storage to this wall.
          </p>
          <Button variant="outline" onClick={onEnterEditMode}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Storage
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No walls at all
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="rounded-full bg-muted p-4 mb-4">
          <WineIcon className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">Your cellar is empty</h3>
        <p className="text-muted-foreground text-center max-w-sm mb-6">
          Set up your cellar by adding walls and storage sections, then start
          adding wines.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <WallSettingsDialog
            walls={walls}
            onSave={onWallChanges}
            onWallsChanged={onWallsChanged}
            trigger={
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                Add Walls
              </Button>
            }
          />
          <AddWineDialog
            cabinets={cabinets}
            onAdd={onAddWine}
            allTags={allTags}
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Wine
              </Button>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
});
