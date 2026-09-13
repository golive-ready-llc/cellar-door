"use client";

import { Wine as WineIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { StarRating } from "@/components/ui/star-rating";
import { WINE_TYPE_COLORS } from "@/types/constants";
import { isLightWineType, type Wine } from "@/types/wine";

interface TopRatedWinesProps {
  topRated: Wine[];
  onWineClick: (wine: Wine) => void;
}

export function TopRatedWines({ topRated, onWineClick }: TopRatedWinesProps) {
  if (topRated.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="font-semibold text-sm mb-4">Top Rated Wines</h3>
        <div className="space-y-3">
          {topRated.map((wine, idx) => (
            <div
              key={wine.id}
              role="button"
              tabIndex={0}
              className="flex items-center gap-3 rounded-lg px-2 py-1 -mx-2 cursor-pointer hover:bg-muted/50 active:scale-[0.99] transition-all"
              onClick={() => onWineClick(wine)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onWineClick(wine);
              }}
            >
              <span className="text-lg font-bold text-muted-foreground w-6 text-center">
                {idx + 1}
              </span>
              <div
                className={cn(
                  "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                  isLightWineType(wine.type) && "border border-border"
                )}
                style={{
                  backgroundColor:
                    WINE_TYPE_COLORS[wine.type as keyof typeof WINE_TYPE_COLORS] || "#666",
                }}
              >
                <WineIcon
                  className="h-4 w-4"
                  style={{ color: isLightWineType(wine.type) ? "#333" : "#fff" }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{wine.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {wine.winery}
                  {wine.vintage ? ` \u00B7 ${wine.vintage}` : ""}
                </p>
              </div>
              <StarRating value={wine.userRating ?? 0} compact size={16} valueSize="sm" className="gap-1 shrink-0" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
