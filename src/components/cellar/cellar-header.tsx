"use client";

import { useState, useEffect } from "react";
import { Pencil, X, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  WINE_TYPES,
  WINE_TYPE_LABELS,
  WINE_TYPE_COLORS,
} from "@/types/constants";
import { useWineTextColors } from "@/hooks/use-wine-colors";
import { useCurrency } from "@/hooks/use-currency";
import { isLightWineType } from "@/types/wine";
import type { Wine, WineType } from "@/types/wine";

const DISPOSITION_LEGEND = [
  { key: "D", label: "Drink Now", color: "#2e7d32" },
  { key: "H", label: "Hold", color: "#1565c0" },
  { key: "P", label: "Past Peak", color: "#c62828" },
] as const;

const LEGEND_DISMISSED_KEY = "cellar-disposition-legend-dismissed";
const FILTERS_COLLAPSED_KEY = "cellar-filters-collapsed";

interface CellarHeaderProps {
  displayName: string;
  editingName: boolean;
  onStartEditName: () => void;
  onNameSave: (name: string) => void;
  onCancelEditName: () => void;
  totalBottles: number;
  totalCapacity: number;
  totalValue: number;
  profitLoss: number;
  wines: Wine[];
  selectedType: WineType | "all";
  onTypeChange: (type: WineType | "all") => void;
}

export function CellarHeader({
  displayName,
  editingName,
  onStartEditName,
  onNameSave,
  onCancelEditName,
  totalBottles,
  totalCapacity,
  totalValue,
  profitLoss,
  wines,
  selectedType,
  onTypeChange,
}: CellarHeaderProps) {
  const wineTextColors = useWineTextColors();
  const { formatPrice } = useCurrency();
  const hasWines = wines.length > 0;

  // Collapsible filters — default collapsed on mobile to keep rack visible
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem(FILTERS_COLLAPSED_KEY);
    if (saved === "0") setFiltersExpanded(true);
  }, []);
  const toggleFilters = () => {
    const next = !filtersExpanded;
    setFiltersExpanded(next);
    localStorage.setItem(FILTERS_COLLAPSED_KEY, next ? "0" : "1");
  };

  // H/D/P legend
  const hasDispositions = wines.some(
    (w) => w.disposition === "D" || w.disposition === "H" || w.disposition === "P"
  );
  const [legendDismissed, setLegendDismissed] = useState(true);
  useEffect(() => {
    setLegendDismissed(localStorage.getItem(LEGEND_DISMISSED_KEY) === "1");
  }, []);
  const dismissLegend = () => {
    setLegendDismissed(true);
    localStorage.setItem(LEGEND_DISMISSED_KEY, "1");
  };

  // Active filter indicator
  const activeFilterLabel = selectedType !== "all"
    ? `${WINE_TYPE_LABELS[selectedType as keyof typeof WINE_TYPE_LABELS]} (${wines.filter(w => w.type === selectedType).length})`
    : null;

  return (
    <>
      {/* Compact header: name + key stats on one line */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          {editingName ? (
            <input
              autoFocus
              defaultValue={displayName}
              className="text-xl font-bold bg-transparent border-b-2 border-primary outline-none w-56"
              onBlur={(e) => onNameSave(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onNameSave(e.currentTarget.value);
                if (e.key === "Escape") onCancelEditName();
              }}
            />
          ) : (
            <button
              className="text-xl font-bold flex items-center gap-1.5 group hover:text-primary/80 transition-colors truncate"
              onClick={onStartEditName}
            >
              <span className="truncate">{displayName}</span>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )}
          {/* Single-line stats */}
          <p className="text-xs text-muted-foreground mt-0.5">
            <strong>{totalBottles}</strong>/{totalCapacity} bottles
            {totalValue > 0 && (
              <>
                {" · "}
                <strong>{formatPrice(totalValue)}</strong>
                {profitLoss !== 0 && (
                  <span className={profitLoss > 0 ? "text-green-500" : "text-red-500"}>
                    {" "}{profitLoss > 0 ? "+" : ""}{formatPrice(profitLoss)}
                  </span>
                )}
              </>
            )}
          </p>
        </div>

        {/* Filter toggle button */}
        {hasWines && (
          <button
            onClick={toggleFilters}
            className="flex items-center gap-1 text-xs text-muted-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors shrink-0"
          >
            {activeFilterLabel && (
              <Badge
                variant="default"
                className="text-[10px] px-1.5 py-0 mr-1"
                style={{
                  backgroundColor: WINE_TYPE_COLORS[selectedType as keyof typeof WINE_TYPE_COLORS],
                  color: isLightWineType(selectedType) ? "#333" : "#fff",
                }}
              >
                {activeFilterLabel}
              </Badge>
            )}
            {filtersExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Collapsible filter section */}
      {hasWines && filtersExpanded && (
        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
          {/* Wine type filter badges */}
          <div className="flex gap-1.5 flex-wrap">
            <Badge
              variant={selectedType === "all" ? "default" : "outline"}
              className="cursor-pointer select-none text-xs"
              onClick={() => onTypeChange("all")}
            >
              All ({wines.length})
            </Badge>
            {WINE_TYPES.map((t) => {
              const count = wines.filter((w) => w.type === t).length;
              if (count === 0) return null;
              return (
                <Badge
                  key={t}
                  variant={selectedType === t ? "default" : "outline"}
                  className="cursor-pointer select-none text-xs"
                  style={
                    selectedType === t
                      ? {
                          backgroundColor: WINE_TYPE_COLORS[t],
                          color: isLightWineType(t) ? "#333" : "#fff",
                        }
                      : {
                          borderColor: wineTextColors[t],
                          color: wineTextColors[t],
                        }
                  }
                  onClick={() => onTypeChange(t)}
                >
                  {WINE_TYPE_LABELS[t]} ({count})
                </Badge>
              );
            })}
          </div>

          {/* H/D/P disposition legend */}
          {hasDispositions && !legendDismissed && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {DISPOSITION_LEGEND.map(({ key, label, color }) => (
                <span key={key} className="inline-flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full inline-block"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-medium" style={{ color }}>{key}</span>
                  <span>= {label}</span>
                </span>
              ))}
              <button
                type="button"
                onClick={dismissLegend}
                className="ml-1 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                aria-label="Dismiss legend"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {hasDispositions && legendDismissed && (
            <button
              type="button"
              onClick={() => {
                setLegendDismissed(false);
                localStorage.removeItem(LEGEND_DISMISSED_KEY);
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              aria-label="Show badge legend"
            >
              <Info className="h-3 w-3" />
              <span>What do D, H, P mean?</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}
