"use client";

import {
  Check,
  Star,
  Wine as WineIcon,
  ShoppingCart,
  UtensilsCrossed,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WINE_TYPE_COLORS, WINE_TYPE_LABELS } from "@/types/constants";
import type { WineType } from "@/types/wine";
import type { WineIdentification } from "@/lib/ai/types";

/**
 * Subset of Wine fields the results view actually consumes — kept narrow
 * so callers can pass either a full Wine or a hand-shaped object.
 */
export interface UserWineForScan {
  id: string;
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  grapeVariety: string;
  disposition: string;
  drinkWindow: string;
  userRating?: number | null;
  aiRatings?: {
    rating_ws?: number | null;
    rating_rp?: number | null;
    rating_jd?: number | null;
    rating_ag?: number | null;
  } | null;
  cdScore?: number | null;
}

export type MatchResult =
  | { type: "exact"; wine: UserWineForScan }
  | { type: "similar"; wine: UserWineForScan }
  | { type: "none" };

export function fuzzyMatch(
  listWine: WineIdentification,
  cellarWines: UserWineForScan[]
): MatchResult {
  const exact = cellarWines.find(
    (cw) =>
      cw.name.toLowerCase().includes(listWine.name.toLowerCase()) ||
      listWine.name.toLowerCase().includes(cw.name.toLowerCase())
  );
  if (exact) return { type: "exact", wine: exact };

  const similar = cellarWines.find(
    (cw) =>
      (listWine.grapeVariety &&
        cw.grapeVariety &&
        cw.grapeVariety.toLowerCase() === listWine.grapeVariety.toLowerCase()) ||
      (listWine.region &&
        cw.region &&
        cw.region.toLowerCase() === listWine.region.toLowerCase())
  );
  if (similar) return { type: "similar", wine: similar };

  return { type: "none" };
}

interface WineListResultsProps {
  extractedWines: WineIdentification[];
  sourceName: string | null;
  userWines: UserWineForScan[];
  addedWines: Set<string>;
  onAddToBuyList?: (wine: {
    name: string;
    winery: string;
    vintage: number | null;
    type: string;
    region: string;
    country: string;
  }) => void;
  /** Optional footer slot — typically holds "Scan Another" + "Done" buttons.
   * Rendered after the results list so consumers can use whatever close
   * gesture fits their dialog (Done, Cancel, Back, etc.). */
  footer?: React.ReactNode;
}

/**
 * Wine-list scan results. Shared between WineListScanDialog (legacy
 * standalone) and the inline wine-list mode in AddWineDialog so they
 * stay visually identical and don't drift over time.
 */
export function WineListResults({
  extractedWines,
  sourceName,
  userWines,
  addedWines,
  onAddToBuyList,
  footer,
}: WineListResultsProps) {
  const matches = extractedWines.map((w) => fuzzyMatch(w, userWines));
  const exactCount = matches.filter((m) => m.type === "exact").length;
  const similarCount = matches.filter((m) => m.type === "similar").length;

  const handleAdd = (wine: WineIdentification) => {
    if (!onAddToBuyList) return;
    onAddToBuyList({
      name: wine.name,
      winery: wine.winery,
      vintage: wine.vintage,
      type: wine.type,
      region: wine.region,
      country: wine.country,
    });
  };

  return (
    <div className="space-y-4">
      {sourceName && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
          <UtensilsCrossed className="h-4 w-4 shrink-0" />
          <span className="font-medium">{sourceName}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {exactCount > 0 && (
          <Badge
            variant="outline"
            className="text-xs border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400"
          >
            <Check className="h-3 w-3 mr-1" />
            {exactCount} in your cellar
          </Badge>
        )}
        {similarCount > 0 && (
          <Badge
            variant="outline"
            className="text-xs border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400"
          >
            <Star className="h-3 w-3 mr-1" />
            {similarCount} similar
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        {extractedWines.map((wine, idx) => {
          const match = matches[idx];
          const wineKey = `${wine.name}-${wine.winery}`;
          const isAdded = addedWines.has(wineKey);
          const typeColor = WINE_TYPE_COLORS[wine.type as WineType] ?? "#888";
          const typeLabel =
            WINE_TYPE_LABELS[wine.type as WineType] ?? wine.type;

          return (
            <div
              key={`${wine.name}-${wine.winery}-${idx}`}
              className="border rounded-lg p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {match.type === "exact" && (
                      <Badge
                        variant="outline"
                        className="text-xs border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400 shrink-0"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        In your cellar!
                      </Badge>
                    )}
                    {match.type === "similar" && (
                      <Badge
                        variant="outline"
                        className="text-xs border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 shrink-0"
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Similar to wines you enjoy
                      </Badge>
                    )}
                    {match.type === "none" && (
                      <Badge
                        variant="outline"
                        className="text-xs text-muted-foreground shrink-0"
                      >
                        Not in cellar
                      </Badge>
                    )}
                  </div>

                  <p className="font-medium text-sm mt-1 truncate">
                    {wine.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {wine.winery}
                    {wine.vintage ? ` \u00B7 ${wine.vintage}` : ""}
                  </p>

                  <RatingsStrip
                    critic={wine.ratings ?? null}
                    userRating={
                      match.type !== "none"
                        ? match.wine.userRating ?? null
                        : null
                    }
                    matchType={match.type}
                  />
                </div>

                <Badge
                  variant="outline"
                  className="text-xs shrink-0"
                  style={{ borderColor: typeColor, color: typeColor }}
                >
                  {typeLabel}
                </Badge>
              </div>

              {match.type === "exact" && (
                <div className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded px-2 py-1">
                  Matches: {match.wine.name} ({match.wine.winery}
                  {match.wine.vintage ? `, ${match.wine.vintage}` : ""})
                </div>
              )}
              {match.type === "similar" && (
                <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1">
                  Similar to: {match.wine.name} ({match.wine.winery})
                </div>
              )}

              {match.type !== "exact" && onAddToBuyList && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  disabled={isAdded}
                  onClick={() => handleAdd(wine)}
                >
                  {isAdded ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Added to Buy List
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Add to Buy List
                    </>
                  )}
                </Button>
              )}
            </div>
          );
        })}

        {extractedWines.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <WineIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No wines detected. Try a clearer photo.
          </div>
        )}
      </div>

      {footer}
    </div>
  );
}

