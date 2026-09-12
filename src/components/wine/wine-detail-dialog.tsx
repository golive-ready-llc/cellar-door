"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { DialRateDialog } from "./dial-rate-dialog";
import { toast } from "@/components/ui/custom-toast";
import { generateWineCard, shareCanvas } from "@/lib/share-utils";
import {
  Wine as WineIcon,
  MapPin,
  Pencil,
  Sparkles,
  Loader2,
  ArrowLeft,
  PlusCircle,
  Copy,
  Star,
  LayoutGrid,
  Share2,
  GlassWater,
  Mountain,
} from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  WINE_TYPES,
  WINE_TYPE_LABELS,
  WINE_TYPE_COLORS,
  DISPOSITION_OPTIONS,
} from "@/types/constants";
import { isLightWineType, BOTTLE_SIZE_LABELS, BOTTLE_SIZE_ORDER } from "@/types/wine";
import type { Wine, Cabinet, Wall } from "@/types/wine";
import { TagSelector } from "@/components/wine/tag-selector";
import { WineLabelThumbnail } from "@/components/wine/wine-label-thumbnail";
import { WineDetailBody } from "@/components/wine/wine-detail-body";
import { DecantTimerDialog } from "@/components/wine/decant-timer-dialog";
import { DuplicateCountDialog } from "@/components/wine/duplicate-count-dialog";
import { VintageStory } from "@/components/wine/vintage-story";
import { aiEnrichWine } from "@/server/actions/ai";
import { TerroirTwinDialog } from "@/components/wine/terroir-twin-dialog";
import { CdScoreSection } from "@/components/community/community-score";
import { useTier } from "@/hooks/use-tier";
import { useAiToggle } from "@/hooks/use-ai-toggle";
import { UpgradePrompt } from "@/components/tier/upgrade-prompt";
import { submitCdRating } from "@/lib/data";
import { getEffectiveDisposition } from "@/lib/drink-window";
import { useWineData } from "@/contexts/wine-data-context";
import { getWineStorageInfo } from "@/lib/cellar-utils";

interface WineDetailDialogProps {
  wine: Wine;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConsume?: () => void;
  onUpdate?: (updates: Partial<Wine>) => void;
  onSave?: (wineId: string, data: Partial<Wine>) => Promise<void>;
  /** When true, open directly in edit mode (e.g. long-press → edit) */
  initialEditing?: boolean;
  /** Callback to add another bottle of the same wine. Cellar-specific —
   * other pages don't have this concept (the cellar page knows the slot
   * to insert into). */
  onAddBottle?: () => void;
  /** Override the default Show-in-Cellar behavior. The default (from
   * WineDataContext) navigates to /cellar?wine=… so every page gets
   * this for free. Cellar passes a custom impl to avoid the round-trip. */
  onShowInCellar?: () => void;
  /** Callback to duplicate the wine (for buying in cases). Page-specific.
   * Receives the count picked by the user via the duplicate-count dialog
   * (default 1 for backward compat with callers that pre-date the picker). */
  onDuplicate?: (count: number) => void | Promise<void>;
  /** Callback when clicking a wine from Terroir Twin results.
   * Page-specific — defaults to no-op (dialog auto-replaces self via
   * its own state handling). */
  onTerroirWineClick?: (wine: Wine) => void;
}

