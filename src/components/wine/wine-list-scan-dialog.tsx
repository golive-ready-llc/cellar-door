"use client";

import { useState, useCallback } from "react";
import {
  Loader2,
  Check,
  Star,
  Wine as WineIcon,
  ShoppingCart,
  UtensilsCrossed,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTier } from "@/hooks/use-tier";
import { ImageCapture } from "./image-capture";
import { aiExtractWineList } from "@/server/actions/ai";
import { WINE_TYPE_COLORS, WINE_TYPE_LABELS } from "@/types/constants";
import type { WineType } from "@/types/wine";
import type { WineIdentification } from "@/lib/ai/types";

interface UserWineForScan {
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
  aiRatings?: { rating_ws?: number | null; rating_rp?: number | null; rating_jd?: number | null; rating_ag?: number | null } | null;
  cdScore?: number | null;
}

interface WineListScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userWines: Array<UserWineForScan>;
  onAddToBuyList?: (wine: {
    name: string;
    winery: string;
    vintage: number | null;
    type: string;
    region: string;
    country: string;
  }) => void;
}

type Step = "capture" | "processing" | "results";

type MatchResult =
  | { type: "exact"; wine: UserWineForScan }
  | { type: "similar"; wine: UserWineForScan }
  | { type: "none" };

function fuzzyMatch(
  listWine: WineIdentification,
  cellarWines: WineListScanDialogProps["userWines"]
): MatchResult {
  // Exact match: normalized name and winery must align
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const listName = normalize(listWine.name);
  const listWinery = listWine.winery ? normalize(listWine.winery) : "";

  const exact = cellarWines.find((cw) => {
    const cellarName = normalize(cw.name);
    const cellarWinery = cw.winery ? normalize(cw.winery) : "";

    // Both name and winery must overlap. At least one direction must match
    // for both fields (handles Gemini adding " - " descriptions to names).
    const nameMatch =
      cellarName.includes(listName) ||
      listName.includes(cellarName);
    const wineryMatch =
      listWinery.length > 0 &&
      cellarWinery.length > 0 &&
      (cellarWinery.includes(listWinery) ||
        listWinery.includes(cellarWinery));

    return nameMatch && wineryMatch;
  });
  if (exact) return { type: "exact", wine: exact };

  // Similar: at least one significant name word matches AND same grape/region
  const listWords = listName
    .split(/\s+/)
    .filter((w) => w.length > 2); // skip short words
  const similar = cellarWines.find(
    (cw) => {
      const cellarName = normalize(cw.name);
      const cellarWords = cellarName.split(/\s+/).filter((w) => w.length > 2);
      const wordOverlap = listWords.some((w) => cellarWords.includes(w));
      if (!wordOverlap) return false;

      return (
        (listWine.grapeVariety &&
          cw.grapeVariety &&
          cw.grapeVariety.toLowerCase() ===
            listWine.grapeVariety.toLowerCase()) ||
        (listWine.region &&
          cw.region &&
          cw.region.toLowerCase() === listWine.region.toLowerCase())
      );
    }
  );
  if (similar) return { type: "similar", wine: similar };

  return { type: "none" };
}

