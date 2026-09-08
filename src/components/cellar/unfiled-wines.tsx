"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, PackageOpen, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WINE_TYPE_COLORS } from "@/types/constants";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isLightWineType, type Wine } from "@/types/wine";
import { getEffectiveDisposition } from "@/lib/drink-window";
import { useTouchDrag } from "@/hooks/use-touch-drag";
import { useDropTarget } from "@/hooks/use-drop-target";
import { useLongPress } from "@/hooks/use-long-press";

/** Brighten a hex color for border highlights */
function brightenColor(hex: string, amount = 0.3): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const br = Math.min(255, Math.round(r + (255 - r) * amount));
  const bg = Math.min(255, Math.round(g + (255 - g) * amount));
  const bb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${br.toString(16).padStart(2, "0")}${bg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
}

const DISPOSITION_COLORS: Record<string, string> = {
  D: "#2e7d32",
  H: "#1565c0",
  P: "#c62828",
};

interface UnfiledWinesProps {
  wines: Wine[];
  onWineClick: (wine: Wine) => void;
  /** Called on long-press of a wine bottle (opens edit mode) */
  onWineLongPress?: (wine: Wine) => void;
  editable?: boolean;
  /** Called when a wine is dropped INTO this container (to unfile it) */
  onWineDrop?: (wineId: string) => void;
  /** Called when user clicks the trash icon to remove all unfiled wines */
  onClearAll?: () => void;
}

export function UnfiledWines({
  wines,
  onWineClick,
  onWineLongPress,
  editable,
  onWineDrop,
  onClearAll,
}: UnfiledWinesProps) {
  const [expanded, setExpanded] = useState(true);

  const { dropRef, isOver } = useDropTarget({
    id: "unfiled-container",
    accepts: ["wine-id"],
    onDrop: (wineId) => onWineDrop?.(wineId),
    enabled: !!editable,
  });

  // Always show in edit mode (as a drop target), or when there are unfiled wines
  if (wines.length === 0 && !editable) return null;

  return (
    <div
      ref={dropRef as React.RefObject<HTMLDivElement>}
      className={cn(
        "border border-dashed rounded-lg transition-all",
        isOver
          ? "border-amber-400/70 bg-amber-500/20 ring-2 ring-amber-400/40"
          : "border-amber-500/30 bg-amber-500/5"
      )}
    >
      <button
        type="button"
        className="flex items-center justify-between w-full px-4 py-3 text-left cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <PackageOpen className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Unfiled Wines</span>
          {wines.length > 0 && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-400/50">
              {wines.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {wines.length > 0 && onClearAll && (
            <span
              role="button"
              tabIndex={0}
              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Remove all ${wines.length} unfiled wines from your cellar? They will be moved to history.`)) {
                  onClearAll();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  if (window.confirm(`Remove all ${wines.length} unfiled wines from your cellar? They will be moved to history.`)) {
                    onClearAll();
                  }
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <p className="text-xs text-muted-foreground mb-3">
            {editable
              ? "Drag wines here to unfile them, or drag out to place in a rack."
              : "These wines are not placed in any rack. Click to view details."}
          </p>
          {wines.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground/60">
              {isOver ? "Drop to unfile" : "No unfiled wines"}
            </div>
          ) : (
            <div
              className="flex flex-wrap gap-2 justify-start"
            >
              {wines.map((wine) => (
                <UnfiledBottle
                  key={wine.id}
                  wine={wine}
                  editable={editable}
                  onClick={() => onWineClick(wine)}
                  onLongPress={onWineLongPress ? () => onWineLongPress(wine) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// UnfiledBottle — single wine circle in the unfiled container
// ============================================================

function UnfiledBottle({
  wine,
  editable,
  onClick,
  onLongPress,
}: {
  wine: Wine;
  editable?: boolean;
  onClick: () => void;
  onLongPress?: () => void;
}) {
  const bgColor =
    WINE_TYPE_COLORS[wine.type as keyof typeof WINE_TYPE_COLORS] || "#666";
  const borderColor = brightenColor(bgColor);
  const effectiveDisposition = getEffectiveDisposition(wine);
  const dispositionLabel =
    effectiveDisposition === "D"
      ? "D"
      : effectiveDisposition === "H"
        ? "H"
        : effectiveDisposition === "P"
          ? "P"
          : "";
  const dispositionBg = DISPOSITION_COLORS[effectiveDisposition] || "transparent";
  const showDisposition = !!dispositionLabel;

  const { isDragging, dragHandleProps } = useTouchDrag({
    type: "wine-id",
    data: wine.id,
    enabled: !!editable,
    ghostColor: bgColor,
    ghostName: wine.name,
  });

  const longPressHandlers = useLongPress({
    onLongPress: () => onLongPress?.(),
    onPress: onClick,
    ms: 500,
    enabled: !editable && !!onLongPress,
  });

  const bottle = (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "h-10 w-10 rounded-full cursor-pointer flex items-center justify-center",
        "text-[10px] font-bold transition-all hover:scale-[1.15] select-none relative",
        isDragging && "opacity-30 scale-90"
      )}
      {...(editable ? dragHandleProps : {})}
      style={{
        ...(editable ? dragHandleProps.style : {}),
        backgroundColor: bgColor,
        borderWidth: 2,
        borderStyle: "solid",
        borderColor,
        color: isLightWineType(wine.type) ? "#333" : "#fff",
        boxShadow:
          "0 2px 6px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.3)",
      }}
      {...(!editable && onLongPress ? longPressHandlers : {})}
      onClick={editable || onLongPress ? undefined : onClick}
      onKeyDown={(e) => {
        if (!editable && (e.key === "Enter" || e.key === " ")) onClick();
      }}
    >
      {/* Disposition badge — matches rack cell style */}
      {showDisposition && (
        <span
          className="absolute w-[65%] h-[65%] rounded-full flex items-center justify-center text-white font-bold z-[2]"
          style={{
            fontSize: "clamp(7px, 2.5cqi, 12px)",
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

  // Suppress tooltips in edit mode (consistent with rack behavior)
  if (editable) return bottle;

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
