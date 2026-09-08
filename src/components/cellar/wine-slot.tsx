"use client";

import React from "react";
import { Plus } from "lucide-react";
import { WINE_TYPE_COLORS } from "@/types/constants";
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
import type { WineSlotProps } from "./cabinet-grid-types";

// ============================================================
// SlotBadges — disposition badge, depth badge, and depth dots
// ============================================================

function DispositionBadge({ label, bgColor }: { label: string; bgColor: string }) {
  return (
    <span
      className="absolute w-[65%] h-[65%] rounded-full flex items-center justify-center text-white font-bold z-[2]"
      style={{
        fontSize: "clamp(7px, 2.5cqi, 12px)",
        background: bgColor,
        border: "2px solid rgba(255,255,255,0.5)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
      }}
    >
      {label}
    </span>
  );
}

function DepthBadge({ count }: { count: number }) {
  return (
    <span
      className="absolute -top-0.5 -left-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white z-[3] pointer-events-none"
      style={{
        background: "rgba(30,136,229,0.85)",
        border: "1px solid rgba(255,255,255,0.5)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
      }}
    >
      {count}
    </span>
  );
}

function DepthDots({ depth, allWines }: { depth: number; allWines: Wine[] }) {
  return (
    <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2 flex gap-[2px] z-[3] pointer-events-none">
      {Array.from({ length: depth }, (_, d) => {
        const wineAtDepth = allWines.find((w) => w.depth === d);
        const dotColor = wineAtDepth
          ? WINE_TYPE_COLORS[wineAtDepth.type as keyof typeof WINE_TYPE_COLORS] || "#666"
          : undefined;
        return (
          <span
            key={d}
            className="w-[5px] h-[5px] rounded-full"
            style={
              dotColor
                ? {
                    background: dotColor,
                    border: "1px solid rgba(255,255,255,0.6)",
                    boxShadow: "0 0 2px rgba(0,0,0,0.6)",
                  }
                : {
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.25)",
                  }
            }
          />
        );
      })}
    </div>
  );
}

// ============================================================
// EmptySlot — empty rack position
// ============================================================

function EmptySlot({
  size,
  compact,
  isDropTarget,
  highlighted,
  editable,
  onClick,
  emptyDropRef,
  rowIndex,
  colIndex,
}: {
  size: string;
  compact: boolean;
  isDropTarget: boolean;
  /** Sort-assistant "put a bottle here" glow on an otherwise-empty slot. */
  highlighted?: boolean;
  editable?: boolean;
  onClick?: () => void;
  emptyDropRef: React.RefObject<HTMLDivElement | null>;
  rowIndex?: number;
  colIndex?: number;
}) {
  const emptySlot = (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        size,
        "rounded-full border border-dashed transition-all cursor-pointer flex items-center justify-center group/slot relative",
        highlighted ? "z-20 scale-[1.2] animate-pulse" : "z-[1]",
        highlighted
          ? "border-solid border-[#facc15] bg-[#facc15]/15 ring-2 ring-[#facc15]/60"
          : isDropTarget
            ? "border-emerald-400/70 bg-emerald-500/25 ring-2 ring-emerald-400/40 scale-110"
            : "border-white/8 bg-white/[0.02] hover:bg-white/8 hover:border-white/25",
        compact
          ? "before:content-[''] before:absolute before:rounded-full before:-inset-2"
          : "before:content-[''] before:absolute before:rounded-full before:-inset-0.5"
      )}
      style={
        highlighted
          ? { boxShadow: "0 0 0 3px rgba(250,204,21,0.45), 0 0 16px rgba(250,204,21,0.4)" }
          : undefined
      }
      onClick={!editable ? onClick : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
    >
      {/* Subtle circle by default, "+" appears on hover */}
      <span
        className={cn(
          "rounded-full transition-all pointer-events-none",
          highlighted
            ? "bg-[#facc15]/70"
            : isDropTarget
              ? "bg-emerald-400/40"
              : "bg-white/10 group-hover/slot:bg-transparent",
          compact ? "h-3 w-3" : "h-4 w-4"
        )}
      />
      <Plus
        className={cn(
          "absolute transition-all pointer-events-none",
          isDropTarget
            ? "text-emerald-400/60 opacity-100"
            : "text-white/30 opacity-0 group-hover/slot:opacity-100",
          compact ? "h-3 w-3" : "h-4 w-4"
        )}
      />
    </div>
  );

  if (editable) {
    return (
      <div
        ref={emptyDropRef as React.RefObject<HTMLDivElement>}
        className={cn(
          size,
          "relative flex items-center justify-center",
          compact
            ? "before:content-[''] before:absolute before:rounded-full before:-inset-2"
            : "before:content-[''] before:absolute before:rounded-full before:-inset-0.5"
        )}
        data-drop-row={rowIndex}
        data-drop-col={colIndex}
      >
        <div className="absolute -inset-[6px] z-0" />
        {emptySlot}
      </div>
    );
  }

  return emptySlot;
}

// ============================================================
// FilledSlotContent — the colored circle for a wine
// ============================================================