export function WineListScanDialog({
  open,
  onOpenChange,
  userWines,
  onAddToBuyList,
}: WineListScanDialogProps) {
  const { userId } = useTier();
  const [step, setStep] = useState<Step>("capture");
  const [error, setError] = useState<string | null>(null);
  const [extractedWines, setExtractedWines] = useState<WineIdentification[]>(
    []
  );
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [addedWines, setAddedWines] = useState<Set<string>>(new Set());

  const resetAll = () => {
    setStep("capture");
    setError(null);
    setExtractedWines([]);
    setSourceName(null);
    setAddedWines(new Set());
  };

  // Capture immediately triggers processing — no intermediate "Scan Wine List"
  // confirm button. Matches the invoice scan flow where the user just taps
  // shutter and the AI takes over.
  const handleCapture = useCallback(
    async (base64: string, mimeType: string) => {
      // Client-side image validation before sending to server
      const decodedSize = Math.ceil((base64.length * 3) / 4);
      const MAX_BYTES = 20 * 1024 * 1024; // 20MB
      if (decodedSize > MAX_BYTES) {
        setError(`Image too large (${Math.round(decodedSize / (1024 * 1024))}MB). Maximum is 20MB.`);
        return;
      }
      const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
      if (!ALLOWED_TYPES.includes(mimeType)) {
        setError(`Unsupported image type: ${mimeType}. Allowed: JPEG, PNG, WebP, AVIF.`);
        return;
      }

      setStep("processing");
      setError(null);

      try {
        const result = await aiExtractWineList(base64, mimeType, userId ?? undefined);
        if (!result.success) {
          setError(result.error || "Failed to extract wine list. Please try again.");
          setStep("capture");
          return;
        }
        if (!result.data.wines || result.data.wines.length === 0) {
          setError("Couldn't identify any wines in that image. Try a clearer photo.");
          setStep("capture");
          return;
        }
        setExtractedWines(result.data.wines);
        setSourceName(result.data.sourceName);
        setStep("results");
      } catch {
        setError("Failed to process wine list. Please try again.");
        setStep("capture");
      }
    },
    [userId]
  );

  const handleAddToBuyList = (wine: WineIdentification) => {
    if (!onAddToBuyList) return;
    onAddToBuyList({
      name: wine.name,
      winery: wine.winery,
      vintage: wine.vintage,
      type: wine.type,
      region: wine.region,
      country: wine.country,
    });
    setAddedWines((prev) => new Set(prev).add(`${wine.name}-${wine.winery}`));
  };

  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
    if (!o) resetAll();
  };

  // When step is "capture", render the full-screen camera as a portal — no
  // dialog chrome, no intro screen. Matches the "Scan Wine" → invoice flow.
  if (open && step === "capture") {
    return (
      <>
        {error && (
          <div className="fixed top-4 inset-x-4 z-[60] text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3 backdrop-blur">
            {error}
          </div>
        )}
        <ImageCapture
          fullScreen
          autoStart
          onCapture={handleCapture}
          onClose={() => handleOpenChange(false)}
          label="Capture a restaurant wine list — we'll match it against your cellar"
        />
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "capture" && (
              <>
                <UtensilsCrossed className="h-5 w-5 text-primary" />
                Scan Wine List
              </>
            )}
            {step === "processing" && (
              <>
                <WineIcon className="h-5 w-5 text-primary animate-pulse" />
                Analyzing Wine List...
              </>
            )}
            {step === "results" && (
              <>
                <Check className="h-5 w-5 text-green-500" />
                Wine List Results
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === "capture" &&
              "Take a photo of a restaurant wine list to find matches in your cellar."}
            {step === "processing" &&
              "Our AI sommelier is reading the wine list..."}
            {step === "results" &&
              `Found ${extractedWines.length} wine${extractedWines.length !== 1 ? "s" : ""} on the list.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Step 1 (capture) is rendered as a full-screen camera above
              — see the early-return at the top of the component. */}

          {/* Step 2: Processing */}
          {step === "processing" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="relative">
                <WineIcon className="h-16 w-16 text-primary animate-pulse" />
                <Loader2 className="h-7 w-7 text-amber-500 animate-spin absolute -bottom-1 -right-1" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Reading the wine list...</p>
                <p className="text-xs text-muted-foreground">
                  Identifying wines and matching against your cellar
                </p>
              </div>
              {/* Pulsing dots */}
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
                <span
                  className="h-2 w-2 rounded-full bg-primary/60 animate-pulse"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  className="h-2 w-2 rounded-full bg-primary/60 animate-pulse"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {step === "results" && (
            <>
              {/* Source/Restaurant name */}
              {sourceName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                  <UtensilsCrossed className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{sourceName}</span>
                </div>
              )}

              {/* Summary badges */}
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const matches = extractedWines.map((w) =>
                    fuzzyMatch(w, userWines)
                  );
                  const exactCount = matches.filter(
                    (m) => m.type === "exact"
                  ).length;
                  const similarCount = matches.filter(
                    (m) => m.type === "similar"
                  ).length;
                  return (
                    <>
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
                    </>
                  );
                })()}
              </div>

              {/* Wine list */}
              <div className="space-y-3">
                {extractedWines.map((wine, idx) => {
                  const match = fuzzyMatch(wine, userWines);
                  const wineKey = `${wine.name}-${wine.winery}`;
                  const isAdded = addedWines.has(wineKey);
                  const typeColor =
                    WINE_TYPE_COLORS[wine.type as WineType] ?? "#888";
                  const typeLabel =
                    WINE_TYPE_LABELS[wine.type as WineType] ?? wine.type;

                  return (
                    <div
                      key={`${wine.name}-${wine.winery}-${idx}`}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      {/* Match indicator */}
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

                          {/* Wine details */}
                          <p className="font-medium text-sm mt-1 truncate">
                            {wine.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {wine.winery}
                            {wine.vintage ? ` \u00B7 ${wine.vintage}` : ""}
                          </p>

                          {/* Ratings strip — always visible. Shows critic
                              scores from AI extraction + the user's own
                              rating when this wine is in their cellar.
                              Renders "—" placeholders so the column never
                              collapses to nothing. */}
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

                        {/* Type badge */}
                        <Badge
                          variant="outline"
                          className="text-xs shrink-0"
                          style={{
                            borderColor: typeColor,
                            color: typeColor,
                          }}
                        >
                          {typeLabel}
                        </Badge>
                      </div>

                      {/* Matched cellar wine info */}
                      {match.type === "exact" && (
                        <div className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded px-2 py-1">
                          Matches: {match.wine.name} ({match.wine.winery}
                          {match.wine.vintage
                            ? `, ${match.wine.vintage}`
                            : ""}
                          )
                        </div>
                      )}
                      {match.type === "similar" && (
                        <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1">
                          Similar to: {match.wine.name} ({match.wine.winery})
                        </div>
                      )}

                      {/* Action buttons */}
                      {match.type !== "exact" && onAddToBuyList && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5 text-xs"
                          disabled={isAdded}
                          onClick={() => handleAddToBuyList(wine)}
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
            </>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex justify-between gap-2 pt-2">
          {step === "capture" && (
            <Button
              type="button"
              variant="outline"
              className="ml-auto"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
          )}

          {step === "results" && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={resetAll}
              >
                <ArrowLeft className="h-4 w-4" />
                Scan Another
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Done
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ratings strip ──────────────────────────────────────────────
// Always-visible row of critic scores + the user's own rating.
// Designed to draw the eye on a wine list scan since the user told us
// "scanning a wine list should always show the ratings — that's the most
// important part." Renders "—" for missing critics so the layout stays
// stable and users can see at a glance which wines have no published score.

function RatingsStrip({
  critic,
  userRating,
  matchType,
}: {
  critic: { rating_ws?: number; rating_rp?: number; rating_jd?: number; rating_ag?: number } | null;
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
      {/* Critic scores — 100-point scale */}
      <RatingPill label="WS" value={ws} />
      <RatingPill label="RP" value={rp} />
      <RatingPill label="JD" value={jd} />
      <RatingPill label="AG" value={ag} />

      {/* Separator */}
      <span className="h-3 w-px bg-border mx-0.5" aria-hidden />

      {/* User's personal rating — 5-star scale, shown when this wine
          matches one in the user's cellar. */}
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
          <Star className={cn("h-2.5 w-2.5", userRating !== null && "fill-current")} />
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
  const hasValue = value !== null && value !== undefined;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border tabular-nums",
        hasValue
          ? "border-primary/30 bg-primary/5 text-primary font-semibold"
          : "border-border text-muted-foreground/60"
      )}
      title={`${label} ${hasValue ? value : "no score"}`}
    >
      <span className="text-[9px] uppercase tracking-wider opacity-70">{label}</span>
      <span>{hasValue ? value : "—"}</span>
    </span>
  );
}
