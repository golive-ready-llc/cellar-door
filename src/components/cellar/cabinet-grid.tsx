"use client";

import { useMemo, useRef, useState, useEffect, useCallback, type ReactNode } from "react";
import type { Wine, Cabinet, StorageRow } from "@/types/wine";
import type { CabinetGridProps } from "./cabinet-grid-types";
import { GridRow } from "./grid-row";
import { EditableRow } from "./editable-row";
import { BulkStorageZone } from "./bulk-storage-zone";

// ============================================================
// CabinetGrid — main component (thin layout orchestrator)
// ============================================================

export function CabinetGrid({
  cabinet,
  wines,
  onWineClick,
  onWineLongPress,
  onSlotClick,
  onDepthSlotClick,
  compact = false,
  editable = false,
  moveOnly = false,
  editHeader,
  onRowStorageDrop,
  onRowCaseDrop,
  onRowClick,
  onWineDrop,
  onBulkZoneClick,
  highlightedWineId,
  highlightedSlot,
}: CabinetGridProps) {
  // Group wines by row-col for depth support
  const wineMap = useMemo(() => {
    const map = new Map<string, Wine[]>();
    for (const wine of wines) {
      if (wine.row !== null && wine.col !== null) {
        const key = `${wine.row}-${wine.col}`;
        const arr = map.get(key) || [];
        arr.push(wine);
        map.set(key, arr);
      }
    }
    // Sort each group by depth ascending so front wine is first
    for (const [, arr] of map) {
      arr.sort((a, b) => a.depth - b.depth);
    }
    return map;
  }, [wines]);

  // Storage row lookup
  const storageRowMap = useMemo(() => {
    const map = new Map<number, StorageRow>();
    for (const sr of cabinet.storageRows) {
      map.set(sr.row, sr);
    }
    return map;
  }, [cabinet.storageRows]);

  const effectiveRows = cabinet.rows;
  const effectiveCols = cabinet.cols;

  // Count wines per section
  const wineCount = wines.filter((w) => w.cabinetId === cabinet.id).length;

  // Calculate total capacity
  const gridSlots = Array.from({ length: effectiveRows }, (_, r) =>
    storageRowMap.has(r) ? 0 : effectiveCols * (cabinet.depth || 1)
  ).reduce((a, b) => a + b, 0);
  const storageCapacity = cabinet.storageRows.reduce(
    (sum, sr) => sum + sr.capacity,
    0
  );
  const totalCapacity = gridSlots + storageCapacity;

  // Compute container width from grid content
  const rawGridWidth = effectiveCols * 40 + (effectiveCols - 1) * 2 + 12 + 16;
  const allRowsAreStorage = effectiveRows > 0 && Array.from({ length: effectiveRows }, (_, r) => storageRowMap.has(r)).every(Boolean);
  const gridContentWidth = allRowsAreStorage ? Math.max(rawGridWidth, 320) : rawGridWidth;

  // Build rows
  const rowElements = buildRowElements({
    effectiveRows,
    storageRowMap,
    cabinet,
    wines,
    wineMap,
    effectiveCols,
    compact,
    editable,
    moveOnly,
    onWineClick,
    onWineLongPress,
    onSlotClick,
    onDepthSlotClick,
    onWineDrop,
    onBulkZoneClick,
    onRowStorageDrop,
    onRowCaseDrop,
    onRowClick,
    highlightedWineId,
    highlightedSlot,
  });

  // Auto-scale for racks wider than the viewport (view mode only)
  const containerRef = useRef<HTMLDivElement>(null);
  const [scaleFactor, setScaleFactor] = useState(1);
  const isEditMode = editable && !moveOnly;

  const updateScale = useCallback(() => {
    if (isEditMode) {
      setScaleFactor(1);
      return;
    }
    const availableWidth = window.innerWidth - 32;
    if (gridContentWidth > availableWidth) {
      setScaleFactor(Math.max(0.6, availableWidth / gridContentWidth));
    } else {
      setScaleFactor(1);
    }
  }, [isEditMode, gridContentWidth]);

  useEffect(() => {
    updateScale();
    const handleResize = () => updateScale();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateScale]);

  const rackElement = (
    <div
      className="inline-flex flex-col rounded-xl p-2 max-w-full overflow-x-auto"
      style={{
        width: gridContentWidth,
        minWidth: 0,
        background: `linear-gradient(135deg, var(--rack-exterior-to) 0%, var(--rack-exterior-from) 50%, var(--rack-exterior-to) 100%)`,
        boxShadow:
          "inset 0 2px 8px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)",
      }}
    >
      {/* Header */}
      {editable && !moveOnly && editHeader ? (
        editHeader
      ) : (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 min-w-0 overflow-hidden">
          <h3
            className="font-semibold text-sm truncate min-w-0"
            style={{
              color: "var(--rack-name-color)",
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            }}
          >
            {cabinet.name}
          </h3>
          <span
            className="text-xs shrink-0"
            style={{ color: "rgba(245,230,202,0.7)" }}
          >
            {wineCount} / {totalCapacity}
          </span>
        </div>
      )}

      {/* Interior */}
      <div
        className="rounded-lg p-1.5 relative overflow-hidden transition-colors"
        style={{
          background: editable && !moveOnly
            ? "linear-gradient(180deg, #3a1a1a 0%, #2b0d0d 100%)"
            : `linear-gradient(180deg, var(--rack-interior-from) 0%, var(--rack-interior-to) 100%)`,
        }}
      >
        {/* LED glow overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: editable && !moveOnly
              ? "radial-gradient(ellipse at center, rgba(255, 50, 50, 0.12) 0%, transparent 70%)"
              : "radial-gradient(ellipse at center, var(--rack-led-glow) 0%, transparent 70%)",
          }}
        />
        {/* Grid content */}
        <div className="relative flex flex-col gap-0.5">
          {rowElements}
        </div>
      </div>
    </div>
  );

  if (scaleFactor < 1) {
    return (
      <div ref={containerRef} style={{ width: gridContentWidth * scaleFactor }}>
        <div
          style={{
            transform: `scale(${scaleFactor})`,
            transformOrigin: "top left",
            width: gridContentWidth,
          }}
        >
          {rackElement}
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="inline-block">{rackElement}</div>;
}

// ============================================================
// Row builder — extracted from the main component body
// ============================================================

function buildRowElements({
  effectiveRows,
  storageRowMap,
  cabinet,
  wines,
  wineMap,
  effectiveCols,
  compact,
  editable,
  moveOnly,
  onWineClick,
  onWineLongPress,
  onSlotClick,
  onDepthSlotClick,
  onWineDrop,
  onBulkZoneClick,
  onRowStorageDrop,
  onRowCaseDrop,
  onRowClick,
  highlightedWineId,
  highlightedSlot,
}: {
  effectiveRows: number;
  storageRowMap: Map<number, StorageRow>;
  cabinet: Cabinet;
  wines: Wine[];
  wineMap: Map<string, Wine[]>;
  effectiveCols: number;
  compact: boolean;
  editable: boolean;
  moveOnly: boolean;
  onWineClick?: (wine: Wine) => void;
  onWineLongPress?: (wine: Wine, position: { x: number; y: number }) => void;
  onSlotClick?: (row: number, col: number) => void;
  onDepthSlotClick?: (row: number, col: number, wines: Wine[]) => void;
  onWineDrop?: (wineId: string, targetRow: number, targetCol: number) => void;
  onBulkZoneClick?: (rowIndex: number, storageRow: StorageRow, wines: Wine[]) => void;
  onRowStorageDrop?: (rowIndex: number, type: "slots" | "bulk") => void;
  onRowCaseDrop?: (rowIndex: number, caseSize: number) => void;
  onRowClick?: (rowIndex: number, anchorRect: DOMRect) => void;
  highlightedWineId?: string | null;
  highlightedSlot?: import("./cabinet-grid-types").HighlightSlot | null;
}): ReactNode[] {
  const rowElements: ReactNode[] = [];

  for (let rowIndex = 0; rowIndex < effectiveRows; rowIndex++) {
    const storageRow = storageRowMap.get(rowIndex);
    let rowContent: ReactNode;

    if (storageRow) {
      const rowWines = wines.filter(
        (w) => w.cabinetId === cabinet.id && w.row === rowIndex
      );
      rowContent = (
        <BulkStorageZone
          key={rowIndex}
          cabinetId={cabinet.id}
          rowIndex={rowIndex}
          storageRow={storageRow}
          wines={rowWines}
          onWineClick={onWineClick}
          onWineLongPress={onWineLongPress}
          onAddClick={onSlotClick ? () => onSlotClick(rowIndex, 0) : undefined}
          suppressTooltip={editable}
          editable={editable}
          onBulkZoneClick={
            onBulkZoneClick
              ? () => onBulkZoneClick(rowIndex, storageRow, rowWines)
              : undefined
          }
          onWineDrop={
            editable && onWineDrop
              ? (wineId: string, targetCol: number) => {
                  onWineDrop(wineId, rowIndex, targetCol);
                }
              : undefined
          }
          highlightedWineId={highlightedWineId}
        />
      );
    } else {
      rowContent = (
        <GridRow
          key={rowIndex}
          cabinetId={cabinet.id}
          rowIndex={rowIndex}
          cols={effectiveCols}
          depth={cabinet.depth}
          wineMap={wineMap}
          compact={compact}
          onWineClick={onWineClick}
          onWineLongPress={onWineLongPress}
          onSlotClick={onSlotClick}
          onDepthSlotClick={onDepthSlotClick}
          isLastRow={rowIndex === effectiveRows - 1 || storageRowMap.has(rowIndex + 1)}
          suppressTooltip={editable}
          editable={editable}
          onWineDrop={onWineDrop}
          highlightedWineId={highlightedWineId}
          highlightedSlot={highlightedSlot}
        />
      );
    }

    if (editable && !moveOnly) {
      const currentType: "slots" | "bulk" = storageRow ? "bulk" : "slots";
      rowElements.push(
        <EditableRow
          key={rowIndex}
          cabinetId={cabinet.id}
          rowIndex={rowIndex}
          currentType={currentType}
          onDrop={onRowStorageDrop}
          onCaseDrop={onRowCaseDrop}
          onClick={onRowClick}
        >
          {rowContent}
        </EditableRow>
      );
    } else {
      rowElements.push(rowContent);
    }
  }

  return rowElements;
}
