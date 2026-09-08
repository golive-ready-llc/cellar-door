"use client";

import { useMemo, useState, useCallback } from "react";
import { Camera, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WINE_TYPE_COLORS } from "@/types/constants";
import type { Wine, WineType } from "@/types/wine";
import { generateGalleryCard, shareCanvas } from "@/lib/share-utils";

type GallerySortMode = "newest" | "region" | "type";

interface LabelGalleryProps {
  wines: Wine[];
  selectedType: WineType | "all";
  onSelectType: (type: WineType | "all") => void;
  wineTextColors: Record<WineType, string>;
  onWineClick: (wine: Wine) => void;
}

export function LabelGallery({
  wines,
  selectedType,
  wineTextColors,
  onWineClick,
}: LabelGalleryProps) {
  const [sortMode, setSortMode] = useState<GallerySortMode>("newest");

  // Only wines with images, deduplicated (one label per unique wine)
  const winesWithImages = useMemo(() => {
    let filtered = wines.filter((w) => w.imageUrl && w.imageUrl.trim() !== "");

    // Deduplicate: keep first occurrence of each name+winery+vintage
    const seen = new Set<string>();
    filtered = filtered.filter((w) => {
      const key = `${w.name.toLowerCase()}|${w.winery.toLowerCase()}|${w.vintage ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Apply type filter
    if (selectedType !== "all") {
      filtered = filtered.filter((w) => w.type === selectedType);
    }

    // Sort
    switch (sortMode) {
      case "newest":
        return [...filtered].sort(
          (a, b) =>
            new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
        );
      case "region":
        return [...filtered].sort((a, b) =>
          (a.region || "").localeCompare(b.region || "")
        );
      case "type":
        return [...filtered].sort((a, b) => a.type.localeCompare(b.type));
      default:
        return filtered;
    }
  }, [wines, selectedType, sortMode]);

  const handleShareGallery = useCallback(async () => {
    if (winesWithImages.length === 0) return;
    const canvas = await generateGalleryCard(winesWithImages.slice(0, 12));
    await shareCanvas(canvas, "My Wine Label Gallery");
  }, [winesWithImages]);

  // Empty state
  if (wines.filter((w) => w.imageUrl && w.imageUrl.trim() !== "").length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Camera className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-1">No label photos yet</h3>
        <p className="text-muted-foreground max-w-sm">
          Scan some wine labels to build your gallery. Each photo becomes part
          of your personal wine art collection.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Gallery toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">Sort:</span>
          {(
            [
              { key: "newest", label: "Newest" },
              { key: "region", label: "Region" },
              { key: "type", label: "Type" },
            ] as const
          ).map(({ key, label }) => (
            <Button
              key={key}
              variant={sortMode === key ? "secondary" : "ghost"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setSortMode(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={handleShareGallery}
          disabled={winesWithImages.length === 0}
        >
          <Share2 className="h-3.5 w-3.5" />
          Share Gallery
        </Button>
      </div>

      {/* Gallery count */}
      <p className="text-xs text-muted-foreground">
        {winesWithImages.length} label{winesWithImages.length !== 1 ? "s" : ""}{" "}
        in gallery
      </p>

      {/* Masonry grid */}
      {winesWithImages.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {winesWithImages.map((wine) => (
            <LabelCard
              key={wine.id}
              wine={wine}
              wineTextColors={wineTextColors}
              onClick={() => onWineClick(wine)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            No labels match the current filter.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Individual label card ───────────────────────────────────

interface LabelCardProps {
  wine: Wine;
  wineTextColors: Record<WineType, string>;
  onClick: () => void;
}

function LabelCard({ wine, onClick }: LabelCardProps) {
  const typeColor =
    WINE_TYPE_COLORS[wine.type as keyof typeof WINE_TYPE_COLORS] || "#666";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative rounded-xl overflow-hidden",
        "border border-border bg-card",
        "shadow-sm hover:shadow-lg hover:scale-[1.02]",
        "transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "cursor-pointer w-full text-left"
      )}
    >
      {/* Wine label image */}
      <div className="aspect-[3/4] w-full overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded label images, often base64 */}
        <img
          src={wine.imageUrl}
          alt={wine.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* Bottom overlay with gradient */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-10">
        <h4 className="text-sm font-semibold text-white leading-tight truncate">
          {wine.name}
        </h4>
        <p className="text-xs text-white/70 truncate mt-0.5">
          {wine.winery}
          {wine.vintage ? ` \u00B7 ${wine.vintage}` : ""}
        </p>
      </div>

      {/* Type color accent - top-left dot */}
      <div
        className="absolute top-2 left-2 w-3 h-3 rounded-full border border-white/30 shadow"
        style={{ backgroundColor: typeColor }}
      />
    </button>
  );
}