/**
 * Convenience helper for the "Scan Another / Done" footer used by both
 * the standalone WineListScanDialog and the inline wine-list mode in
 * AddWineDialog. Kept here so the two stay visually aligned.
 */
export function WineListResultsFooter({
  onScanAnother,
  onDone,
}: {
  onScanAnother: () => void;
  onDone: () => void;
}) {
  return (
    <div className="flex justify-between gap-2 pt-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={onScanAnother}
      >
        <ArrowLeft className="h-4 w-4" />
        Scan Another
      </Button>
      <Button type="button" variant="outline" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

// ─── Ratings strip ──────────────────────────────────────────────
// Always-visible row of critic scores + the user's own rating. Shown
// per-wine on the results list — most-important info up top per the
// "scanning a wine list should always show the ratings" feedback.

function RatingsStrip({
  critic,
  userRating,
  matchType,
}: {
  critic: {
    rating_ws?: number;
    rating_rp?: number;
    rating_jd?: number;
    rating_ag?: number;
  } | null;
  userRating: number | null;
  matchType: "exact" | "similar" | "none";
}) {
  const ws = critic?.rating_ws ?? null;
  const rp = critic?.rating_rp ?? null;
  const jd = critic?.rating_jd ?? null;
  const ag = critic?.rating_ag ?? null;
  const anyCritic = ws !== null || rp !== null || jd !== null || ag !== null;
  const showUser = matchType !== "none";

  return (
    <div className="flex items-center flex-wrap gap-1.5 mt-2 text-[11px]">
      <RatingPill label="WS" value={ws} />
      <RatingPill label="RP" value={rp} />
      <RatingPill label="JD" value={jd} />
      <RatingPill label="AG" value={ag} />
      <span className="h-3 w-px bg-border mx-0.5" aria-hidden />
      {showUser ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold border",
            userRating !== null
              ? "border-amber-300/60 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
              : "border-border text-muted-foreground"
          )}
          title={userRating !== null ? "Your rating" : "Not rated yet"}
        >
          <Star
            className={cn("h-2.5 w-2.5", userRating !== null && "fill-current")}
          />
          {userRating !== null ? userRating.toFixed(1) : "—"}
        </span>
      ) : (
        <span className="text-[10px] text-muted-foreground/60 italic">
          {anyCritic ? "" : "no published scores"}
        </span>
      )}
    </div>
  );
}

function RatingPill({ label, value }: { label: string; value: number | null }) {
  if (value === null) {
    return (
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-dashed border-border/60 text-muted-foreground/50"
        title={`${label}: no score`}
      >
        <span className="font-semibold">{label}</span>
        <span>—</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-foreground/20 bg-foreground/5"
      title={`${label}: ${value}`}
    >
      <span className="font-semibold text-foreground/70">{label}</span>
      <span className="text-foreground/90 font-mono">{value}</span>
    </span>
  );
}
