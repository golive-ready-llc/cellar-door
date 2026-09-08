"use client";

import {
  Wine as WineIcon,
  MapPin,
  Grape,
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
} from "@/types/constants";
import { isLightWineType, isSparklingType } from "@/types/wine";
import type { WineType } from "@/types/wine";

/** Shared data shape used by both inventory (Wine) and buy list (BuyListItem).
 *  Buy list items lack some fields (userRating, cdScore, tags, cabinet name,
 *  sparkling) — those gracefully default to hidden/empty. */
export interface WineDisplayData {
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  imageUrl: string;
  grapeVariety?: string;
  region?: string;
  country?: string;
  price: number | null;
  userRating?: number | null;
  cdScore?: number | null;
  cdRatingCount?: number;
  disposition?: string;
  sparkling?: boolean;
  tags?: string[];
}

interface WineListItemProps {
  wine: WineDisplayData;
  cabinetName?: string;
  /** Per-type text colors. Optional — falls back to the type color when a
   *  caller (e.g. Discover/Activity) doesn't have the hook handy. */
  wineTextColors?: Record<WineType, string>;
  /** Optional — only needed when the built-in price slot is used. */
  formatPrice?: (amount: number, decimals?: number) => string;
  onClick?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  selectMode?: boolean;
  /** Number of identical bottles (for grouping badge) */
  groupCount?: number;
  /** Total price of all bottles in the group */
  groupTotalPrice?: number | null;
  /** Replaces the default price in the top-right slot (e.g. a wishlist button
   *  or relative time). When set, the price is not shown. */
  trailing?: React.ReactNode;
  /** Small badge overlaid on the media avatar (e.g. an Activity "kind" badge). */
  mediaBadge?: React.ReactNode;
  /** Extra badge inline in the meta row (e.g. a History "reason"). */
  extraBadge?: React.ReactNode;
  /** Secondary line under the meta row (e.g. tasting notes). */
  footer?: React.ReactNode;
}

export function WineListItem({
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
  trailing,
  mediaBadge,
  extraBadge,
  footer,
}: WineListItemProps) {
  // Normalize the type so capitalized AI types ("White") still resolve a color
  // instead of falling back to gray.
  const normType = (wine.type || "red").toLowerCase();
  const typeColor =
    WINE_TYPE_COLORS[normType as keyof typeof WINE_TYPE_COLORS] || "#666";
  const typeTextColor =
    wineTextColors?.[normType as WineType] || typeColor;

  const longPressHandlers = useLongPress({
    onLongPress: () => onLongPress?.(),
    onPress: () => onClick?.(),
    ms: 500,
    enabled: !!onLongPress,
  });

  return (
    <div
      role="button"
      tabIndex={0}
      {...(onLongPress ? longPressHandlers : { onClick })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
      className={cn(
        "w-full text-left rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors cursor-pointer flex gap-4 items-start select-none",
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border"
      )}
    >
      {/* Select checkbox */}
      {selectMode && (
        <div className="shrink-0 mt-1">
          {selected ? (
            <CheckSquare className="h-5 w-5 text-primary" />
          ) : (
            <Square className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      )}

      {/* Wine type indicator / label photo */}
      <div className="relative shrink-0 mt-0.5">
        {wine.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-supplied base64/remote label, not optimizable by next/image
          <img
            src={wine.imageUrl}
            alt={wine.name + " label"}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
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
        {mediaBadge}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">
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
            {(wine.userRating != null && wine.userRating > 0 || wine.cdScore != null) && (
              <div className="flex items-center gap-2 mt-0.5">
                {wine.userRating != null && wine.userRating > 0 && (
                  <StarRating value={wine.userRating} size={12} compact />
                )}
                {wine.cdScore != null && (
                  <CdScoreBadge score={wine.cdScore} ratingCount={wine.cdRatingCount} compact />
                )}
              </div>
            )}
          </div>
          {trailing ? (
            <div className="shrink-0 text-right">{trailing}</div>
          ) : wine.price !== null && formatPrice ? (
            <span className="shrink-0 text-sm font-medium tabular-nums text-right min-w-14">
              {groupCount != null && groupCount > 1 && groupTotalPrice != null
                ? formatPrice(groupTotalPrice)
                : formatPrice(wine.price)}
            </span>
          ) : null}
        </div>

        {/* Tags row */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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

          {extraBadge}

          {/* Sparkling chip — quality, orthogonal to color. Skipped when
              the legacy type === "sparkling" so we don't double up. */}
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
              {wine.country ? `, ${wine.country}` : ""}
            </span>
          )}

          {cabinetName && (
            <span className="text-[10px] text-muted-foreground">
              in {cabinetName}
            </span>
          )}

          {wine.tags?.slice(0, 3).map((tag) => (
            <TagPill key={tag} tag={tag} compact />
          ))}
          {(wine.tags?.length ?? 0) > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{wine.tags!.length - 3}
            </span>
          )}
        </div>

        {footer && <div className="mt-1">{footer}</div>}
      </div>
    </div>
  );
}
