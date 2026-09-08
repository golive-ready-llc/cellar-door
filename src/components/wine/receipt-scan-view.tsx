"use client";

import { useState } from "react";
import { Square, CheckSquare, Loader2, Receipt, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WINE_TYPE_COLORS, WINE_TYPE_LABELS } from "@/types/constants";
import type { WineType } from "@/types/wine";

interface ExtractedWine {
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  country: string;
  grapeVariety: string;
  description: string;
  estimatedPrice: number | null;
  alcohol: string;
  disposition: string;
  drinkBy: string;
  drinkWindow: string;
}

interface ReceiptScanViewProps {
  wines: ExtractedWine[];
  sourceName: string | null;
  onAddSelected: (wines: ExtractedWine[]) => Promise<void>;
  onCancel: () => void;
}

export function ReceiptScanView({
  wines,
  sourceName,
  onAddSelected,
  onCancel,
}: ReceiptScanViewProps) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(wines.map((_, i) => i))
  );
  const [isAdding, setIsAdding] = useState(false);

  const allSelected = selected.size === wines.length;
  const noneSelected = selected.size === 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(wines.map((_, i) => i)));
    }
  }

  function toggleWine(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  async function handleAdd() {
    const selectedWines = wines.filter((_, i) => selected.has(i));
    if (selectedWines.length === 0) return;
    setIsAdding(true);
    try {
      await onAddSelected(selectedWines);
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 space-y-3 px-1 pb-4">
        {sourceName && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Receipt className="h-4 w-4" />
            <span>From: {sourceName}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {wines.length} wine{wines.length !== 1 ? "s" : ""} found
          </p>
          <Button variant="ghost" size="sm" onClick={toggleAll}>
            {allSelected ? (
              <>
                <Square className="mr-1.5 h-4 w-4" />
                Deselect All
              </>
            ) : (
              <>
                <CheckSquare className="mr-1.5 h-4 w-4" />
                Select All
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Wine list */}
      <div className="flex-1 space-y-2 overflow-y-auto px-1 pb-4">
        {wines.map((wine, index) => {
          const isSelected = selected.has(index);
          const typeColor =
            WINE_TYPE_COLORS[wine.type as WineType] ?? undefined;
          const typeLabel =
            WINE_TYPE_LABELS[wine.type as WineType] ?? wine.type;

          return (
            <button
              key={index}
              type="button"
              onClick={() => toggleWine(index)}
              className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                isSelected
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card"
              }`}
            >
              {/* Checkbox */}
              <div className="mt-0.5 flex-shrink-0">
                {isSelected ? (
                  <CheckSquare className="h-5 w-5 text-primary" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground" />
                )}
              </div>

              {/* Wine info */}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium leading-tight text-foreground">
                  {wine.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {wine.winery}
                  {wine.vintage ? ` \u00b7 ${wine.vintage}` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {typeLabel && (
                    <Badge
                      variant="secondary"
                      className="text-xs"
                      style={
                        typeColor
                          ? {
                              backgroundColor: `${typeColor}20`,
                              color: typeColor,
                              borderColor: `${typeColor}40`,
                            }
                          : undefined
                      }
                    >
                      {typeLabel}
                    </Badge>
                  )}
                  {wine.estimatedPrice != null && (
                    <span className="text-xs text-muted-foreground">
                      ~${wine.estimatedPrice}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="flex-shrink-0 border-t pt-4 px-1">
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={isAdding}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleAdd}
            disabled={noneSelected || isAdding}
          >
            {isAdding ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <ShoppingCart className="mr-1.5 h-4 w-4" />
                Add {selected.size} Selected
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
