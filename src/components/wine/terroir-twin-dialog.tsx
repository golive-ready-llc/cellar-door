"use client";

import { useState, useCallback } from "react";
import { Mountain, Globe2, Grape, ShoppingCart, CheckCircle2, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Wine } from "@/types/wine";
import type { WineDataInput, AiTerroirTwinResult, TerroirTwinMatch } from "@/lib/ai";
import { aiTerroirTwins } from "@/server/actions/ai";
import { addBuyListItem } from "@/server/actions/buy-list";
import { useTier } from "@/hooks/use-tier";
import { UpgradePrompt } from "@/components/tier/upgrade-prompt";
import { toast } from "sonner";

interface TerroirTwinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wine: Wine;
  /** All wines in the user's cellar for cross-referencing */
  cellarWines: Wine[];
  /** Navigate to a wine in the cellar */
  onWineClick?: (wine: Wine) => void;
}

export function TerroirTwinDialog({
  open,
  onOpenChange,
  wine,
  cellarWines,
  onWineClick,
}: TerroirTwinDialogProps) {
  const { hasAI, userId } = useTier();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiTerroirTwinResult | null>(null);
  const [addedToBuyList, setAddedToBuyList] = useState<Set<number>>(new Set());

  const handleFind = useCallback(async () => {
    setLoading(true);
    try {
      const wineInput: WineDataInput = {
        name: wine.name,
        winery: wine.winery,
        vintage: wine.vintage,
        type: wine.type,
        region: wine.region,
        country: wine.country,
        grapeVariety: wine.grapeVariety,
        description: wine.description,
      };
      const userWines = cellarWines.map((w) => ({
        id: w.id,
        name: w.name,
        winery: w.winery,
        region: w.region,
        country: w.country,
        grapeVariety: w.grapeVariety,
      }));
      const res = await aiTerroirTwins(wineInput, userWines, userId ?? undefined);
      if (res.success) {
        setResult(res.data);
      }
    } finally {
      setLoading(false);
    }
  }, [wine, cellarWines, userId]);

  const handleAddToBuyList = useCallback(
    async (twin: TerroirTwinMatch, idx: number) => {
      if (!userId) return;
      try {
        await addBuyListItem(userId, {
          barcode: "",
          name: twin.name || "",
          winery: twin.winery || "",
          region: twin.region || "",
          country: twin.country || "",
          vintage: null,
          type: wine.type || "red",
          grapeVariety: twin.grapeVariety || "",
          imageUrl: "",
          retailPrice: null,
          notes: `Terroir twin of ${wine.name}. ${twin.sharedTerroir || ""}`.trim(),
          description: twin.explanation || "",
          foodPairings: "",
          alcohol: "",
          disposition: "",
          drinkWindow: "",
          aiRatings: null,
          status: "wanted",
          orderDate: null,
          expectedDelivery: null,
          store: "",
        });
        setAddedToBuyList((prev) => new Set(prev).add(idx));
        // Direct server-action write — drop the read cache so the Buy List
        // page doesn't serve a pre-add snapshot for the next 30s.
        const { invalidateReadCache } = await import("@/lib/data");
        invalidateReadCache();
        toast.success(`Added ${twin.name} to buy list`);
      } catch {
        toast.error("Failed to add to buy list");
      }
    },
    [userId, wine.name, wine.type]
  );

  const handleCellarWineClick = useCallback(
    (twin: TerroirTwinMatch) => {
      if (twin.inCellar && twin.cellarWineId) {
        const cellarWine = cellarWines.find((w) => w.id === twin.cellarWineId);
        if (cellarWine && onWineClick) {
          onOpenChange(false);
          setTimeout(() => onWineClick(cellarWine), 200);
        }
      }
    },
    [cellarWines, onWineClick, onOpenChange]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setTimeout(() => { setResult(null); setAddedToBuyList(new Set()); }, 300);
        }
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Mountain className="h-4 w-4 text-emerald-600" />
            </div>
            Terroir Twins
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Discover wines from different regions that share the same soul of the soil as{" "}
            <span className="font-medium text-foreground">{wine.name}</span>.
          </p>
        </DialogHeader>

        {!hasAI ? (
          <UpgradePrompt feature="Terroir Twin Finder" variant="card" />
        ) : (
          <div className="space-y-4">
            {/* Wine being analyzed */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm font-medium">{wine.name}</p>
              <p className="text-xs text-muted-foreground">
                {wine.winery}
                {wine.vintage ? ` ${wine.vintage}` : ""}
                {wine.region ? ` \u2022 ${wine.region}` : ""}
                {wine.country ? `, ${wine.country}` : ""}
              </p>
              {wine.grapeVariety && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  <Grape className="inline h-3 w-3 mr-1" />
                  {wine.grapeVariety}
                </p>
              )}
            </div>

            {/* Find Button or Loading */}
            {!result && !loading && (
              <Button variant="ai"
                onClick={handleFind}
                className="w-full"
              >
                <Globe2 className="h-4 w-4 mr-2" />
                Find Terroir Twins
              </Button>
            )}

            {loading && (
              <div className="flex flex-col items-center py-8 gap-3">
                <div className="relative">
                  <Mountain className="h-8 w-8 text-emerald-600 animate-pulse" />
                  <Globe2 className="h-5 w-5 text-blue-500 absolute -right-2 -bottom-1 animate-spin" style={{ animationDuration: "3s" }} />
                </div>
                <p className="text-sm text-muted-foreground">
                  Exploring terroir connections around the world...
                </p>
              </div>
            )}

            {/* Results */}
            {!loading && result && (
              <div className="space-y-3">
                {result.twins.length > 0 ? (
                  <>
                    <p className="text-xs font-medium text-muted-foreground">
                      Wines from different regions that share similar terroir:
                    </p>
                    {result.twins.map((twin, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-border bg-background hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{twin.name}</span>
                              {twin.inCellar && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0"
                                >
                                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                  In your cellar!
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{twin.winery}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Globe2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {twin.region}, {twin.country}
                              </span>
                            </div>
                            {twin.grapeVariety && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Grape className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {twin.grapeVariety}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Shared terroir */}
                        <div className="mt-2 p-2 rounded bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <Mountain className="h-3 w-3" />
                            Shared Terroir
                          </p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-300 mt-0.5">
                            {twin.sharedTerroir}
                          </p>
                        </div>

                        {/* Explanation */}
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                          {twin.explanation}
                        </p>

                        {/* Action button */}
                        <div className="mt-2">
                          {twin.inCellar && twin.cellarWineId ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => handleCellarWineClick(twin)}
                            >
                              View in Cellar
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          ) : addedToBuyList.has(idx) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 text-emerald-600"
                              disabled
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Added to Buy List
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => handleAddToBuyList(twin, idx)}
                            >
                              <ShoppingCart className="h-3 w-3 mr-1" />
                              Add to Buy List
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-6">
                    <Mountain className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Could not find terroir twins for this wine. Try with a wine that has more
                      region and grape information.
                    </p>
                  </div>
                )}

                {/* Try again */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setResult(null);
                    handleFind();
                  }}
                  className="w-full"
                >
                  Search Again
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
