import { memo } from "react";
import type { GridRowProps } from "./cabinet-grid-types";
import { WineSlot } from "./wine-slot";

// Memoized: a highlight flash or slot glow touches one column of one row, and
// CabinetGrid hands each row only the columns that concern it (null for every
// other row). Plain prop equality then skips all untouched rows instead of
// re-rendering every slot on the wall.
export const GridRow = memo(function GridRow({
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
  highlightedCol,
  slotHighlightCol,
}: GridRowProps) {
  const cells = [];
  for (let colIndex = 0; colIndex < cols; colIndex++) {
    const key = `${rowIndex}-${colIndex}`;
    const winesAtPos = wineMap.get(key) || [];
    const frontWine = winesAtPos.length > 0 ? winesAtPos[0] : undefined;

    cells.push(
      <WineSlot
        key={key}
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
        highlighted={colIndex === highlightedCol}
        slotHighlighted={colIndex === slotHighlightCol}
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
});
