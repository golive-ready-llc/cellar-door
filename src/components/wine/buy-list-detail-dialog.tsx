"use client";

import { useState, useEffect } from "react";
import { ShoppingBag, Trash2 } from "lucide-react";
import { useTier } from "@/hooks/use-tier";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WineDetailBody } from "@/components/wine/wine-detail-body";
import type { BuyListItem } from "@/types/wine";

interface BuyListDetailDialogProps {
  item: BuyListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatPrice: (amount: number, decimals?: number) => string;
  onPurchase?: () => void;
  onRemove?: () => void;
}

/**
 * Wishlist item detail — renders the one shared WineDetailBody (identical
 * layout to the wine/history detail views) with wishlist-specific actions
 * (Mark Purchased / Remove) passed in.
 */
export function BuyListDetailDialog({
  item,
  open,
  onOpenChange,
  formatPrice,
  onPurchase,
  onRemove,
}: BuyListDetailDialogProps) {
  const { hasAI } = useTier();

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>{item.name}</DialogTitle>
        </DialogHeader>
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
            retailPrice: item.retailPrice,
            price: null,
            description: item.description,
            foodPairings: item.foodPairings,
            notes: item.notes,
            disposition: item.disposition,
            sparkling: item.sparkling,
            aiRatings: hasAI ? item.aiRatings : null,
            cdScore,
            cdRatingCount,
          }}
          formatPrice={(n) => formatPrice(n)}
          headerExtra={
            item.addedAt ? (
              <p className="text-caption">
                Added{" "}
                {new Date(item.addedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            ) : null
          }
          actions={
            onPurchase || onRemove ? (
              <div className="grid grid-cols-2 gap-2">
                {onPurchase && (
                  <Button className="h-11 gap-2" onClick={onPurchase}>
                    <ShoppingBag className="h-4 w-4" />
                    Mark Purchased
                  </Button>
                )}
                {onRemove && (
                  <Button
                    variant="destructive"
                    className="h-11 gap-2"
                    onClick={onRemove}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            ) : null
          }
        />
      </DialogContent>
    </Dialog>
  );
}
