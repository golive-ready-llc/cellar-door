"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  History,
  Wine as WineIcon,
  Search,
  Gift,
  DollarSign,
  AlertTriangle,
  CircleOff,
  HelpCircle,
  Trash2,
  CheckSquare,
  CheckCheck,
  X,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { HistoryDetailDialog } from "@/components/wine/history-detail-dialog";
import { WineListItem } from "@/components/inventory/wine-list-item";
import { fetchHistory, removeHistoryItem, editHistoryItem } from "@/lib/data";
import { useWineTextColors } from "@/hooks/use-wine-colors";
import { useCurrency } from "@/hooks/use-currency";
import { WineListSkeleton } from "@/components/ui/wine-list-skeleton";

import { useAuth } from "@/components/auth-provider";
import type { WineHistoryItem } from "@/types/wine";

const PAGE_SIZE = 50;

const REASON_META: Record<
  string,
  { label: string; icon: typeof WineIcon; color: string }
> = {
  drank: { label: "Drank", icon: WineIcon, color: "#22C55E" },
  gifted: { label: "Gifted", icon: Gift, color: "#A855F7" },
  sold: { label: "Sold", icon: DollarSign, color: "#3B82F6" },
  broken: { label: "Broken", icon: AlertTriangle, color: "#F97316" },
  spoiled: { label: "Spoiled", icon: CircleOff, color: "#EF4444" },
  other: { label: "Other", icon: HelpCircle, color: "#6B7280" },
};

type ReasonFilter = "all" | string;
type DateRange = "all" | "week" | "month" | "year";

function getDateRangeStart(range: DateRange): Date | null {
  if (range === "all") return null;
  const now = new Date();
  switch (range) {
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case "month": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      return d;
    }
    case "year": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return d;
    }
    default:
      return null;
  }
}