function FilledSlotContent({
  wine,
  allWines,
  depth,
  size,
  compact,
  editable,
  highlighted,
  isDragging,
  dragHandleProps,
  longPressHandlers,
  onLongPress,
  onClick,
}: {
  wine: Wine;
  allWines: Wine[];
  depth: number;
  size: string;
  compact?: boolean;
  editable?: boolean;
  highlighted?: boolean;
  isDragging: boolean;
  dragHandleProps: ReturnType<typeof useTouchDrag>["dragHandleProps"];
  longPressHandlers: ReturnType<typeof useLongPress>;
  onLongPress?: (position: { x: number; y: number }) => void;
  onClick?: () => void;
}) {
  const bgColor = getWineColor(wine.type);
  const borderColor = brightenColor(bgColor);
  const effectiveDisposition = getEffectiveDisposition(wine);
  const dispositionLabel = getDispositionLabel(effectiveDisposition);
  const dispositionBg = DISPOSITION_COLORS[effectiveDisposition] || "transparent";
  const showDisposition = !!dispositionLabel;
  const showDepth = depth >= 2 && allWines.length > 1;

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        size,
        "rounded-full cursor-pointer flex items-center justify-center text-[10px] font-bold transition-all select-none relative z-[1]",
        !editable && "hover:scale-[1.15] hover:z-10",
        isDragging && "opacity-30 scale-90",
        highlighted && "scale-[1.2] z-20 animate-pulse",
        compact
          ? "before:content-[''] before:absolute before:rounded-full before:-inset-2"
          : "before:content-[''] before:absolute before:rounded-full before:-inset-0.5"
      )}
      style={{
        backgroundColor: bgColor,
        borderWidth: 2,
        borderStyle: "solid",
        borderColor: highlighted ? "#facc15" : borderColor,
        color: isLightWineType(wine.type) ? "#333" : "#fff",
        boxShadow: highlighted
          ? `0 0 0 3px rgba(250,204,21,0.5), 0 0 16px rgba(250,204,21,0.4), 0 2px 6px rgba(0,0,0,0.4)`
          : `0 2px 6px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.3), 0 0 8px rgba(50,100,255,0.15)`,
        ...dragHandleProps.style,
      }}
      {...(editable
        ? { onPointerDown: dragHandleProps.onPointerDown, onContextMenu: dragHandleProps.onContextMenu }
        : onLongPress
          ? { ...longPressHandlers }
          : { onClick }
      )}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
    >
      {showDisposition && <DispositionBadge label={dispositionLabel} bgColor={dispositionBg} />}
      {showDepth && <DepthBadge count={allWines.length} />}
      {depth >= 2 && <DepthDots depth={depth} allWines={allWines} />}
    </div>
  );
}

// ============================================================
// WineSlotTooltip — wraps content with tooltip when appropriate
// ============================================================

function WineSlotTooltip({ wine, allWines, children }: { wine: Wine; allWines: Wine[]; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="top" className="max-w-64">
        <div className="space-y-1">
          <p className="font-semibold text-sm">{wine.name}</p>
          <p className="text-xs text-muted-foreground">
            {wine.winery}
            {wine.vintage ? ` \u00B7 ${wine.vintage}` : ""}
          </p>
          {wine.userRating !== null && (
            <p className="text-xs">
              {"\u2605".repeat(Math.floor(wine.userRating))}
              {wine.userRating % 1 >= 0.5 ? "\u00BD" : ""}{" "}
              {wine.userRating.toFixed(1)}
            </p>
          )}
          {allWines.length > 1 && (
            <p className="text-xs text-muted-foreground">
              {allWines.length} bottles stacked
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================
// WineSlot — individual cell (main export)
// ============================================================

export function WineSlot({
  cabinetId,
  wine,
  allWines,
  depth,
  compact,
  onClick,
  onLongPress,
  suppressTooltip,
  editable,
  onWineDrop,
  rowIndex,
  colIndex,
  highlighted,
  slotHighlighted,
}: WineSlotProps) {
  const size = compact ? "h-7 w-7" : "h-10 w-10";

  const isTouch = isTouchDevice();
  const bgColorForDrag = wine ? getWineColor(wine.type) : undefined;

  const { isDragging, dragHandleProps } = useTouchDrag({
    type: "wine-id",
    data: wine?.id ?? "",
    enabled: !!editable && !!wine,
    ghostColor: bgColorForDrag,
    ghostName: wine?.name ?? "",
    onTap: onClick,
  });

  const longPressHandlers = useLongPress({
    onLongPress: (pos) => onLongPress?.(pos),
    onPress: () => onClick?.(),
    ms: isTouch ? 350 : 500,
    enabled: !editable && !!wine && !!onLongPress,
  });

  const { dropRef: emptyDropRef, isOver: isDropTarget } = useDropTarget({
    id: `slot-${cabinetId}-${rowIndex}-${colIndex}`,
    accepts: ["wine-id"],
    onDrop: (wineId) => {
      if (onWineDrop && rowIndex != null && colIndex != null) {
        onWineDrop(wineId, rowIndex, colIndex);
      }
    },
    enabled: !!editable && !wine,
  });

  if (!wine) {
    return (
      <EmptySlot
        size={size}
        compact={compact}
        isDropTarget={isDropTarget}
        highlighted={slotHighlighted}
        editable={editable}
        onClick={onClick}
        emptyDropRef={emptyDropRef as React.RefObject<HTMLDivElement | null>}
        rowIndex={rowIndex}
        colIndex={colIndex}
      />
    );
  }

  const cellContent = (
    <FilledSlotContent
      wine={wine}
      allWines={allWines}
      depth={depth}
      size={size}
      compact={compact}
      editable={editable}
      highlighted={highlighted}
      isDragging={isDragging}
      dragHandleProps={dragHandleProps}
      longPressHandlers={longPressHandlers}
      onLongPress={onLongPress}
      onClick={onClick}
    />
  );

  if (suppressTooltip || isTouch) return cellContent;

  return (
    <WineSlotTooltip wine={wine} allWines={allWines}>
      {cellContent}
    </WineSlotTooltip>
  );
}
