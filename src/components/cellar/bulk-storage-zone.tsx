"use client";

import React, { useMemo } from "react";
import { Plus } from "lucide-react";
import { isLightWineType, type Wine } from "@/types/wine";
import { cn } from "@/lib/utils";
import { getEffectiveDisposition } from "@/lib/drink-window";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTouchDrag } from "@/hooks/use-touch-drag";
import { useDropTarget } from "@/hooks/use-drop-target";
import { useLongPress } from "@/hooks/use-long-press";
import {
  brightenColor,
  DISPOSITION_COLORS,
  getWineColor,
  getDispositionLabel,
  isTouchDevice,
} from "./cabinet-grid-utils";
import type { BulkStorageZoneProps, LooseBottleProps, CaseBoxVisualProps } from "./cabinet-grid-types";

// ============================================================
// LooseBottle — individual loose bottle with pointer-based drag
// ============================================================

function LooseBottle({
  wine,
  editable,
  suppressTooltip,
  highlighted,
  onWineClick,
  onWineLongPress,
  onBulkZoneClick,
}: LooseBottleProps) {
  const bgColor = getWineColor(wine.type);
  const borderColor = brightenColor(bgColor);
  const effectiveDisposition = getEffectiveDisposition(wine);
  const dispositionLabel = getDispositionLabel(effectiveDisposition);
  const dispositionBg = DISPOSITION_COLORS[effectiveDisposition] || "transparent";
  const showDisposition = !!dispositionLabel;

  const { isDragging, dragHandleProps } = useTouchDrag({
    type: "wine-id",
    data: wine.id,
    enabled: !!editable,
    ghostColor: bgColor,
    ghostName: wine.name,
  });

  // In view mode (non-editable), long-press triggers move mode. In edit mode,
  // the drag handle takes over for repositioning.
  const isTouch = isTouchDevice();
  const longPressHandlers = useLongPress({
    onLongPress: (pos) => onWineLongPress?.(wine, pos),
    onPress: () => onWineClick?.(wine),
    ms: isTouch ? 350 : 500,
    enabled: !editable && !!onWineLongPress,
  });

  const bottle = (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 relative",
        editable && "cursor-grab active:cursor-grabbing",
        !editable && "hover:scale-[1.15]",
        highlighted && "scale-125 z-20 animate-pulse",
        isDragging && "opacity-30 scale-90"
      )}
      style={{
        backgroundColor: bgColor,
        color: isLightWineType(wine.type) ? "#333" : "#fff",
        borderWidth: 2,
        borderStyle: "solid",
        borderColor: highlighted ? "#facc15" : borderColor,
        boxShadow: highlighted
          ? "0 0 0 3px rgba(250,204,21,0.5), 0 0 16px rgba(250,204,21,0.4), 0 2px 6px rgba(0,0,0,0.4)"
          : "0 2px 6px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.3)",
        ...(editable ? dragHandleProps.style : {}),
      }}
      {...(editable
        ? { onPointerDown: dragHandleProps.onPointerDown, onContextMenu: dragHandleProps.onContextMenu }
        : onWineLongPress
          ? { ...longPressHandlers }
          : // No long-press handler wired (useLongPress is disabled without it) —
            // fall back to a plain click so onWineClick still works in view mode,
            // matching BulkZoneSideView/DepthSideView. Otherwise the bottle is dead
            // to mouse clicks unless the parent also passes onWineLongPress.
            { onClick: () => onWineClick?.(wine) }
      )}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (!editable) onWineClick?.(wine);
          else onBulkZoneClick?.();
        }
      }}
    >
      {showDisposition && (
        <span
          className="absolute w-[65%] h-[65%] rounded-full flex items-center justify-center text-white font-bold z-[2]"
          style={{
            fontSize: "7px",
            background: dispositionBg,
            border: "2px solid rgba(255,255,255,0.5)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}
        >
          {dispositionLabel}
        </span>
      )}
    </div>
  );

  if (suppressTooltip || isTouch) return bottle;
  return (
    <Tooltip>
      <TooltipTrigger render={bottle} />
      <TooltipContent side="top" className="max-w-64">
        <p className="font-semibold text-sm">{wine.name}</p>
        <p className="text-xs text-muted-foreground">
          {wine.winery}
          {wine.vintage ? ` \u00B7 ${wine.vintage}` : ""}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================
// CaseBoxVisual — individual case box with its own drop target
// ============================================================

function CaseBoxVisual({
  cabinetId,
  rowIndex,
  boxIndex,
  boxSize,
  winesInBox,
  colOffset,
  editable,
  boxIsFull,
  onBulkZoneClick,
  onWineClick,
  onAddClick,
  onWineDrop,
}: CaseBoxVisualProps) {
  const hasWine = winesInBox.length > 0;
  const boxW = boxSize <= 6 ? 40 : boxSize <= 12 ? 56 : 72;

  const { dropRef: caseDropRef, isOver: isDropTarget } = useDropTarget({
    id: `case-${cabinetId}-${rowIndex}-${boxIndex}`,
    accepts: ["wine-id"],
    onDrop: (wineId) => {
      if (onWineDrop && !boxIsFull) {
        const usedCols = new Set(winesInBox.map((w) => w.col ?? 0));
        let targetCol = colOffset + winesInBox.length;
        while (usedCols.has(targetCol)) targetCol++;
        onWineDrop(wineId, targetCol);
      }
    },
    enabled: !!editable && !boxIsFull,
  });

  return (
    <div
      ref={caseDropRef as React.RefObject<HTMLDivElement>}
      key={boxIndex}
      className={cn(
        "flex flex-col items-center gap-px cursor-pointer transition-all",
        isDropTarget && "scale-110"
      )}
      onClick={(e) => {
        e.stopPropagation();
        if (editable && onBulkZoneClick) {
          onBulkZoneClick();
        } else if (hasWine && onWineClick) {
          onWineClick(winesInBox[0]);
        } else if (!hasWine && onAddClick) {
          onAddClick();
        }
      }}
    >
      {/* Box shape */}
      <div className="relative" style={{ width: boxW, height: 36 }}>
        {/* Lid */}
        <div
          className="absolute top-0 -left-0.5 -right-0.5 rounded-t-sm transition-colors"
          style={{
            height: "28%",
            background: isDropTarget
              ? "linear-gradient(180deg, rgba(74,222,128,0.5) 0%, rgba(34,197,94,0.4) 100%)"
              : `linear-gradient(180deg, var(--rack-box-lid-from) 0%, var(--rack-box-lid-to) 100%)`,
            border: isDropTarget
              ? "1px solid rgba(74,222,128,0.7)"
              : "1px solid rgba(255,255,255,0.25)",
            borderBottom: "none",
          }}
        />
        {/* Body */}
        <div
          className="absolute left-0 right-0 bottom-0 rounded-b-sm flex items-center justify-center transition-colors"
          style={{
            top: "28%",
            background: isDropTarget
              ? "linear-gradient(180deg, rgba(34,197,94,0.3) 0%, rgba(22,163,74,0.25) 100%)"
              : `linear-gradient(180deg, var(--rack-box-body-from) 0%, var(--rack-box-body-to) 100%)`,
            border: isDropTarget
              ? "1px solid rgba(74,222,128,0.5)"
              : "1px solid rgba(255,255,255,0.2)",
            borderTop: isDropTarget
              ? "1px solid rgba(22,163,74,0.4)"
              : "1px solid rgba(0,0,0,0.3)",
          }}
        >
          {!hasWine && onAddClick && !editable ? (
            <Plus className="h-3 w-3 text-white/40" />
          ) : (
            <span
              className="font-bold leading-none"
              style={{
                fontSize: "0.7em",
                color: isDropTarget
                  ? "rgba(74,222,128,0.9)"
                  : hasWine
                    ? "#fff"
                    : "rgba(255,255,255,0.5)",
                textShadow: hasWine
                  ? "0 1px 2px rgba(0,0,0,0.5)"
                  : "none",
              }}
            >
              {winesInBox.length}/{boxSize}
            </span>
          )}
        </div>
      </div>
      {/* Size label */}
      <span
        style={{
          fontSize: "0.55em",
          color: isDropTarget ? "rgba(74,222,128,0.8)" : "rgba(255,255,255,0.5)",
        }}
      >
        {boxSize}-pk
      </span>
    </div>
  );
}

// ============================================================
// BulkStorageZone — renders both loose bottles and cases
// ============================================================

export function BulkStorageZone({
  cabinetId,
  rowIndex,
  storageRow,
  wines,
  onWineClick,
  onWineLongPress,
  onAddClick,
  suppressTooltip,
  editable,
  onBulkZoneClick,
  onWineDrop,
  highlightedWineId,
}: BulkStorageZoneProps) {
  const boxes = storageRow.boxes;
  const hasBoxes = boxes && boxes.length > 0;
  const totalBoxCapacity = hasBoxes ? boxes.reduce((sum, b) => sum + b, 0) : 0;
  const looseCapacity = storageRow.capacity - totalBoxCapacity;

  const sortedWines = useMemo(
    () => [...wines].sort((a, b) => (a.col ?? 0) - (b.col ?? 0)),
    [wines]
  );

  // Pre-compute box ranges via reduce so map callbacks stay pure.
  const boxRanges: { start: number; end: number }[] = hasBoxes
    ? boxes!.reduce<{ start: number; end: number }[]>((acc, boxSize) => {
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

  const { dropRef: looseDropRef, isOver: isLooseDropTarget } = useDropTarget({
    id: `bulk-loose-${rowIndex}-${cabinetId}`,
    accepts: ["wine-id"],
    onDrop: (wineId) => {
      if (onWineDrop) {
        const usedCols = wines.map((w) => w.col ?? 0);
        let targetCol = totalBoxCapacity + looseWines.length;
        while (usedCols.includes(targetCol)) targetCol++;
        onWineDrop(wineId, targetCol);
      }
    },
    enabled: !!editable && !isFull,
  });

  const icon = hasBoxes ? "\uD83D\uDCE6" : "\u25C7";

  return (
    <div
      role={onBulkZoneClick ? "button" : undefined}
      tabIndex={onBulkZoneClick ? 0 : undefined}
      className={cn(
        "mt-1 rounded-md p-2 min-h-[40px] z-[1] relative transition-all",
        editable && "cursor-pointer hover:ring-1 hover:ring-primary/40",
      )}
      style={{
        background: `linear-gradient(135deg, var(--rack-zone-from) 0%, var(--rack-zone-to) 100%)`,
      }}
      onClick={
        onBulkZoneClick
          ? (e) => {
              e.stopPropagation();
              onBulkZoneClick();
            }
          : undefined
      }
      onKeyDown={
        onBulkZoneClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onBulkZoneClick();
            }
          : undefined
      }
    >
      {/* Label */}
      <div
        className="w-full text-center mb-1.5"
        style={{ fontSize: "0.65em", color: "rgba(255,255,255,0.6)" }}
      >
        {icon} {storageRow.name}{" "}
        <span className="font-semibold">
          {wines.length}/{storageRow.capacity}
        </span>
      </div>

      {/* Case visuals */}
      {hasBoxes && (
        <div className="flex gap-2 items-end justify-center py-0.5 w-full mb-1.5">
          {boxes.map((boxSize, bi) => {
            const winesInBox = boxWineGroups[bi] || [];
            const colOffset = boxColOffsets[bi] ?? 0;
            const boxIsFull = winesInBox.length >= boxSize;
            return (
              <CaseBoxVisual
                key={bi}
                cabinetId={cabinetId}
                rowIndex={rowIndex}
                boxIndex={bi}
                boxSize={boxSize}
                winesInBox={winesInBox}
                colOffset={colOffset}
                editable={editable}
                boxIsFull={boxIsFull || isFull}
                onBulkZoneClick={onBulkZoneClick}
                onWineClick={onWineClick}
                onAddClick={onAddClick}
                onWineDrop={onWineDrop}
              />
            );
          })}
        </div>
      )}

      {/* Loose bottles area */}
      {(looseCapacity > 0 || !hasBoxes) && (
        <div
          ref={looseDropRef as React.RefObject<HTMLDivElement>}
          className={cn(
            "flex flex-wrap gap-1.5 justify-center rounded-md p-1 transition-all",
            isLooseDropTarget && "ring-2 ring-emerald-400/60 bg-emerald-500/15"
          )}
        >
          {looseWines.map((wine) => (
            <LooseBottle
              key={wine.id}
              wine={wine}
              editable={editable}
              suppressTooltip={suppressTooltip}
              highlighted={wine.id === highlightedWineId}
              onWineClick={onWineClick}
              onWineLongPress={onWineLongPress}
              onBulkZoneClick={onBulkZoneClick}
            />
          ))}
          {!isFull && onAddClick && !editable && (
            <div
              role="button"
              tabIndex={0}
              className="w-7 h-7 rounded border border-dashed border-white/20 bg-white/5 flex items-center justify-center cursor-pointer hover:bg-white/15 hover:border-white/40 transition-all"
              onClick={onAddClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onAddClick();
              }}
            >
              <Plus className="h-3.5 w-3.5 text-white/40" />
            </div>
          )}
          {editable && looseWines.length === 0 && !hasBoxes && (
            <div className="w-full py-2 text-center">
              <span
                className="text-[9px]"
                style={{ color: isLooseDropTarget ? "rgba(74,222,128,0.8)" : "rgba(255,255,255,0.3)" }}
              >
                {isLooseDropTarget ? "Drop here" : "Drop wine here"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