export default function HistoryPage() {
  const { userId } = useAuth();
  const [items, setItems] = useState<WineHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [selectedItem, setSelectedItem] = useState<WineHistoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const wineTextColors = useWineTextColors();
  const { formatPrice } = useCurrency();

  const loadData = useCallback(async () => {
    try {
      const data = await fetchHistory(userId);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, reasonFilter, dateRange]);

  // Filter
  const filteredItems = useMemo(() => {
    let result = items;

    // Date range filter
    const rangeStart = getDateRangeStart(dateRange);
    if (rangeStart) {
      result = result.filter((i) => new Date(i.removedAt) >= rangeStart);
    }

    if (reasonFilter !== "all") {
      result = result.filter((i) => i.reason === reasonFilter);
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
  }, [items, reasonFilter, searchQuery, dateRange]);

  // Paginated items — only render up to visibleCount
  const paginatedItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount]
  );

  const hasMore = visibleCount < filteredItems.length;

  // Reason counts
  const reasonCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.reason] = (counts[item.reason] || 0) + 1;
    }
    return counts;
  }, [items]);

  const handleDeleteHistoryItem = async (id: string) => {
    await removeHistoryItem(id, userId);
    setItems((prev) => prev.filter((i) => i.id !== id));
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

  // Batch delete
  const handleBatchDelete = async () => {
    setBatchLoading(true);
    try {
      for (const id of selectedIds) {
        await removeHistoryItem(id, userId);
      }
      setItems((prev) => prev.filter((i) => !selectedIds.has(i.id)));
      setBatchDeleteOpen(false);
      clearSelection();
    } finally {
      setBatchLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-6 w-20 rounded-full" />
          ))}
        </div>
        <WineListSkeleton count={8} variant="list" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <PageHeader
          title="History"
          subtitle={
            filteredItems.length === items.length ? (
              <>
                <strong>{items.length}</strong> wine{items.length !== 1 ? "s" : ""} consumed or removed
              </>
            ) : (
              <>
                {filteredItems.length} of <strong>{items.length}</strong> wine{items.length !== 1 ? "s" : ""} consumed or removed
              </>
            )
          }
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
              placeholder="Search history..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Date range filter pills */}
          <div className="flex gap-2 flex-wrap">
            {(
              [
                { key: "all", label: "All Time" },
                { key: "week", label: "This Week" },
                { key: "month", label: "This Month" },
                { key: "year", label: "This Year" },
              ] as const
            ).map(({ key, label }) => (
              <Badge
                key={key}
                variant={dateRange === key ? "default" : "outline"}
                className="cursor-pointer select-none"
                onClick={() => setDateRange(key)}
              >
                {label}
              </Badge>
            ))}
          </div>

          {/* Reason filter badges */}
          <div className="flex gap-2 flex-wrap">
            <Badge
              variant={reasonFilter === "all" ? "default" : "outline"}
              className="cursor-pointer select-none"
              onClick={() => setReasonFilter("all")}
            >
              All ({items.length})
            </Badge>
            {Object.entries(REASON_META).map(([key, meta]) => {
              const count = reasonCounts[key] || 0;
              if (count === 0) return null;
              const isActive = reasonFilter === key;
              return (
                <Badge
                  key={key}
                  variant={isActive ? "default" : "outline"}
                  className="cursor-pointer select-none"
                  style={
                    isActive
                      ? { backgroundColor: meta.color, color: "#fff" }
                      : { borderColor: meta.color, color: meta.color }
                  }
                  onClick={() => setReasonFilter(key)}
                >
                  {meta.label} ({count})
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

      {/* List view — paginated */}
      {paginatedItems.length > 0 ? (
        <div className="space-y-2">
          {paginatedItems.map((item) => {
            const reasonMeta = REASON_META[item.reason] || REASON_META.other;
            const ReasonIcon = reasonMeta.icon;
            const removedDate = new Date(item.removedAt);
            const dateStr = removedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const timeStr = removedDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            return (
              <WineListItem
                key={item.id}
                wine={{
                  name: item.name,
                  winery: item.winery,
                  vintage: item.vintage,
                  type: item.type,
                  imageUrl: item.imageUrl,
                  grapeVariety: item.grapeVariety,
                  region: item.region,
                  country: item.country,
                  price: item.price,
                  // Rating given at removal time, else the cellar-era rating
                  userRating: item.consumeRating ?? item.rating,
                }}
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
                extraBadge={
                  <Badge
                    className="text-[10px] px-1.5 py-0 flex items-center gap-0.5"
                    style={{ backgroundColor: reasonMeta.color, color: "#fff" }}
                  >
                    <ReasonIcon className="h-2.5 w-2.5" />
                    {reasonMeta.label}
                  </Badge>
                }
                footer={
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.consumeNotes && (
                      <p className="text-[10px] text-muted-foreground/70 italic truncate max-w-[200px]">
                        &ldquo;{item.consumeNotes}&rdquo;
                      </p>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                      {dateStr} at {timeStr}
                    </span>
                  </div>
                }
              />
            );
          })}

          {/* Load More button */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="gap-2"
              >
                <ChevronDown className="h-4 w-4" />
                Load More ({filteredItems.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={History}
          title="No history yet"
          description="When you remove wines from your cellar — drunk, gifted, sold — they'll appear here."
        />
      ) : (
        <EmptyState
          icon={Search}
          title="No matches"
          description="Try adjusting your search or filter."
        />
      )}

      {/* Detail Dialog */}
      {selectedItem && (
        <HistoryDetailDialog
          // Per-item key: the dialog holds the community score and the edit
          // form in its own state, and closing it does not unmount it — the
          // next item opened would otherwise show (and save) the previous
          // item's values.
          key={selectedItem.id}
          item={selectedItem}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          formatPrice={formatPrice}
          onDelete={() => handleDeleteHistoryItem(selectedItem.id)}
          onUpdate={async (id, updates) => {
            const result = await editHistoryItem(id, updates, userId);
            if (result.success) {
              // Refresh the selected item and history list
              setItems((prev) =>
                prev.map((h) =>
                  h.id === id ? { ...h, ...updates, vintage: updates.vintage as number | null ?? h.vintage, price: updates.price as number | null ?? h.price, retailPrice: updates.retailPrice as number | null ?? h.retailPrice } : h
                )
              );
              setSelectedItem((prev) =>
                prev && prev.id === id ? { ...prev, ...updates, vintage: updates.vintage as number | null ?? prev.vintage, price: updates.price as number | null ?? prev.price, retailPrice: updates.retailPrice as number | null ?? prev.retailPrice } : prev
              );
            }
            return result;
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
              className="text-primary-foreground hover:bg-primary-foreground/20 gap-1.5 text-xs h-7 text-red-300 hover:text-red-200"
              onClick={() => setBatchDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
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

          {/* Batch Delete Dialog */}
          <Dialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-5 w-5" />
                  Delete {selectedItems.length} History Items
                </DialogTitle>
                <DialogDescription>
                  Permanently delete selected history records. This cannot be undone.
                </DialogDescription>
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
                <Button variant="destructive" onClick={handleBatchDelete} disabled={batchLoading}>
                  {batchLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  Delete All
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

// Thin Skeleton wrapper used only in the loading state above
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

// ============================================================
// History Card
// ============================================================