export function WineDetailDialog({
  wine,
  open,
  onOpenChange,
  onConsume,
  onUpdate,
  onSave,
  onAddBottle,
  onShowInCellar,
  onDuplicate,
  onTerroirWineClick,
  initialEditing = false,
}: WineDetailDialogProps) {
  // Single source of truth for cellar data — every (app) page populates
  // this via WineDataProvider, so the dialog's feature set no longer
  // depends on which page mounted it.
  const {
    wines: cellarWines,
    cabinets,
    walls,
    allTags,
    showInCellar: ctxShowInCellar,
  } = useWineData();

  // Storage info computed from cabinet+wines so the Add/Remove Bottle row
  // shows up correctly regardless of mount site. Used to be passed as 3
  // separate props that callers had to remember to wire up.
  const { type: storageType, count: storageCount, capacity: storageCapacity } =
    useMemo(() => getWineStorageInfo(wine, cabinets, cellarWines), [
      wine,
      cabinets,
      cellarWines,
    ]);

  // Default Show-in-Cellar: route via context unless caller supplied a
  // page-specific impl (e.g. cellar page scrolls instead of navigating).
  const resolvedShowInCellar =
    onShowInCellar ?? (wine.cabinetId ? () => ctxShowInCellar(wine) : undefined);
  const [editing, setEditing] = useState(false);
  const openedAtRef = useRef<number>(0);
  // Block pointer events briefly after open to absorb ghost clicks from the
  // touch that opened this dialog (mobile browsers synthesize a click ~300ms
  // after pointerup, which can land on newly-rendered interactive elements).
  const [ghostShield, setGhostShield] = useState(false);

  // When dialog opens, jump to edit mode if initialEditing is set
  // When dialog closes, reset after a small delay to avoid flash
  useEffect(() => {
    if (open) {
      openedAtRef.current = Date.now();
      if (initialEditing && onSave) setEditing(true);
      // Engage ghost-click shield for 450ms
      setGhostShield(true);
      const t = setTimeout(() => setGhostShield(false), 450);
      return () => clearTimeout(t);
    } else {
      const timer = setTimeout(() => setEditing(false), 200);
      return () => clearTimeout(timer);
    }
  }, [open, initialEditing, onSave]);

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        // Guard: ignore backdrop/outside-click close within 400ms of opening
        // to prevent synthesized pointer events on touch devices from
        // immediately dismissing the dialog
        if (!newOpen && Date.now() - openedAtRef.current < 400) return;
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className={cn("w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto", ghostShield && "pointer-events-none")}>
        {editing ? (
          <InlineEditForm
            wine={wine}
            cabinets={cabinets}
            allTags={allTags}
            onSave={async (data) => {
              await onSave?.(wine.id, data);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <DetailView
            wine={wine}
            onEdit={onSave ? () => setEditing(true) : undefined}
            onConsume={onConsume}
            onUpdate={onUpdate}
            cabinets={cabinets}
            walls={walls}
            storageType={storageType}
            storageCount={storageCount}
            storageCapacity={storageCapacity}
            onAddBottle={onAddBottle}
            onShowInCellar={resolvedShowInCellar}
            onDuplicate={onDuplicate}
            cellarWines={cellarWines}
            onTerroirWineClick={onTerroirWineClick}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Rating Display — shows decimal rating + opens dial dialog on tap
// ============================================================

function RatingDisplay({
  rating,
  onRate,
}: {
  rating: number | null;
  onRate?: (rating: number) => void;
}) {
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const hasRating = rating != null && rating > 0;

  return (
    <>
      <button
        type="button"
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 transition-colors",
          onRate && "hover:bg-muted/50 active:bg-muted cursor-pointer"
        )}
        onClick={() => onRate && setRateDialogOpen(true)}
        disabled={!onRate}
      >
        {hasRating ? (
          <>
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            <span className="text-lg font-bold tabular-nums">{rating!.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">/ 5</span>
          </>
        ) : onRate ? (
          <span className="text-xs text-muted-foreground italic flex items-center gap-1.5">
            <Star className="h-4 w-4 text-muted-foreground/30" />
            Tap to rate
          </span>
        ) : null}
      </button>

      {onRate && (
        <DialRateDialog
          open={rateDialogOpen}
          onOpenChange={setRateDialogOpen}
          currentRating={rating}
          onRate={(r) => {
            onRate(r);
            setRateDialogOpen(false);
          }}
        />
      )}
    </>
  );
}

// ============================================================
// Dial Rate Dialog — speedometer gauge with colored segments
// ============================================================

// DialRateDialog is imported from ./dial-rate-dialog

// ============================================================
// Detail View — the read-only wine details
// ============================================================

function DetailView({
  wine,
  onEdit,
  onConsume,
  onUpdate,
  cabinets = [],
  walls = [],
  storageType,
  storageCount,
  storageCapacity,
  onAddBottle,
  onShowInCellar,
  onDuplicate,
  cellarWines,
  onTerroirWineClick,
}: {
  wine: Wine;
  onEdit?: () => void;
  onConsume?: () => void;
  onUpdate?: (updates: Partial<Wine>) => void;
  cabinets?: Cabinet[];
  walls?: Wall[];
  storageType?: "box" | "bulk" | null;
  storageCount?: number;
  storageCapacity?: number;
  onAddBottle?: () => void;
  onShowInCellar?: () => void;
  onDuplicate?: (count: number) => void | Promise<void>;
  cellarWines?: Wine[];
  onTerroirWineClick?: (wine: Wine) => void;
}) {
  // Guard against phantom taps on buttons when dialog first appears on mobile
  const mountedAtRef = useRef<number>(Date.now());
  useEffect(() => { mountedAtRef.current = Date.now(); }, [wine?.id]);

  // Duplicate-count picker state — replaces the old one-bottle-at-a-time
  // behavior. Opens when user taps "Duplicate", confirms with a count,
  // calls onDuplicate(count) which loops addWine.
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  const { hasAI: tierHasAI, userId, can } = useTier();
  const { aiUserEnabled } = useAiToggle();
  const hasAI = tierHasAI && aiUserEnabled;
  const canFindImage = can("aiFindImage") && aiUserEnabled;

  // Single unified AI loading state
  const [enriching, setEnriching] = useState(false);

  // Track CD Score locally so it updates after rating
  const [cdScore, setCdScore] = useState(wine.cdScore ?? null);
  const [cdRatingCount, setCdRatingCount] = useState(wine.cdRatingCount ?? 0);

  // Eagerly fetch the community CD Score when the dialog opens so it's
  // present by default — don't wait for the user to submit a rating.
  // DetailView only mounts while the dialog is open (DialogContent unmounts
  // closed content), so mount === dialog-open. A previous `if (!open)` guard
  // here accidentally referenced the GLOBAL window.open (DetailView has no
  // `open` prop) and was therefore a truthy no-op — removed.
  useEffect(() => {
    if (cdScore != null) return; // already have one
    let cancelled = false;
    (async () => {
      try {
        const { fetchCommunityScore } = await import("@/lib/data");
        const res = await fetchCommunityScore(wine.name, wine.winery, wine.vintage);
        if (cancelled || !res) return;
        setCdScore(res.cdScore);
        setCdRatingCount(res.cdRatingCount);
      } catch {
        // non-fatal — CD Score is a nice-to-have
      }
    })();
    return () => { cancelled = true; };
  }, [wine.name, wine.winery, wine.vintage, cdScore]);

  // Decant timer dialog state
  const [decantOpen, setDecantOpen] = useState(false);

  // Terroir Twin dialog state
  const [terroirTwinOpen, setTerroirTwinOpen] = useState(false);

  // Memoize so useCallback deps that include wineInput don't thrash on every
  // render (eslint-react flags this at the consumer sites).
  const wineInput = useMemo(() => ({
    name: wine.name,
    winery: wine.winery,
    vintage: wine.vintage,
    type: wine.type,
    region: wine.region,
    country: wine.country,
    grapeVariety: wine.grapeVariety,
    description: wine.description,
    drinkBy: wine.drinkBy,
    price: wine.price,
  }), [wine.name, wine.winery, wine.vintage, wine.type, wine.region, wine.country, wine.grapeVariety, wine.description, wine.drinkBy, wine.price]);

  // ── Single unified AI enrichment handler ──
  // NOTE: Image fetch removed — it was blocking enrichment and returning garbage.
  // Users can still fetch images via the "Find with AI" button on the thumbnail.
  // Once a wine has been AI-enriched (aiEnrichedAt set), the enrich button is
  // hidden entirely — re-enriching is not allowed.
  const handleEnrich = useCallback(async () => {
    if (!onUpdate) return;
    if (wine.aiEnrichedAt) return; // Defensive — UI already hides the button
    setEnriching(true);
    try {
      const result = await aiEnrichWine(wineInput, userId ?? undefined);
      if (result.success) {
        // Only fill fields that are currently empty — never overwrite user-entered data
        const updates: Partial<Wine> = {};
        if (!wine.description && result.data.description) updates.description = result.data.description;
        if (!wine.foodPairings && result.data.foodPairings) updates.foodPairings = result.data.foodPairings;
        if (!wine.retailPrice && result.data.estimatedPrice) updates.retailPrice = result.data.estimatedPrice;
        if (!wine.disposition && result.data.disposition) updates.disposition = result.data.disposition;
        if (!wine.drinkBy && result.data.drinkBy) updates.drinkBy = result.data.drinkBy;
        if (!wine.drinkWindow && result.data.drinkWindow) updates.drinkWindow = result.data.drinkWindow;
        // AI ratings are always additive (won't overwrite user ratings)
        if (result.data.ratings) updates.aiRatings = result.data.ratings;
        // Stamp the enrichment timestamp so bulk-enrich knows this wine was
        // already processed — even if AI returned empty fields for it.
        updates.aiEnrichedAt = new Date().toISOString();

        // Also fetch a label image if the wine doesn't have one (PREMIUM only — uses expensive grounding)
        if (!wine.imageUrl && canFindImage) {
          try {
            const { aiFetchWineImage } = await import("@/server/actions/ai");
            const imgResult = await Promise.race([
              aiFetchWineImage(wineInput, userId ?? undefined),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 20000)),
            ]);
            if (imgResult.success && imgResult.data.imageUrl &&
                (imgResult.data.imageUrl.startsWith("data:") || imgResult.data.imageUrl.startsWith("http"))) {
              updates.imageUrl = imgResult.data.imageUrl;
            }
          } catch {
            // Image fetch is best-effort — don't block enrichment
          }
        }

        onUpdate(updates);
        toast.success("Wine enriched with AI data");
      } else {
        // Simplify error messages for the user
        const msg = result.error?.includes("429") || result.error?.includes("quota")
          ? "AI service quota exceeded — please try again later"
          : result.error?.includes("UPGRADE_REQUIRED")
            ? "Upgrade required for AI enrichment"
            : result.error || "AI enrichment failed";
        toast.error(msg);
      }
    } catch {
      toast.error("AI enrichment failed — check your connection");
    } finally {
      setEnriching(false);
    }
  }, [wine, onUpdate, userId, canFindImage, wineInput]);

  const handleAiFetchImage = useCallback(async () => {
    const { aiFetchWineImage } = await import("@/server/actions/ai");
    try {
      // Race against 20s timeout — image search + server-side download can take time
      const result = await Promise.race([
        aiFetchWineImage(wineInput, userId ?? undefined),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 20000)
        ),
      ]);
      if (result.success && result.data.imageUrl) {
        // Accept both data URLs and http URLs
        if (result.data.imageUrl.startsWith("data:") || result.data.imageUrl.startsWith("http")) {
          return result.data.imageUrl;
        }
        toast.error("AI couldn't find a label image — try uploading a photo");
        return "";
      }
      if (result.success && !result.data.imageUrl) {
        toast.error("No label image found — try uploading a photo");
        return "";
      }
      if (!result.success) {
        const msg = result.error?.includes("429") || result.error?.includes("quota")
          ? "AI service quota exceeded — please try again later"
          : result.error || "Could not find a label image";
        toast.error(msg);
      }
    } catch {
      toast.error("Image search timed out — try uploading a photo instead");
    }
    return "";
  }, [wineInput, userId]);

  // ── Handle user rating: save locally + submit to CD Score ──
  const handleRate = useCallback(
    async (newRating: number) => {
      if (!onUpdate) return;
      const actualRating = newRating === 0 ? null : newRating;
      onUpdate({ userRating: actualRating });

      // Expert Score: scoring a wine that has no critic scores yet triggers
      // a background estimate so the Expert Score appears next to the user's
      // rating. Persisting via onUpdate also seeds the CD-Score baseline
      // (updateWine reseeds whenever aiRatings is set).
      if (actualRating && hasAI && !wine.aiRatings) {
        void (async () => {
          try {
            const { aiEstimateCriticScores } = await import("@/server/actions/ai");
            const result = await aiEstimateCriticScores(wineInput, userId ?? undefined);
            if (result.success && !result.isMock && result.data.ratings) {
              onUpdate({ aiRatings: result.data.ratings });
            }
          } catch {
            // Best-effort — the wine simply keeps no Expert Score for now.
          }
        })();
      }

      // Also submit to community CD Score (user's rating IS the CD rating)
      if (actualRating && actualRating > 0) {
        try {
          const result = await submitCdRating(
            wine.name,
            wine.winery,
            wine.vintage,
            wine.type,
            wine.region,
            wine.country,
            actualRating,
            wine.tastingNotes || "" // tasting notes double as CD review
          );
          setCdScore(result.cdScore);
          setCdRatingCount(result.cdRatingCount);
          onUpdate({ cdScore: result.cdScore, cdRatingCount: result.cdRatingCount });
        } catch {
          // CD Score submission is best-effort
        }
      }
    },
    [wine, onUpdate, hasAI, userId, wineInput]
  );

  return (
    <>
      <WineDetailBody
        data={{
          name: wine.name,
          winery: wine.winery,
          vintage: wine.vintage,
          type: wine.type,
          imageUrl: wine.imageUrl,
          region: wine.region,
          country: wine.country,
          grapeVariety: wine.grapeVariety,
          alcohol: wine.alcohol,
          drinkWindow: wine.drinkWindow,
          drinkBy: wine.drinkBy,
          price: wine.price,
          retailPrice: wine.retailPrice,
          purchaseDate: wine.purchaseDate,
          barcode: wine.barcode,
          description: wine.description,
          foodPairings: wine.foodPairings,
          tastingNotes: wine.tastingNotes,
          notes: wine.notes,
          disposition: getEffectiveDisposition(wine) ?? undefined,
          sparkling: wine.sparkling,
          bottleSize: wine.bottleSize,
          tags: wine.tags,
          aiRatings: hasAI ? wine.aiRatings : null,
          cdScore,
          cdRatingCount,
        }}
        onImageChange={
          onUpdate ? (imageUrl: string) => onUpdate({ imageUrl }) : undefined
        }
        onAiFetchImage={onUpdate && canFindImage ? handleAiFetchImage : undefined}
        headerExtra={
          <>
            {wine.region && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {wine.region}
                {wine.country ? `, ${wine.country}` : ""}
              </p>
            )}
            {(() => {
              const cab = wine.cabinetId ? cabinets.find((c) => c.id === wine.cabinetId) : null;
              const wall = cab ? walls.find((w) => w.id === cab.wallId) : null;
              if (!cab) return null;
              const posLabel = wine.row !== null && wine.col !== null
                ? `Row ${wine.row + 1}, Col ${wine.col + 1}`
                : null;
              return (
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={onShowInCellar}
                  title="Find in cellar"
                >
                  <LayoutGrid className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {wall ? `${wall.name} › ` : ""}{cab.name}
                    {posLabel ? ` › ${posLabel}` : ""}
                  </span>
                  {onShowInCellar && (
                    <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium px-1.5 py-0.5 shrink-0">
                      <MapPin className="h-2.5 w-2.5" />
                      Find
                    </span>
                  )}
                </button>
              );
            })()}
          </>
        }
        ratingSlot={
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5 ml-2">Your Rating</p>
            <RatingDisplay
              rating={wine.userRating}
              onRate={onUpdate ? handleRate : undefined}
            />
          </div>
        }
        actions={
          <>
      <div className="space-y-2">
        {/* Row 1: Primary — Edit + Enrich */}
        <div className="grid grid-cols-2 gap-2">
          {onEdit && (
            <Button variant="outline" className="h-11 gap-2" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
          {onUpdate && hasAI && !wine.aiEnrichedAt && (
            <Button
              variant="ai"
              className="h-11 gap-2"
              onClick={handleEnrich}
              disabled={enriching}
              title="AI-enrich this wine"
            >
              {enriching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {enriching ? "Enriching..." : "Enrich"}
            </Button>
          )}
          {onUpdate && hasAI && wine.aiEnrichedAt && (
            <div className="flex items-center justify-center h-11 gap-1.5 rounded-lg border border-green-300/50 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800/30 text-xs text-green-700 dark:text-green-400 font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              AI Enriched
            </div>
          )}
          {onUpdate && !tierHasAI && (
            <div className="col-span-1">
              <UpgradePrompt feature="AI Enrichment" variant="inline" />
            </div>
          )}
        </div>

        {/* Row 2: AI features — Decant + Terroir Twins */}
        {hasAI && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ai"
              className="h-11 gap-2"
              onClick={() => setDecantOpen(true)}
            >
              <GlassWater className="h-4 w-4" />
              Decant
            </Button>
            {cellarWines && (
              <Button
                variant="ai"
                className="h-11 gap-2"
                onClick={() => setTerroirTwinOpen(true)}
              >
                <Mountain className="h-4 w-4" />
                Terroir Twins
              </Button>
            )}
          </div>
        )}

        {/* Row 3: Utilities. Three columns when this row owns Remove (slot
            wines), two columns when storageType moves Remove into the
            dedicated Add/Remove Bottle row below — otherwise we'd render
            an empty div and Duplicate/Share would float right of a gap. */}
        {(() => {
          const showInlineRemove = !storageType && !!onConsume;
          const cols = showInlineRemove ? "grid-cols-3" : "grid-cols-2";
          return (
            <div className={`grid ${cols} gap-2`}>
              {showInlineRemove && (
                <Button
                  variant="destructive"
                  className="h-12 flex-col gap-1 px-2 text-xs font-normal"
                  onClick={onConsume}
                >
                  <WineIcon className="h-4 w-4" />
                  Remove
                </Button>
              )}
              {onDuplicate ? (
                <Button
                  variant="outline"
                  className="h-12 flex-col gap-1 px-2 text-xs font-normal"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (Date.now() - mountedAtRef.current < 600) return;
                    setDuplicateOpen(true);
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Duplicate
                </Button>
              ) : <div />}
              <Button
                variant="outline"
                className="h-12 flex-col gap-1 px-2 text-xs font-normal"
                onClick={async () => {
                  const canvas = generateWineCard({
                    name: wine.name,
                    winery: wine.winery,
                    vintage: wine.vintage,
                    type: wine.type,
                    region: wine.region,
                    country: wine.country,
                    userRating: wine.userRating,
                    description: wine.description,
                  });
                  await shareCanvas(canvas, wine.name);
                }}
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          );
        })()}
      </div>

      {/* Box/Bulk storage actions — same h-11 grid styling as the action rows
          above so button sizing stays consistent across detail-view contexts. */}
      {storageType && (onAddBottle || onConsume) && (
        <div
          className={`grid ${onAddBottle && onConsume ? "grid-cols-2" : "grid-cols-1"} gap-2`}
        >
          {onAddBottle && (
            <Button
              variant="outline"
              className="h-11 gap-2 text-primary hover:text-primary"
              onClick={onAddBottle}
              disabled={!!storageCapacity && !!storageCount && storageCount >= storageCapacity}
            >
              <PlusCircle className="h-4 w-4" />
              Add Bottle
              {storageCount !== undefined && storageCapacity ? (
                <span className="ml-1 text-muted-foreground">
                  ({storageCount}/{storageCapacity})
                </span>
              ) : null}
            </Button>
          )}
          {onConsume && (
            <Button
              variant="destructive"
              className="h-11 gap-2"
              onClick={onConsume}
            >
              <WineIcon className="h-4 w-4" />
              Remove Bottle
            </Button>
          )}
        </div>
      )}
          </>
        }
      >
        <CdScoreSection
          wineName={wine.name}
          wineWinery={wine.winery}
          wineVintage={wine.vintage}
          wineType={wine.type}
          wineRegion={wine.region}
          wineCountry={wine.country}
          cdScore={cdScore}
          cdRatingCount={cdRatingCount}
          onScoreUpdate={(s, c) => {
            setCdScore(s);
            setCdRatingCount(c);
            onUpdate?.({ cdScore: s, cdRatingCount: c });
          }}
        />

        {/* Vintage Time Machine */}
        {hasAI && wine.vintage && wine.region && (
          <VintageStory
            vintage={wine.vintage}
            region={wine.region}
            country={wine.country}
            userId={userId}
          />
        )}
      </WineDetailBody>

      {/* Close button — visible on mobile where the X icon may be hard to tap */}
      <DialogFooter showCloseButton className="sm:hidden" />

      {/* Decant Timer Dialog */}
      <DecantTimerDialog
        wine={wine}
        open={decantOpen}
        onOpenChange={setDecantOpen}
        userId={userId}
      />

      {/* Terroir Twin Dialog */}
      {cellarWines && (
        <TerroirTwinDialog
          wine={wine}
          open={terroirTwinOpen}
          onOpenChange={setTerroirTwinOpen}
          cellarWines={cellarWines}
          onWineClick={onTerroirWineClick}
        />
      )}

      {/* Duplicate-count picker — opens when user taps Duplicate. The
          confirm callback loops the page-level onDuplicate handler,
          which knows how to actually create the bottles. */}
      {onDuplicate && (
        <DuplicateCountDialog
          open={duplicateOpen}
          onOpenChange={setDuplicateOpen}
          wineName={wine.name}
          onConfirm={async (count) => {
            await onDuplicate(count);
          }}
        />
      )}
    </>
  );
}

// ============================================================
// Inline Edit Form — edit fields inside the same dialog
// ============================================================

function InlineEditForm({
  wine,
  cabinets,
  allTags,
  onSave,
  onCancel,
}: {
  wine: Wine;
  cabinets: Cabinet[];
  allTags: string[];
  onSave: (data: Partial<Wine>) => Promise<void>;
  onCancel: () => void;
}) {
  const { can } = useTier();
  const { aiUserEnabled } = useAiToggle();
  const canFindImage = can("aiFindImage") && aiUserEnabled;
  const [saving, setSaving] = useState(false);

  // Form state
  const [imageUrl, setImageUrl] = useState(wine.imageUrl);
  const [name, setName] = useState(wine.name);
  const [winery, setWinery] = useState(wine.winery);
  const [vintage, setVintage] = useState(wine.vintage?.toString() ?? "");
  const [type, setType] = useState(wine.type);
  const [sparkling, setSparkling] = useState(wine.sparkling ?? false);
  const [grapeVariety, setGrapeVariety] = useState(wine.grapeVariety);
  const [bottleSize, setBottleSize] = useState<string>(wine.bottleSize ?? "standard");
  const [region, setRegion] = useState(wine.region);
  const [country, setCountry] = useState(wine.country);
  const [price, setPrice] = useState(wine.price?.toString() ?? "");
  const [retailPrice, setRetailPrice] = useState(wine.retailPrice?.toString() ?? "");
  const [alcohol, setAlcohol] = useState(wine.alcohol);
  const [cabinetId, setCabinetId] = useState(wine.cabinetId ?? "");
  const [notes, setNotes] = useState(wine.notes);
  const [description, setDescription] = useState(wine.description);
  const [disposition, setDisposition] = useState(wine.disposition);
  const [drinkWindow, setDrinkWindow] = useState(wine.drinkWindow);
  const [foodPairings, setFoodPairings] = useState(wine.foodPairings);
  const [tags, setTags] = useState<string[]>(wine.tags ?? []);
  const [tastingNotes, setTastingNotes] = useState(wine.tastingNotes ?? "");

  const typeColor =
    WINE_TYPE_COLORS[wine.type as keyof typeof WINE_TYPE_COLORS] || "#666";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        imageUrl,
        name: name.trim(),
        winery: winery.trim(),
        vintage: vintage ? parseInt(vintage, 10) : null,
        type: type as Wine["type"],
        sparkling,
        grapeVariety: grapeVariety.trim(),
        bottleSize: bottleSize as Wine["bottleSize"],
        region: region.trim(),
        country: country.trim(),
        price: price ? parseFloat(price) : null,
        retailPrice: retailPrice ? parseFloat(retailPrice) : null,
        alcohol: alcohol.trim(),
        cabinetId: cabinetId || null,
        notes: notes.trim(),
        description: description.trim(),
        disposition,
        drinkWindow: drinkWindow.trim(),
        foodPairings: foodPairings.trim(),
        tags,
        tastingNotes: tastingNotes.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAiFetchImage = useCallback(async () => {
    const { aiFetchWineImage } = await import("@/server/actions/ai");
    try {
      const result = await Promise.race([
        aiFetchWineImage({
          name: wine.name,
          winery: wine.winery,
          vintage: wine.vintage,
          type: wine.type,
          region: wine.region,
          country: wine.country,
          grapeVariety: wine.grapeVariety,
          description: wine.description,
          drinkBy: wine.drinkBy,
          price: wine.price,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 20000)
        ),
      ]);
      if (result.success && result.data.imageUrl) {
        if (result.data.imageUrl.startsWith("data:") || result.data.imageUrl.startsWith("http")) {
          return result.data.imageUrl;
        }
        return "";
      }
    } catch {
      // Timed out — return empty
    }
    return "";
  }, [wine]);

  return (
    <form onSubmit={handleSubmit}>
      {/* Header with thumbnail */}
      <div className="flex items-start gap-4">
        <WineLabelThumbnail
          imageUrl={imageUrl}
          wineName={wine.name}
          onImageChange={setImageUrl}
          onAiFetch={canFindImage ? handleAiFetchImage : undefined}
        />
        <div className="flex-1 min-w-0">
          <DialogHeader className="p-0">
            <DialogTitle className="flex items-center gap-2">
              <button
                type="button"
                className="shrink-0 p-1 -ml-1 rounded-md hover:bg-muted transition-colors"
                onClick={onCancel}
              >
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <div
                className={cn(
                  "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                  isLightWineType(wine.type) && "border-2 border-border"
                )}
                style={{ backgroundColor: typeColor }}
              >
                <WineIcon
                  className="h-4 w-4"
                  style={{ color: isLightWineType(wine.type) ? "#333" : "#fff" }}
                />
              </div>
              Edit Wine
            </DialogTitle>
          </DialogHeader>
        </div>
      </div>

      <div className="grid gap-4 py-4">
        {/* Name */}
        <div className="grid gap-2">
          <Label htmlFor="edit-wine-name">
            Wine Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="edit-wine-name"
            placeholder="e.g. Caymus Cabernet Sauvignon"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        {/* Winery + Vintage */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 grid gap-2">
            <Label htmlFor="edit-wine-winery">Winery</Label>
            <Input
              id="edit-wine-winery"
              placeholder="e.g. Caymus Vineyards"
              value={winery}
              onChange={(e) => setWinery(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-wine-vintage">Vintage</Label>
            <Input
              id="edit-wine-vintage"
              type="number"
              placeholder="2021"
              min={1900}
              max={2099}
              value={vintage}
              onChange={(e) => setVintage(e.target.value)}
            />
          </div>
        </div>

        {/* Type + Grape */}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => { if (v) setType(v); }}>
              <SelectTrigger>
                <SelectValue>
                  {WINE_TYPE_LABELS[type as keyof typeof WINE_TYPE_LABELS] || type}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {WINE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {WINE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-border accent-amber-500"
                checked={sparkling}
                onChange={(e) => setSparkling(e.target.checked)}
              />
              Sparkling
            </label>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-wine-grape">Grape Variety</Label>
            <Input
              id="edit-wine-grape"
              placeholder="e.g. Cabernet Sauvignon"
              value={grapeVariety}
              onChange={(e) => setGrapeVariety(e.target.value)}
            />
          </div>
        </div>

        {/* Region + Country */}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="edit-wine-region">Region</Label>
            <Input
              id="edit-wine-region"
              placeholder="e.g. Napa Valley"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-wine-country">Country</Label>
            <Input
              id="edit-wine-country"
              placeholder="e.g. USA"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
        </div>

        {/* Purchase Price + Market Value */}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="edit-wine-price">Purchase Price ($)</Label>
            <Input
              id="edit-wine-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-wine-retail-price">Market Value ($)</Label>
            <Input
              id="edit-wine-retail-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={retailPrice}
              onChange={(e) => setRetailPrice(e.target.value)}
            />
          </div>
        </div>

        {/* Bottle Size — drives the Sort Assistant's slot-fit checks */}
        <div className="grid gap-2">
          <Label>Bottle Size</Label>
          <Select value={bottleSize} onValueChange={(v) => { if (v) setBottleSize(v); }}>
            <SelectTrigger>
              <SelectValue>
                {BOTTLE_SIZE_LABELS[bottleSize as keyof typeof BOTTLE_SIZE_LABELS] || bottleSize}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BOTTLE_SIZE_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {BOTTLE_SIZE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Alcohol + Section */}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="edit-wine-alcohol">Alcohol</Label>
            <Input
              id="edit-wine-alcohol"
              placeholder="14.5%"
              value={alcohol}
              onChange={(e) => setAlcohol(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Section</Label>
            <Select value={cabinetId} onValueChange={(v) => setCabinetId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select...">
                  {cabinets.find((c) => c.id === cabinetId)?.name || "Unassigned"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {cabinets.map((cab) => (
                  <SelectItem key={cab.id} value={cab.id}>
                    {cab.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Disposition + Drink Window */}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Disposition</Label>
            <Select value={disposition} onValueChange={(v) => setDisposition(v ?? "")}>
              <SelectTrigger>
                <SelectValue>
                  {DISPOSITION_OPTIONS.find((d) => d.value === disposition)?.label ?? "Not set"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DISPOSITION_OPTIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-wine-drink-window">Drink Window</Label>
            <Input
              id="edit-wine-drink-window"
              placeholder="2025-2030"
              value={drinkWindow}
              onChange={(e) => setDrinkWindow(e.target.value)}
            />
          </div>
        </div>

        {/* Tags */}
        <div className="grid gap-2">
          <Label>Tags</Label>
          <TagSelector tags={tags} onChange={setTags} allTags={allTags} />
        </div>

        {/* Food Pairings */}
        <div className="grid gap-2">
          <Label htmlFor="edit-wine-pairings">Food Pairings</Label>
          <Input
            id="edit-wine-pairings"
            placeholder="Steak, lamb, aged cheese..."
            value={foodPairings}
            onChange={(e) => setFoodPairings(e.target.value)}
          />
        </div>

        {/* Tasting Notes — single free-text field */}
        <div className="grid gap-2">
          <Label htmlFor="edit-wine-tasting-notes">Tasting Notes</Label>
          <Textarea
            id="edit-wine-tasting-notes"
            placeholder="Your tasting notes — aromas, flavors, finish, overall impression..."
            value={tastingNotes}
            onChange={(e) => setTastingNotes(e.target.value)}
            rows={3}
          />
        </div>

        {/* Description */}
        <div className="grid gap-2">
          <Label htmlFor="edit-wine-description">Description</Label>
          <Textarea
            id="edit-wine-description"
            placeholder="Wine description, producer notes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        {/* Notes */}
        <div className="grid gap-2">
          <Label htmlFor="edit-wine-notes">Personal Notes</Label>
          <Textarea
            id="edit-wine-notes"
            placeholder="Your personal notes about this wine..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
