"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Wine as WineIcon,
  Star,
  Gift,
  DollarSign,
  AlertTriangle,
  CircleOff,
  HelpCircle,
  Calendar,
  Trash2,
  Pencil,
  Save,
  X,
  Loader2,
  Share2,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { WineDetailBody } from "@/components/wine/wine-detail-body";
import { StarRating } from "@/components/ui/star-rating";
import { DialRateDialog } from "@/components/wine/dial-rate-dialog";
import {
  REMOVAL_REASONS,
  WINE_TYPES,
  WINE_TYPE_LABELS,
  WINE_TYPE_COLORS,
  DISPOSITION_LABELS,
  type RemovalReasonId,
} from "@/types/constants";
import { DISPOSITION_COLORS } from "@/components/cellar/cabinet-grid-utils";
import type { WineHistoryItem, WineType } from "@/types/wine";
import { toast } from "@/components/ui/custom-toast";
import { useTier } from "@/hooks/use-tier";

const REASON_META: Record<
  RemovalReasonId,
  { label: string; icon: typeof WineIcon; color: string }
> = {
  drank: { label: "Drank", icon: WineIcon, color: "#22C55E" },
  gifted: { label: "Gifted", icon: Gift, color: "#A855F7" },
  sold: { label: "Sold", icon: DollarSign, color: "#3B82F6" },
  broken: { label: "Broken", icon: AlertTriangle, color: "#F97316" },
  spoiled: { label: "Spoiled", icon: CircleOff, color: "#EF4444" },
  other: { label: "Other", icon: HelpCircle, color: "#6B7280" },
};

