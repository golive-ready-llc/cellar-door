"use client";

import {
  Wine as WineIcon,
  MapPin,
  Grape,
  Calendar,
  CheckSquare,
  Square,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TagPill } from "@/components/wine/tag-selector";
import { CdScoreBadge } from "@/components/community/community-score";
import { StarRating } from "@/components/ui/star-rating";
import { useLongPress } from "@/hooks/use-long-press";
import {
  WINE_TYPE_LABELS,
  WINE_TYPE_COLORS,
  DISPOSITION_LABELS,
  DISPOSITION_COLORS,
  AI_RATING_LABELS,
} from "@/types/constants";
import { isLightWineType, isSparklingType } from "@/types/wine";
import type { Wine, WineType } from "@/types/wine";

interface WineGridItemProps {
  wine: Wine;
  cabinetName: string;
  wineTextColors: Record<WineType, string>;
  formatPrice: (amount: number, decimals?: number) => string;
  onClick: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  selectMode?: boolean;
  /** Number of identical bottles (for grouping badge) */
  groupCount?: number;
  /** Total price of all bottles in the group */
  groupTotalPrice?: number | null;
}

export function WineGridItem({
  wine,
  cabinetName,
  wineTextColors,
  formatPrice,
  onClick,
  onLongPress,
  selected = false,
  selectMode = false,
  groupCount,
  groupTotalPrice,
}: WineGridItemProps) {
  // Normalize so capitalized types still resolve a color (defensive parity
  // with the list row / Discover).
  const normType = (wine.type || "red").toLowerCase();
  const typeColor =
    WINE_TYPE_COLORS[normType as keyof typeof WINE_TYPE_COLORS] || "#666";
  const typeTextColor =
    wineTextColors[normType as WineType] || typeColor;

  const longPressHandlers = useLongPress({
    onLongPress: () => onLongPress?.(),
    onPress: onClick,
    ms: 500,
    enabled: !!onLongPress,
  });

  return (
    <div
      role="button"
      tabIndex={0}
      {...(onLongPress ? longPressHandlers : { onClick })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className={cn(
        "rounded-xl border bg-card overflow-hidden hover:shadow-md transition-all cursor-pointer group select-none",
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border"
      )}
    >
      {/* Color accent bar */}
      <div className="h-1.5" style={{ backgroundColor: typeColor }} />

      <div className="p-4 space-y-3">
        {/* Header row: type circle + name + price */}
        <div className="flex items-start gap-3">
          {selectMode && (
            <div className="shrink-0 mt-1">
              {selected ? (
                <CheckSquare className="h-5 w-5 text-primary" />
              ) : (
                <Square className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          )}
          {wine.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-supplied base64/remote label image, not optimizable by next/image
            <img
              src={wine.imageUrl}
              alt={wine.name + " label"}
              className="shrink-0 w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div
              className={cn(
                "shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                isLightWineType(normType) && "border-2 border-border"
              )}
              style={{ backgroundColor: typeColor }}
            >
              <WineIcon
                className="h-5 w-5"
                style={{ color: isLightWineType(normType) ? "#333" : "#fff" }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight truncate">
              {wine.name}
              {groupCount != null && groupCount > 1 && (
                <span className="ml-1.5 inline-flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0 leading-4">
                  &times;{groupCount}
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {wine.winery}
              {wine.vintage ? ` \u00B7 ${wine.vintage}` : ""}
            </p>
          </div>
        </div>

        {/* User rating + CD Score */}
        <div className="flex items-center gap-3">
          {wine.userRating != null && wine.userRating > 0 && (
            <StarRating value={wine.userRating} size={14} compact />
          )}
          {wine.cdScore != null && (
            <CdScoreBadge score={wine.cdScore} ratingCount={wine.cdRatingCount} compact />
          )}
        </div>

        {/* Price row */}
        {(wine.price !== null || wine.retailPrice !== null) && (
          <div className="flex items-center gap-3">
            {wine.price !== null && (
              <span className="text-xl font-bold">
                {groupCount != null && groupCount > 1 && groupTotalPrice != null
                  ? formatPrice(groupTotalPrice)
                  : formatPrice(wine.price)}
              </span>
            )}
            {wine.retailPrice !== null && wine.retailPrice !== wine.price && (
              <span className="text-xs text-muted-foreground">
                ~{formatPrice(wine.retailPrice)} retail
              </span>
            )}
          </div>
        )}

        {/* Disposition + Drink Window */}
        {(wine.disposition || wine.drinkWindow) && (
          <div className="flex items-center gap-2">
            {wine.disposition && (
              <Badge
                className="text-[10px] px-1.5 py-0"
                style={{
                  backgroundColor:
                    DISPOSITION_COLORS[wine.disposition] || "#666",
                  color: "#fff",
                }}
              >
                {DISPOSITION_LABELS[wine.disposition] || wine.disposition}
              </Badge>
            )}
            {wine.drinkWindow && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Calendar className="h-2.5 w-2.5" />
                {wine.drinkWindow}
              </span>
            )}
          </div>
        )}

        {/* Tags: type, grape, region, location */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0"
            style={{
              borderColor: typeTextColor,
              color: typeTextColor,
            }}
          >
            {WINE_TYPE_LABELS[normType as keyof typeof WINE_TYPE_LABELS] ||
              wine.type}
          </Badge>
          {/* Sparkling is a quality (not a varietal). Show alongside the
              color badge so a White Sparkling reads as both. Skipped when
              the legacy type === "sparkling" since the type badge already
              says "Sparkling" — avoids a duplicate. */}
          {wine.sparkling && !isSparklingType(normType) && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0"
              style={{
                borderColor: WINE_TYPE_COLORS.sparkling,
                color: WINE_TYPE_COLORS.sparkling,
              }}
            >
              Sparkling
            </Badge>
          )}

          {wine.grapeVariety && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Grape className="h-2.5 w-2.5" />
              {wine.grapeVariety}
            </span>
          )}

          {wine.region && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" />
              {wine.region}
            </span>
          )}
        </div>

        {/* Custom tags */}
        {wine.tags?.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {wine.tags.slice(0, 3).map((tag) => (
              <TagPill key={tag} tag={tag} compact />
            ))}
            {wine.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{wine.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* AI Ratings preview */}
        {wine.aiRatings && (
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/50">
            {Object.entries(wine.aiRatings).map(([key, val]) => {
              if (!val) return null;
              const shortLabel =
                key === "rating_ws"
                  ? "WS"
                  : key === "rating_rp"
                    ? "RP"
                    : key === "rating_jd"
                      ? "JD"
                      : key === "rating_ag"
                        ? "AG"
                        : key;
              return (
                <span
                  key={key}
                  className="text-[10px] text-muted-foreground font-medium"
                  title={AI_RATING_LABELS[key] || key}
                >
                  {shortLabel} {val}
                </span>
              );
            })}
          </div>
        )}

        {/* Location */}
        {cabinetName && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              in {cabinetName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
