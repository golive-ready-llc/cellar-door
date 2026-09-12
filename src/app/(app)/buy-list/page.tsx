"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ShoppingCart,
  Search,
  CheckSquare,
  CheckCheck,
  X,
  Trash2,
  ShoppingBag,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddBuyListDialog } from "@/components/wine/add-buy-list-dialog";
import { BuyListDetailDialog } from "@/components/wine/buy-list-detail-dialog";
import { WineListItem } from "@/components/inventory/wine-list-item";
import type { WineDisplayData } from "@/components/inventory/wine-list-item";
import { fetchBuyList, addBuyListItem, removeBuyListItem, createWine, fetchCabinets } from "@/lib/data";
import {
  WINE_TYPES,
  WINE_TYPE_COLORS,
  WINE_TYPE_LABELS,
} from "@/types/constants";
import { isLightWineType, isSparklingType } from "@/types/wine";
import { useWineTextColors } from "@/hooks/use-wine-colors";
import { useCurrency } from "@/hooks/use-currency";
import { useAuth } from "@/components/auth-provider";
import type { BuyListItem, WineType, Cabinet } from "@/types/wine";

/** Adapt a BuyListItem to the shared WineDisplayData shape so the buy list
 *  reuses the same WineListItem component as inventory and stats pages. */
function toWineDisplay(item: BuyListItem): WineDisplayData {
  return {
    name: item.name,
    winery: item.winery,
    vintage: item.vintage,
    type: item.type,
    imageUrl: item.imageUrl ?? "",
    grapeVariety: item.grapeVariety,
    region: item.region,
    country: item.country,
    price: item.retailPrice,
    disposition: item.disposition,
    sparkling: isSparklingType(item.type),
  };
}

