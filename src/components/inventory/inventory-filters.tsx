"use client";

import { CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TagPill } from "@/components/wine/tag-selector";
import {
  WINE_TYPES,
  WINE_TYPE_LABELS,
  WINE_TYPE_COLORS,
} from "@/types/constants";
import { isLightWineType } from "@/types/wine";
import type { Wine, WineType } from "@/types/wine";

interface TypeFilterProps {
  wines: Wine[];
  selectedType: WineType | "all";
  onSelectType: (type: WineType | "all") => void;
  wineTextColors: Record<WineType, string>;
}

export function TypeFilterBadges({
  wines,
  selectedType,
  onSelectType,
  wineTextColors,
}: TypeFilterProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      <Badge
        variant={selectedType === "all" ? "default" : "outline"}
        className="cursor-pointer select-none"
        onClick={() => onSelectType("all")}
      >
        All ({wines.length})
      </Badge>
      {WINE_TYPES.map((t) => {
        const count =
          t === "sparkling"
            ? wines.filter((w) => w.sparkling === true || (
                ["sparkling", "champagne", "prosecco", "cava", "crémant", "cremant", "franciacorta"].includes(
                  (w.type ?? "").toLowerCase()
                )
              )).length
            : wines.filter((w) => w.type === t).length;
        if (count === 0) return null;
        return (
          <Badge
            key={t}
            variant={selectedType === t ? "default" : "outline"}
            className="cursor-pointer select-none"
            style={
              selectedType === t
                ? {
                    backgroundColor: WINE_TYPE_COLORS[t],
                    color: isLightWineType(t) ? "#333" : "#fff",
                  }
                : {
                    borderColor: wineTextColors[t],
                    color: wineTextColors[t],
                  }
            }
            onClick={() => onSelectType(t)}
          >
            {WINE_TYPE_LABELS[t]} ({count})
          </Badge>
        );
      })}
    </div>
  );
}

interface TagFilterProps {
  allTags: string[];
  selectedTags: string[];
  onSetSelectedTags: (tags: string[] | ((prev: string[]) => string[])) => void;
}

export function TagFilterBadges({
  allTags,
  selectedTags,
  onSetSelectedTags,
}: TagFilterProps) {
  if (allTags.length === 0) return null;

  return (
    <div className="flex gap-1.5 flex-wrap items-center">
      <span className="text-xs text-muted-foreground mr-1">Tags:</span>
      {allTags.map((tag) => {
        const isSelected = selectedTags.includes(tag);
        return (
          <button
            key={tag}
            onClick={() => {
              onSetSelectedTags((prev: string[]) =>
                prev.includes(tag)
                  ? prev.filter((t) => t !== tag)
                  : [...prev, tag]
              );
            }}
            className={cn(
              "transition-opacity",
              selectedTags.length > 0 && !isSelected && "opacity-50 hover:opacity-100"
            )}
          >
            <TagPill tag={tag} compact />
          </button>
        );
      })}
      {selectedTags.length > 0 && (
        <button
          onClick={() => onSetSelectedTags([])}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
        >
          Clear
        </button>
      )}
    </div>
  );
}

interface SelectAllBarProps {
  selectMode: boolean;
  filteredCount: number;
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function SelectAllBar({
  selectMode,
  filteredCount,
  selectedCount,
  onSelectAll,
  onDeselectAll,
}: SelectAllBarProps) {
  if (!selectMode || filteredCount === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="text-xs gap-1.5"
        onClick={() => {
          if (selectedCount === filteredCount) {
            onDeselectAll();
          } else {
            onSelectAll();
          }
        }}
      >
        <CheckCheck className="h-3.5 w-3.5" />
        {selectedCount === filteredCount
          ? "Deselect All"
          : `Select All (${filteredCount})`}
      </Button>
      {selectedCount > 0 && (
        <span className="text-xs text-muted-foreground">
          {selectedCount} selected
        </span>
      )}
    </div>
  );
}