interface HistoryDetailDialogProps {
  item: WineHistoryItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatPrice: (amount: number, decimals?: number) => string;
  onDelete?: () => void;
  onUpdate?: (id: string, updates: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
}

export function HistoryDetailDialog({
  item,
  open,
  onOpenChange,
  formatPrice,
  onDelete,
  onUpdate,
}: HistoryDetailDialogProps) {
  const { hasAI } = useTier();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [enriching, setEnriching] = useState(false);

  // Community CD Score — fetched on open, shown via the shared body.
  const [cdScore, setCdScore] = useState<number | null>(null);
  const [cdRatingCount, setCdRatingCount] = useState(0);
  useEffect(() => {
    if (!open) return;
    if (cdScore != null) return;
    let cancelled = false;
    (async () => {
      try {
        const { fetchCommunityScore } = await import("@/lib/data");
        const res = await fetchCommunityScore(item.name, item.winery, item.vintage);
        if (cancelled || !res) return;
        setCdScore(res.cdScore);
        setCdRatingCount(res.cdRatingCount);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, item.name, item.winery, item.vintage, cdScore]);

  // Edit form state
  const [name, setName] = useState(item.name);
  const [winery, setWinery] = useState(item.winery);
  const [vintage, setVintage] = useState(item.vintage?.toString() ?? "");
  const [type, setType] = useState(item.type);
  const [region, setRegion] = useState(item.region);
  const [country, setCountry] = useState(item.country);
  const [grapeVariety, setGrapeVariety] = useState(item.grapeVariety);
  const [alcohol, setAlcohol] = useState(item.alcohol);
  const [price, setPrice] = useState(item.price?.toString() ?? "");
  const [retailPrice, setRetailPrice] = useState(item.retailPrice?.toString() ?? "");
  const [description, setDescription] = useState(item.description);
  const [foodPairings, setFoodPairings] = useState(item.foodPairings);
  const [disposition, setDisposition] = useState(item.disposition);
  const [drinkWindow, setDrinkWindow] = useState(item.drinkWindow);
  const [consumeNotes, setConsumeNotes] = useState(item.consumeNotes);
  const [reason, setReason] = useState(item.reason);

  const resetForm = () => {
    setName(item.name);
    setWinery(item.winery);
    setVintage(item.vintage?.toString() ?? "");
    setType(item.type);
    setRegion(item.region);
    setCountry(item.country);
    setGrapeVariety(item.grapeVariety);
    setAlcohol(item.alcohol);
    setPrice(item.price?.toString() ?? "");
    setRetailPrice(item.retailPrice?.toString() ?? "");
    setDescription(item.description);
    setFoodPairings(item.foodPairings);
    setDisposition(item.disposition);
    setDrinkWindow(item.drinkWindow);
    setConsumeNotes(item.consumeNotes);
    setReason(item.reason);
    setEditing(false);
  };

  const handleSave = async () => {
    if (!onUpdate) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        name,
        winery,
        vintage: vintage ? parseInt(vintage, 10) : null,
        type,
        region,
        country,
        grapeVariety,
        alcohol,
        price: price ? parseFloat(price) : null,
        retailPrice: retailPrice ? parseFloat(retailPrice) : null,
        description,
        foodPairings,
        disposition,
        drinkWindow,
        consumeNotes,
        reason,
      };
      const result = await onUpdate(item.id, updates);
      if (result.success) {
        toast.success("History record updated");
        setEditing(false);
      } else {
        toast.error(result.error || "Failed to update");
      }
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleRate = useCallback(
    async (rating: number) => {
      if (!onUpdate) return;
      const result = await onUpdate(item.id, { consumeRating: rating });
      if (result.success) toast.success("Rating saved");
      else toast.error("Failed to save rating");
    },
    [item.id, onUpdate]
  );

  const handleEnrich = useCallback(async () => {
    if (!onUpdate) return;
    setEnriching(true);
    try {
      const { aiEnrichWine } = await import("@/server/actions/ai");
      const wineInput = {
        name: item.name,
        winery: item.winery,
        vintage: item.vintage,
        type: item.type as WineType,
        region: item.region,
        country: item.country,
        grapeVariety: item.grapeVariety,
        description: item.description,
        drinkBy: "",
        price: item.price,
      };
      const result = await aiEnrichWine(wineInput);
      if (result.success) {
        const updates: Record<string, unknown> = {};
        if (!item.description && result.data.description) updates.description = result.data.description;
        if (!item.foodPairings && result.data.foodPairings) updates.foodPairings = result.data.foodPairings;
        if (!item.retailPrice && result.data.estimatedPrice) updates.retailPrice = result.data.estimatedPrice;
        if (!item.drinkWindow && result.data.drinkWindow) updates.drinkWindow = result.data.drinkWindow;
        if (!item.disposition && result.data.disposition) updates.disposition = result.data.disposition;
        if (result.data.ratings) updates.aiRatings = result.data.ratings;
        if (Object.keys(updates).length > 0) {
          await onUpdate(item.id, updates);
          toast.success("Wine enriched");
        } else {
          toast.info("Already fully enriched");
        }
      } else {
        toast.error(result.error || "Enrichment failed");
      }
    } catch {
      toast.error("Enrichment failed");
    } finally {
      setEnriching(false);
    }
  }, [item, onUpdate]);

  const handleShare = useCallback(async () => {
    try {
      const { generateWineCard, shareCanvas } = await import("@/lib/share-utils");
      const canvas = generateWineCard({
        name: item.name,
        winery: item.winery,
        vintage: item.vintage,
        type: item.type,
        region: item.region,
        country: item.country,
        userRating: item.consumeRating ?? item.rating,
        description: item.description || "",
      });
      await shareCanvas(canvas, `${item.name} - Cellar Door`);
    } catch {
      toast.error("Failed to share");
    }
  }, [item]);

  const reasonMeta = REASON_META[item.reason as RemovalReasonId] || REASON_META.other;
  const ReasonIcon = reasonMeta.icon;
  const displayRating = item.consumeRating ?? item.rating;

  const removedDate = new Date(item.removedAt);
  const removedDateStr = removedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>{item.name}</DialogTitle>
        </DialogHeader>

        {editing ? (
          <div className="space-y-4 pt-2">
            {/* Identity */}
            <div className="space-y-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Wine name" className="text-lg font-bold h-auto py-1" />
              <div className="flex gap-2">
                <Input value={winery} onChange={(e) => setWinery(e.target.value)} placeholder="Winery" className="text-sm h-8" />
                <Input value={vintage} onChange={(e) => setVintage(e.target.value)} placeholder="Year" className="text-sm h-8 w-20" type="number" />
              </div>
              <div className="flex gap-2">
                <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Region" className="text-sm h-8" />
                <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="text-sm h-8 w-24" />
              </div>
            </div>

            {/* Type */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Type</label>
              <div className="flex flex-wrap gap-1.5">
                {WINE_TYPES.map((t) => (
                  <Badge key={t} variant={type === t ? "default" : "outline"} className="cursor-pointer text-xs"
                    style={type === t ? { backgroundColor: WINE_TYPE_COLORS[t as keyof typeof WINE_TYPE_COLORS] || "#666", color: "#fff" } : {}}
                    onClick={() => setType(t)}>
                    {WINE_TYPE_LABELS[t as keyof typeof WINE_TYPE_LABELS] || t}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Reason removed */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Reason Removed</label>
              <div className="flex flex-wrap gap-1.5">
                {REMOVAL_REASONS.map((r) => {
                  const meta = REASON_META[r.id];
                  return (
                    <Badge key={r.id} variant={reason === r.id ? "default" : "outline"} className="cursor-pointer text-xs"
                      style={reason === r.id ? { backgroundColor: meta.color, color: "#fff" } : {}}
                      onClick={() => setReason(r.id)}>
                      {meta.label}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Readiness */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Readiness</label>
              <div className="flex gap-1.5">
                {(["D", "H", "P"] as const).map((d) => (
                  <Badge key={d} variant={disposition === d ? "default" : "outline"} className="cursor-pointer text-xs"
                    style={disposition === d ? { backgroundColor: DISPOSITION_COLORS[d], color: "#fff" } : {}}
                    onClick={() => setDisposition(disposition === d ? "" : d)}>
                    {DISPOSITION_LABELS[d]}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Fields */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Grape</label>
                <Input value={grapeVariety} onChange={(e) => setGrapeVariety(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">ABV</label>
                <Input value={alcohol} onChange={(e) => setAlcohol(e.target.value)} className="h-8 text-sm" placeholder="13.5%" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Purchase Price</label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} className="h-8 text-sm" type="number" step="0.01" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Market Value</label>
                <Input value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} className="h-8 text-sm" type="number" step="0.01" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Drink Window</label>
              <Input value={drinkWindow} onChange={(e) => setDrinkWindow(e.target.value)} className="h-8 text-sm" placeholder="2024-2029" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full text-sm rounded-md border border-input bg-transparent px-3 py-2 min-h-[60px] resize-none" placeholder="Wine description..." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Food Pairings</label>
              <Input value={foodPairings} onChange={(e) => setFoodPairings(e.target.value)} className="h-8 text-sm" placeholder="Lamb, aged cheese..." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tasting Notes</label>
              <textarea value={consumeNotes} onChange={(e) => setConsumeNotes(e.target.value)}
                className="w-full text-sm rounded-md border border-input bg-transparent px-3 py-2 min-h-[60px] resize-none" placeholder="How was it?" />
            </div>

            <DialogFooter className="pt-2 flex-row gap-2">
              <Button variant="outline" size="sm" onClick={resetForm} disabled={saving}>
                <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Save
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <WineDetailBody
            data={{
              name: item.name,
              winery: item.winery,
              vintage: item.vintage,
              type: item.type,
              imageUrl: item.imageUrl,
              region: item.region,
              country: item.country,
              grapeVariety: item.grapeVariety,
              alcohol: item.alcohol,
              drinkWindow: item.drinkWindow,
              price: item.price,
              retailPrice: item.retailPrice,
              description: item.description,
              foodPairings: item.foodPairings,
              tastingNotes: item.consumeNotes || null,
              disposition: item.disposition,
              aiRatings: hasAI ? item.aiRatings : null,
              cdScore,
              cdRatingCount,
            }}
            formatPrice={(n) => formatPrice(n)}
            headerExtra={
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <Badge className="flex items-center gap-1" style={{ backgroundColor: reasonMeta.color, color: "#fff" }}>
                  <ReasonIcon className="h-3 w-3" />
                  {reasonMeta.label}
                </Badge>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Removed {removedDateStr}
                </span>
              </div>
            }
            ratingSlot={
              <button
                type="button"
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg px-2 py-1.5 -mx-2 text-left transition-colors",
                  onUpdate && "hover:bg-muted/50 active:bg-muted cursor-pointer"
                )}
                onClick={() => onUpdate && setRateDialogOpen(true)}
                disabled={!onUpdate}
              >
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {item.consumeRating != null && item.consumeRating > 0 ? "Final Rating" : "Your Rating"}
                </span>
                {displayRating != null && displayRating > 0 ? (
                  <StarRating value={displayRating} size={16} compact />
                ) : onUpdate ? (
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Star className="h-4 w-4" /> Tap to rate
                  </span>
                ) : null}
              </button>
            }
            actions={
              <div className="grid grid-cols-2 gap-2">
                {onUpdate && (
                  <Button variant="outline" className="h-11 gap-2" onClick={() => setEditing(true)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                )}
                {hasAI && onUpdate && (
                  <Button variant="ai" className="h-11 gap-2" onClick={handleEnrich} disabled={enriching}>
                    {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Enrich
                  </Button>
                )}
                <Button variant="outline" className="h-11 gap-2" onClick={handleShare}>
                  <Share2 className="h-4 w-4" /> Share
                </Button>
                {onDelete && (
                  <Button
                    variant="destructive"
                    className="h-11 gap-2"
                    onClick={() => {
                      onDelete();
                      onOpenChange(false);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                )}
              </div>
            }
          />
        )}

        {/* Rate dialog */}
        {onUpdate && (
          <DialRateDialog
            open={rateDialogOpen}
            onOpenChange={setRateDialogOpen}
            currentRating={item.consumeRating ?? item.rating}
            onRate={handleRate}
            title="Rate this wine"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