export default function BuyListPage() {
  const { userId } = useAuth();
  const [items, setItems] = useState<BuyListItem[]>([]);
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<WineType | "all">("all");
  const [selectedItem, setSelectedItem] = useState<BuyListItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchPurchaseOpen, setBatchPurchaseOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const wineTextColors = useWineTextColors();
  const { formatPrice } = useCurrency();

  const loadData = useCallback(async () => {
    try {
      const [buyData, cabinetData] = await Promise.all([
        fetchBuyList(userId),
        fetchCabinets(userId),
      ]);
      setItems(buyData);
      setCabinets(cabinetData);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter
  const filteredItems = useMemo(() => {
    let result = items;

    if (selectedType !== "all") {
      result = result.filter((i) => i.type === selectedType);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.winery.toLowerCase().includes(q) ||
          i.grapeVariety.toLowerCase().includes(q) ||
          i.region.toLowerCase().includes(q) ||
          i.country.toLowerCase().includes(q)
      );
    }

    return result;
  }, [items, selectedType, searchQuery]);

  // Total estimated value
  const totalValue = useMemo(
    () => items.reduce((sum, i) => sum + (i.retailPrice ?? 0), 0),
    [items]
  );

  const handleAddItem = async (data: Omit<BuyListItem, "id" | "addedAt" | "userId">) => {
    const newItem = await addBuyListItem(data, userId);
    setItems((prev) => [newItem, ...prev]);
  };

  const handleRemoveItem = async (id: string) => {
    await removeBuyListItem(id, userId);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handlePurchase = async (item: BuyListItem) => {
    const newWine = await createWine({
      cabinetId: cabinets[0]?.id ?? null,
      barcode: item.barcode,
      name: item.name,
      winery: item.winery,
      region: item.region,
      country: item.country,
      vintage: item.vintage,
      type: item.type,
      sparkling: isSparklingType(item.type),
      grapeVariety: item.grapeVariety,
      imageUrl: item.imageUrl,
      price: item.retailPrice,
      retailPrice: item.retailPrice,
      purchaseDate: new Date().toISOString().split("T")[0],
      drinkBy: "",
      notes: item.notes,
      description: item.description,
      foodPairings: item.foodPairings,
      alcohol: item.alcohol,
      userRating: null,
      row: null,
      col: null,
      depth: 0,
      zone: "",
      tastingNotes: null,
      disposition: item.disposition,
      drinkWindow: item.drinkWindow,
      aiRatings: item.aiRatings,
      tags: [],
    }, userId);

    if (newWine) {
      await removeBuyListItem(item.id, userId);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }
  };

  // Selection helpers
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds]
  );

  // Batch operations
  const handleBatchRemove = async () => {
    setBatchLoading(true);
    try {
      for (const id of selectedIds) {
        await removeBuyListItem(id, userId);
      }
      setItems((prev) => prev.filter((i) => !selectedIds.has(i.id)));
      setBatchDeleteOpen(false);
      clearSelection();
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchPurchase = async () => {
    setBatchLoading(true);
    try {
      for (const item of selectedItems) {
        await handlePurchase(item);
      }
      setBatchPurchaseOpen(false);
      clearSelection();
    } finally {
      setBatchLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-10 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <PageHeader
          title="Buy List"
          subtitle={
            <div className="flex items-center gap-3">
              <span>
                {filteredItems.length} of <strong>{items.length}</strong> wine{items.length !== 1 ? "s" : ""}
              </span>
              {totalValue > 0 && (
                <span>
                  ~<strong>{formatPrice(totalValue)}</strong> estimated
                </span>
              )}
            </div>
          }
          action={<AddBuyListDialog onAdd={handleAddItem} />}
        />
        {items.length > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant={selectMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                if (selectMode) clearSelection();
                else setSelectMode(true);
              }}
              className="text-xs gap-1.5"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {selectMode ? "Cancel" : "Select"}
            </Button>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search buy list..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Type filter badges */}
          <div className="flex gap-2 flex-wrap">
            <Badge
              variant={selectedType === "all" ? "default" : "outline"}
              className="cursor-pointer select-none"
              onClick={() => setSelectedType("all")}
            >
              All ({items.length})
            </Badge>
            {WINE_TYPES.map((t) => {
              const count = items.filter((i) => i.type === t).length;
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
                  onClick={() => setSelectedType(t)}
                >
                  {WINE_TYPE_LABELS[t]} ({count})
                </Badge>
              );
            })}
          </div>
        </>
      )}

      {/* Select all / deselect */}
      {selectMode && filteredItems.length > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => {
              if (selectedIds.size === filteredItems.length) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(filteredItems.map((i) => i.id)));
              }
            }}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {selectedIds.size === filteredItems.length
              ? "Deselect All"
              : `Select All (${filteredItems.length})`}
          </Button>
          {selectedIds.size > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      )}

      {/* List view — reuses the shared WineListItem so buy list looks
          consistent with inventory and stats pages. */}
      {filteredItems.length > 0 ? (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <WineListItem
              key={item.id}
              wine={toWineDisplay(item)}
              wineTextColors={wineTextColors}
              formatPrice={formatPrice}
              onClick={() => {
                if (selectMode) toggleSelection(item.id);
                else {
                  setSelectedItem(item);
                  setDetailOpen(true);
                }
              }}
              selected={selectedIds.has(item.id)}
              selectMode={selectMode}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <ShoppingCart className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Your buy list is empty</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              Scan a restaurant wine list to find bottles to buy, or add wines manually.
              When you purchase them, move them to your cellar with one click.
            </p>
            <AddBuyListDialog
              onAdd={handleAddItem}
              trigger={
                <Button className="gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Add to Buy List
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={Search}
          title="No matches"
          description="Try adjusting your search or filter."
        />
      )}

      {/* Detail Dialog */}
      {selectedItem && (
        <BuyListDetailDialog
          // Per-item key: the dialog caches the community score in its own
          // state and closing it does not unmount it, so without this the
          // next item opened would show the previous item's score.
          key={selectedItem.id}
          item={selectedItem}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          formatPrice={formatPrice}
          onPurchase={() => {
            setDetailOpen(false);
            handlePurchase(selectedItem);
          }}
          onRemove={() => {
            setDetailOpen(false);
            handleRemoveItem(selectedItem.id);
          }}
        />
      )}

      {/* Batch Actions Bar */}
      {selectedItems.length > 0 && (
        <>
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-primary text-primary-foreground rounded-full shadow-2xl px-5 py-2.5 animate-in slide-in-from-bottom-4 fade-in duration-200">
            <div className="flex items-center gap-2 mr-2">
              <CheckSquare className="h-4 w-4" />
              <span className="text-sm font-medium">{selectedItems.length} selected</span>
            </div>
            <div className="w-px h-5 bg-primary-foreground/30" />
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-primary-foreground/20 gap-1.5 text-xs h-7"
              onClick={() => setBatchPurchaseOpen(true)}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Purchase
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-primary-foreground/20 gap-1.5 text-xs h-7 text-red-300 hover:text-red-200"
              onClick={() => setBatchDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
            <div className="w-px h-5 bg-primary-foreground/30" />
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-primary-foreground/20 p-1 h-7 w-7"
              onClick={clearSelection}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Batch Remove Dialog */}
          <Dialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-5 w-5" />
                  Remove {selectedItems.length} Items
                </DialogTitle>
                <DialogDescription>Remove selected items from your buy list.</DialogDescription>
              </DialogHeader>
              <div className="py-2 max-h-48 overflow-y-auto space-y-1">
                {selectedItems.map((item) => (
                  <div key={item.id} className="text-sm text-muted-foreground truncate">
                    {item.name}{item.vintage ? ` (${item.vintage})` : ""}
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBatchDeleteOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleBatchRemove} disabled={batchLoading}>
                  {batchLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  Remove All
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Batch Purchase Dialog */}
          <Dialog open={batchPurchaseOpen} onOpenChange={setBatchPurchaseOpen}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Purchase {selectedItems.length} Wines
                </DialogTitle>
                <DialogDescription>Move selected wines to your cellar as purchased.</DialogDescription>
              </DialogHeader>
              <div className="py-2 max-h-48 overflow-y-auto space-y-1">
                {selectedItems.map((item) => (
                  <div key={item.id} className="text-sm text-muted-foreground truncate">
                    {item.name}{item.vintage ? ` (${item.vintage})` : ""}
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBatchPurchaseOpen(false)}>Cancel</Button>
                <Button onClick={handleBatchPurchase} disabled={batchLoading}>
                  {batchLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  Purchase All
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

