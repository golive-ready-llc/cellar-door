"use client";

import { useState, useCallback } from "react";
import { Clock, ChevronDown, ChevronUp, Loader2, CloudSun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/custom-toast";
import { aiVintageStory } from "@/server/actions/ai";
import type { VintageStoryResult } from "@/lib/ai/types";

// ─── Vintage rating colors ───────────────────────────────────

const RATING_COLORS: Record<string, string> = {
  Exceptional: "bg-emerald-500 text-white",
  Excellent: "bg-green-500 text-white",
  "Very Good": "bg-lime-500 text-white",
  Good: "bg-yellow-500 text-white",
  Average: "bg-orange-400 text-white",
  Challenging: "bg-orange-600 text-white",
  Difficult: "bg-red-500 text-white",
};

// ─── Props ────────────────────────────────────────────────────

interface VintageStoryProps {
  vintage: number | null;
  region: string;
  country: string;
  userId?: string | null;
}

// ─── Component ────────────────────────────────────────────────

export function VintageStory({
  vintage,
  region,
  country,
  userId,
}: VintageStoryProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [story, setStory] = useState<VintageStoryResult | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const handleExpand = useCallback(async () => {
    const willExpand = !expanded;
    setExpanded(willExpand);

    // Lazy load: only fetch when first expanded
    if (willExpand && !hasLoaded) {
      if (vintage == null) return; // guarded by the render-time early return too
      setLoading(true);
      try {
        const result = await aiVintageStory(
          region,
          country || "Unknown",
          vintage,
          userId ?? undefined
        );
        if (result.success) {
          setStory(result.data);
          setHasLoaded(true);
        } else {
          toast.error(result.error || "Could not load vintage story");
        }
      } catch {
        toast.error("Failed to load vintage story");
      } finally {
        setLoading(false);
      }
    }
  }, [expanded, hasLoaded, region, country, vintage, userId]);

  // Don't render if no vintage or region (after all hooks to respect rules-of-hooks)
  if (!vintage || !region) return null;

  const ratingClass =
    story?.rating && RATING_COLORS[story.rating]
      ? RATING_COLORS[story.rating]
      : "bg-muted text-foreground";

  return (
    <>
      <Separator />
      <div>
        <Button
          variant="ghost"
          className="w-full justify-between px-0 h-auto py-1 hover:bg-transparent"
          onClick={handleExpand}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs font-medium text-muted-foreground">
              Vintage Time Machine
            </span>
            {story?.rating && (
              <Badge className={`text-[10px] px-1.5 py-0 ${ratingClass}`}>
                {story.rating}
              </Badge>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>

        {expanded && (
          <div className="mt-2 space-y-3 animate-in slide-in-from-top-2 duration-200">
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground py-4 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  Traveling back to {vintage}...
                </span>
              </div>
            )}

            {story && !loading && (
              <div className="rounded-lg border bg-card/50 p-3 space-y-2.5">
                {/* Header: year + region + rating */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">
                      {vintage} {region}
                    </p>
                    {country && (
                      <p className="text-xs text-muted-foreground">
                        {country}
                      </p>
                    )}
                  </div>
                  <Badge className={`${ratingClass} text-xs`}>
                    {story.rating}
                  </Badge>
                </div>

                {/* Narrative */}
                <p className="text-sm leading-relaxed text-foreground/90">
                  {story.narrative}
                </p>

                {/* Weather summary */}
                {story.weather && (
                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <CloudSun className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{story.weather}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
