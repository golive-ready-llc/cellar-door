"use client";

import type { GridRowProps } from "./cabinet-grid-types";
import { WineSlot } from "./wine-slot";

export function GridRow({
  cabinetId,
  rowIndex,
  cols,
  depth,
  wineMap,
  compact,
  onWineClick,
  onWineLongPress,
  onSlotClick,
  onDepthSlotClick,
  isLastRow,
  suppressTooltip,
  editable,
  onWineDrop,
  highlightedWineId,
  highlightedSlot,
}: GridRowProps) {
  const cells = [];
  for (let colIndex = 0; colIndex < cols; colIndex++) {
    const key = `${rowIndex}-${colIndex}`;
    const winesAtPos = wineMap.get(key) || [];
    const frontWine = winesAtPos.length > 0 ? winesAtPos[0] : undefined;
    const isHighlighted = !!highlightedWineId && winesAtPos.some(w => w.id === highlightedWineId);
    const isSlotHighlighted =
      !!highlightedSlot &&
      highlightedSlot.cabinetId === cabinetId &&
      highlightedSlot.row === rowIndex &&
      highlightedSlot.col === colIndex;

    cells.push(
      <WineSlot
        key={`${rowIndex}-${colIndex}`}
        cabinetId={cabinetId}
        wine={frontWine}
        allWines={winesAtPos}
        depth={depth}
        compact={compact}
        suppressTooltip={suppressTooltip}
        editable={editable}
        onWineDrop={onWineDrop}
        rowIndex={rowIndex}
        colIndex={colIndex}
        highlighted={isHighlighted}
        slotHighlighted={isSlotHighlighted}
        onClick={() => {
          if (depth >= 2 && onDepthSlotClick) {
            onDepthSlotClick(rowIndex, colIndex, winesAtPos);
          } else if (frontWine && onWineClick) {
            onWineClick(frontWine);
          } else if (!frontWine && onSlotClick) {
            onSlotClick(rowIndex, colIndex);
          }
        }}
        onLongPress={frontWine && onWineLongPress ? (pos: { x: number; y: number }) => onWineLongPress(frontWine, pos) : undefined}
      />
    );
  }

  return (
    <div className="flex gap-0.5 relative mb-0.5">
      {cells}
      {!isLastRow && (
        <div
          className="absolute bottom-[-2px] left-0 right-0 h-[3px] rounded-b-sm pointer-events-none z-0"
          style={{
            background: `linear-gradient(90deg, var(--rack-shelf-edge) 0%, var(--rack-shelf) 50%, var(--rack-shelf-edge) 100%)`,
          }}
        />
      )}
    </div>
  );
}
