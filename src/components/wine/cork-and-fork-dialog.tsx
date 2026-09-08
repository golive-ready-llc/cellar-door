"use client";

import { useState, useCallback } from "react";
import {
  UtensilsCrossed,
  Wine as WineIcon,
  Loader2,
  Sparkles,
  Search,
  ShoppingCart,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WINE_TYPE_COLORS } from "@/types/constants";
import { isLightWineType, type Wine } from "@/types/wine";
import { aiMealPairing } from "@/server/actions/ai";
import { useTier } from "@/hooks/use-tier";
import { UpgradePrompt } from "@/components/tier/upgrade-prompt";
import type { AiMealPairingResult, MealPairingMatch } from "@/lib/ai";

interface CorkAndForkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wines: Wine[];
  onWineClick?: (wine: Wine) => void;
}

const MEAL_SUGGESTIONS = [
  "Grilled salmon with lemon butter",
  "Pizza night",
  "Thanksgiving turkey",
  "Steak and potatoes",
  "Sushi platter",
  "Pasta with red sauce",
  "Cheese board",
  "Roasted chicken",
];

const CONFIDENCE_CONFIG = {
  perfect: {
    label: "Perfect Match",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  great: {
    label: "Great Pairing",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  worth_trying: {
    label: "Worth Trying",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    dot: "bg-amber-500",
  },
};

export function CorkAndForkDialog({
  open,
  onOpenChange,
  wines,
  onWineClick,
}: CorkAndForkDialogProps) {
  const { hasAI, userId } = useTier();
  const [meal, setMeal] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiMealPairingResult | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!meal.trim() || wines.length === 0) return;
    setLoading(true);
    setSearched(true);
    try {
      // Only send drink-ready wines (disposition "D" or empty — NOT "H" Hold)
      const drinkReadyWines = wines.filter((w) => w.disposition !== "H");
      // Fall back to all wines if none are drink-ready
      const winePool = drinkReadyWines.length > 0 ? drinkReadyWines : wines;
      const wineData = winePool.map((w) => ({
        id: w.id,
        name: w.name,
        winery: w.winery,
        vintage: w.vintage,
        type: w.type,
        grapeVariety: w.grapeVariety,
        region: w.region,
        country: w.country,
        description: w.description,
        foodPairings: w.foodPairings,
        disposition: w.disposition,
      }));
      const res = await aiMealPairing(meal.trim(), wineData, userId ?? undefined);
      if (res.success) {
        setResult(res.data);
      }
    } finally {
      setLoading(false);
    }
  }, [meal, wines, userId]);

  const handleWineClick = useCallback(
    (match: MealPairingMatch) => {
      const wine = wines.find((w) => w.id === match.wineId);
      if (wine && onWineClick) {
        onOpenChange(false);
        setTimeout(() => onWineClick(wine), 200);
      }
    },
    [wines, onWineClick, onOpenChange]
  );

  const handleReset = useCallback(() => {
    setMeal("");
    setResult(null);
    setSearched(false);
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setTimeout(handleReset, 300);
        }
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <UtensilsCrossed className="h-4 w-4 text-amber-600" />
            </div>
            Cork & Fork
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Describe your meal and we&apos;ll find the perfect wine from your cellar.
          </p>
        </DialogHeader>

        {!hasAI ? (
          <UpgradePrompt feature="AI Wine Pairing" variant="card" />
        ) : (
          <div className="space-y-4">
            {/* Meal Input */}
            <div className="flex gap-2">
              <Input
                placeholder="What are you eating? (e.g., Grilled salmon with lemon butter)"
                value={meal}
                onChange={(e) => setMeal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) handleSearch();
                }}
                disabled={loading}
                className="flex-1"
              />
              <Button
                onClick={handleSearch}
                disabled={loading || !meal.trim()}
                className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-1.5 hidden sm:inline">
                  {loading ? "Finding..." : "Find My Wine"}
                </span>
              </Button>
            </div>

            {/* Quick Suggestions */}
            {!searched && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Try something:</p>
                <div className="flex flex-wrap gap-1.5">
                  {MEAL_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setMeal(s)}
                      className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-muted transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex flex-col items-center py-8 gap-3">
                <div className="relative">
                  <UtensilsCrossed className="h-8 w-8 text-amber-600 animate-bounce" />
                  <WineIcon className="h-6 w-6 text-red-500 absolute -right-3 -top-1 animate-pulse" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Finding the perfect pairing from your cellar...
                </p>
              </div>
            )}

            {/* Results */}
            {!loading && result && (
              <div className="space-y-3">
                {result.matches.length > 0 ? (
                  <>
                    <p className="text-xs font-medium text-muted-foreground">
                      Top picks from your cellar for &ldquo;{meal}&rdquo;:
                    </p>
                    {result.matches.map((match, idx) => {
                      const conf = CONFIDENCE_CONFIG[match.confidence];
                      const wine = wines.find((w) => w.id === match.wineId);
                      return (
                        <button
                          key={match.wineId + idx}
                          onClick={() => handleWineClick(match)}
                          className="w-full text-left p-3 rounded-lg border border-border hover:border-amber-300 dark:hover:border-amber-700 transition-colors bg-background"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5"
                              style={{
                                backgroundColor:
                                  WINE_TYPE_COLORS[
                                    (wine?.type || "red") as keyof typeof WINE_TYPE_COLORS
                                  ] || "#666",
                              }}
                            >
                              <WineIcon
                                className="h-4 w-4"
                                style={{
                                  color: isLightWineType(wine?.type || "") ? "#333" : "#fff",
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-medium text-sm truncate">
                                    {match.wineName}
                                  </span>
                                  {match.vintage && (
                                    <span className="text-xs text-muted-foreground shrink-0">
                                      {match.vintage}
                                    </span>
                                  )}
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              </div>
                              <p className="text-xs text-muted-foreground">{match.winery}</p>
                              <div className="mt-1.5">
                                <Badge
                                  variant="secondary"
                                  className={cn("text-[10px] px-1.5 py-0 font-medium", conf.color)}
                                >
                                  <span className={cn("w-1.5 h-1.5 rounded-full mr-1", conf.dot)} />
                                  {conf.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                                {match.pairingExplanation}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </>
                ) : result.buySuggestions.length > 0 ? (
                  <>
                    <div className="text-center py-4">
                      <UtensilsCrossed className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        None of your wines are ideal for this meal.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Consider adding these to your buy list:
                      </p>
                    </div>
                    {result.buySuggestions.map((sug, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-dashed border-border bg-muted/30"
                      >
                        <div className="flex items-start gap-3">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{sug.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {sug.grapeVariety} &middot; {sug.region}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {sug.reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-6">
                    <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No results found. Try describing your meal differently.
                    </p>
                  </div>
                )}

                {/* Search again */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="w-full"
                >
                  Try another meal
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
