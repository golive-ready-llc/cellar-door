"use client";

import { useState, useCallback } from "react";
import {
  Sparkles,
  Loader2,
  Wine as WineIcon,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  WINE_TYPE_COLORS,
  WINE_TYPE_LABELS,
} from "@/types/constants";
import { isLightWineType, type Wine } from "@/types/wine";
import { aiRecommend, aiPersonalizedRecommend } from "@/server/actions/ai";
import { useTier } from "@/hooks/use-tier";
import { UpgradePrompt } from "@/components/tier/upgrade-prompt";

interface AiRecommendationCardProps {
  wines: Wine[];
  onWineClick?: (wine: Wine) => void;
}

const OCCASIONS = [
  "Based on my taste profile",
  "Tonight's dinner",
  "Date night",
  "Casual evening",
  "Celebration",
  "Weekend BBQ",
  "Holiday dinner",
  "Cheese & wine night",
];

export function AiRecommendationCard({
  wines,
  onWineClick,
}: AiRecommendationCardProps) {
  const { hasAI, userId } = useTier();
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<{
    wine: Wine;
    reasoning: string;
    occasion: string;
    pairings: string;
  } | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState(OCCASIONS[0]);
  const [showOccasions, setShowOccasions] = useState(false);

  const handleRecommend = useCallback(async () => {
    if (wines.length === 0) return;

    setLoading(true);
    try {
      const isPersonalized = selectedOccasion === "Based on my taste profile";
      const cellarData = wines.map((w) => ({
        id: w.id,
        name: w.name,
        winery: w.winery,
        vintage: w.vintage,
        type: w.type,
        disposition: w.disposition,
        drinkWindow: w.drinkWindow,
      }));

      let result;
      if (isPersonalized) {
        const ratedWines = wines
          .filter((w) => w.userRating && w.userRating > 0)
          .map((w) => ({
            name: w.name,
            winery: w.winery,
            vintage: w.vintage,
            type: w.type,
            region: w.region,
            grapeVariety: w.grapeVariety,
            rating: w.userRating!,
          }));
        if (ratedWines.length === 0) {
          setRecommendation(null);
          setLoading(false);
          return;
        }
        result = await aiPersonalizedRecommend(ratedWines, cellarData, userId ?? undefined);
      } else {
        result = await aiRecommend(selectedOccasion, cellarData, userId ?? undefined);
      }

      if (result.success) {
        const recommendedWine = wines.find(
          (w) => w.id === result.data.wineId
        );
        if (recommendedWine) {
          setRecommendation({
            wine: recommendedWine,
            reasoning: result.data.reasoning,
            occasion: result.data.occasion,
            pairings: result.data.pairingsSuggestion,
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [wines, selectedOccasion, userId]);

  if (wines.length === 0) return null;

  if (!hasAI) {
    return <UpgradePrompt feature="AI Sommelier Recommendations" variant="card" />;
  }

  return (
    <Card className="border-amber-200/50 dark:border-amber-900/30 bg-gradient-to-br from-amber-50/50 to-background dark:from-amber-950/20 dark:to-background">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">AI Sommelier Pick</h3>
              <div className="relative">
                <button
                  onClick={() => setShowOccasions(!showOccasions)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
                >
                  {selectedOccasion}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showOccasions && (
                  <div className="absolute top-5 left-0 z-10 bg-popover border border-border rounded-lg shadow-lg p-1 min-w-40">
                    {OCCASIONS.map((occ) => (
                      <button
                        key={occ}
                        onClick={() => {
                          setSelectedOccasion(occ);
                          setShowOccasions(false);
                          setRecommendation(null);
                        }}
                        className="w-full text-left text-xs px-3 py-1.5 rounded hover:bg-muted transition-colors"
                      >
                        {occ}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRecommend}
            disabled={loading}
            className="h-7 px-2 text-xs gap-1"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : recommendation ? (
              <RefreshCw className="h-3 w-3" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {loading ? "Thinking..." : recommendation ? "New Pick" : "Get Pick"}
          </Button>
        </div>

        {recommendation ? (
          <button
            onClick={() => onWineClick?.(recommendation.wine)}
            className="w-full text-left"
          >
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/80 border border-border hover:border-primary/30 transition-colors">
              <div
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor:
                    WINE_TYPE_COLORS[
                      recommendation.wine
                        .type as keyof typeof WINE_TYPE_COLORS
                    ] || "#666",
                }}
              >
                <WineIcon
                  className="h-5 w-5"
                  style={{
                    color:
                      isLightWineType(recommendation.wine.type) ? "#333" : "#fff",
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {recommendation.wine.name}
                  </span>
                  {recommendation.wine.vintage && (
                    <span className="text-xs text-muted-foreground">
                      {recommendation.wine.vintage}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {recommendation.wine.winery}
                </p>
                <div className="flex gap-1.5 mt-1.5">
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                    style={{
                      borderColor:
                        WINE_TYPE_COLORS[
                          recommendation.wine
                            .type as keyof typeof WINE_TYPE_COLORS
                        ] || "#666",
                      color:
                        WINE_TYPE_COLORS[
                          recommendation.wine
                            .type as keyof typeof WINE_TYPE_COLORS
                        ] || "#666",
                    }}
                  >
                    {WINE_TYPE_LABELS[
                      recommendation.wine
                        .type as keyof typeof WINE_TYPE_LABELS
                    ] || recommendation.wine.type}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  {recommendation.reasoning}
                </p>
                {recommendation.pairings && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    🍽️ {recommendation.pairings}
                  </p>
                )}
              </div>
            </div>
          </button>
        ) : (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground">
              Click &quot;Get Pick&quot; for an AI recommendation from your cellar
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
