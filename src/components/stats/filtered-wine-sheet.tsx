"use client";

import { Wine as WineIcon, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { WINE_TYPE_COLORS } from "@/types/constants";
import { isLightWineType, type Wine } from "@/types/wine";

interface FilteredWineSheetProps {
  filterLabel: string;
  filteredWines: Wine[];
  onClose: () => void;
  onWineClick: (wine: Wine) => void;
}

export function FilteredWineSheet({
  filterLabel,
  filteredWines,
  onClose,
  onWineClick,
}: FilteredWineSheetProps) {
  if (!filterLabel || filteredWines.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col pb-14 md:pb-0">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      {/* Sheet */}
      <div
        className="relative mt-auto bg-card rounded-t-2xl border-t border-border flex flex-col animate-in slide-in-from-bottom duration-200"
        style={{ maxHeight: "75vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="font-semibold text-base">
            {filterLabel}
            <span className="text-muted-foreground font-normal ml-2">
              {filteredWines.length} wine{filteredWines.length !== 1 ? "s" : ""}
            </span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-muted/50 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Scrollable wine list */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-3 space-y-1">
          {filteredWines.map((wine) => (
            <div
              key={wine.id}
              role="button"
              tabIndex={0}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-muted/50 active:bg-muted active:scale-[0.99] transition-all"
              onClick={() => onWineClick(wine)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onWineClick(wine);
              }}
            >
              <div
                className={cn(
                  "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                  isLightWineType(wine.type) && "border border-border"
                )}
                style={{
                  backgroundColor:
                    WINE_TYPE_COLORS[wine.type as keyof typeof WINE_TYPE_COLORS] || "#666",
                }}
              >
                <WineIcon
                  className="h-4 w-4"
                  style={{ color: isLightWineType(wine.type) ? "#333" : "#fff" }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{wine.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {wine.winery}
                  {wine.vintage ? ` \u00B7 ${wine.vintage}` : ""}
                  {wine.country ? ` \u00B7 ${wine.country}` : ""}
                </p>
              </div>
              {wine.userRating != null && (
                <div className="flex items-center gap-1 shrink-0">
                  <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-semibold">
                    {wine.userRating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
