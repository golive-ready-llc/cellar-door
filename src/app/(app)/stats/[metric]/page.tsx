"use client";

/**
 * Generic stats detail page. Routes:
 *   /stats/bottles   — all wines
 *   /stats/value     — by purchase price desc, with cost / market / gain
 *   /stats/ratings   — rated wines, sorted desc
 *   /stats/consumed  — wine history (drank/discarded), sorted desc by removedAt
 *   /stats/price     — by purchase price desc
 *   /stats/vintage   — by vintage asc (oldest first)
 *   /stats/countries — grouped by country (?value=France drills into wines)
 *   /stats/grapes    — grouped by grape variety (?value=Pinot%20Noir drills in)
 *
 * Anything else → notFound().
 *
 * The page fetches wines + history itself so direct navigation / refresh
 * works. It also pushes the wines into WineDataContext so the wine detail
 * dialog has the same shared context as the stats page.
 */

import { useEffect, useMemo, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, notFound } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Wine as WineIcon,
  Star,
  MapPin,
  Grape,
  Calendar,
  DollarSign,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { useWineData } from "@/contexts/wine-data-context";
import { fetchWines, fetchHistory, fetchCabinets, editWine } from "@/lib/data";
import { useCurrency } from "@/hooks/use-currency";
import { useWineTextColors } from "@/hooks/use-wine-colors";
import { getCabinetName } from "@/lib/inventory-utils";
import { collectAllTags } from "@/lib/cellar-utils";

function buildCabinetMap(cabinets: Cabinet[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of cabinets) map.set(c.id, c.name);
  return map;
}
import { WineListItem } from "@/components/inventory/wine-list-item";
import { WineDetailDialog } from "@/components/wine/wine-detail-dialog";
import { LoadMore } from "@/components/ui/load-more";
import { useIncrementalList } from "@/hooks/use-incremental-list";
import { WINE_TYPE_COLORS } from "@/types/constants";
import { isLightWineType, type Wine, type WineHistoryItem, type Cabinet } from "@/types/wine";

type Metric =
  | "bottles"
  | "value"
  | "ratings"
  | "consumed"
  | "price"
  | "vintage"
  | "countries"
  | "grapes";

const METRIC_TITLES: Record<Metric, { title: string; subtitle: string; icon: typeof WineIcon }> = {
  bottles: { title: "All Bottles", subtitle: "Every wine in your collection", icon: WineIcon },
  value: { title: "Collection Value", subtitle: "Cost, market value, and gain per bottle", icon: DollarSign },
  ratings: { title: "Rated Wines", subtitle: "Your personal ratings", icon: Star },
  consumed: { title: "Wines Consumed", subtitle: "History of bottles drunk", icon: Clock },
  price: { title: "By Price", subtitle: "Bottles sorted by purchase price", icon: TrendingUp },
  vintage: { title: "By Vintage", subtitle: "Oldest first", icon: Calendar },
  countries: { title: "Countries", subtitle: "Bottles grouped by country", icon: MapPin },
  grapes: { title: "Grape Varieties", subtitle: "Bottles grouped by grape", icon: Grape },
};

function isMetric(v: string): v is Metric {
  return v in METRIC_TITLES;
}

interface PageProps {
  params: Promise<{ metric: string }>;
}

export default function StatsDetailPage({ params }: PageProps) {
  const { metric: rawMetric } = usePromise(params);
  if (!isMetric(rawMetric)) {
    notFound();
  }
  const metric = rawMetric as Metric;
  const router = useRouter();
  const searchParams = useSearchParams();
  const drillValue = searchParams.get("value");
  const { userId } = useAuth();
  const { setWineData } = useWineData();
  const { formatPrice } = useCurrency();
  const wineTextColors = useWineTextColors();

  const [wines, setWines] = useState<Wine[]>([]);
  const [history, setHistory] = useState<WineHistoryItem[]>([]);
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [w, h, c] = await Promise.all([
          fetchWines(userId),
          fetchHistory(userId),
          fetchCabinets(userId),
        ]);
        if (cancelled) return;
        setWines(w);
        setHistory(h);
        setCabinets(c);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Push into shared context for the wine detail dialog
  useEffect(() => {
    if (wines.length || cabinets.length) {
      setWineData({ wines, cabinets, allTags: collectAllTags(wines) });
    }
  }, [wines, cabinets, setWineData]);

  const handleWineClick = (wine: Wine) => {
    setSelectedWine(wine);
    setDetailOpen(true);
  };

  const handleEditWine = async (wineId: string, updates: Partial<Wine>) => {
    const updated = await editWine(wineId, updates, userId);
    if (updated) {
      setWines((prev) => prev.map((w) => (w.id === wineId ? { ...w, ...updated } : w)));
      setSelectedWine((prev) => (prev?.id === wineId ? { ...prev, ...updated } : prev));
    }
  };

  const meta = METRIC_TITLES[metric];
  const Icon = meta.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // If we're drilled into a country/grape, peel back one level first
            if (drillValue) {
              router.push(`/stats/${metric}`);
              return;
            }
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/stats");
            }
          }}
          className="text-xs gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
      </div>

      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold leading-tight">
            {drillValue ? decodeURIComponent(drillValue) : meta.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {drillValue
              ? metric === "countries"
                ? "Wines from this country"
                : "Wines using this grape"
              : meta.subtitle}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <DetailBody
          metric={metric}
          drillValue={drillValue}
          wines={wines}
          history={history}
          cabinets={cabinets}
          formatPrice={formatPrice}
          wineTextColors={wineTextColors}
          onWineClick={handleWineClick}
        />
      )}

      {selectedWine && (
        <WineDetailDialog
          wine={selectedWine}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onUpdate={async (updates) => {
            await handleEditWine(selectedWine.id, updates);
          }}
          onSave={handleEditWine}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// Body — renders a wine list, history list, or grouped breakdown depending
// on the active metric and whether we're drilled into a country/grape.
// -----------------------------------------------------------------------

interface DetailBodyProps {
  metric: Metric;
  drillValue: string | null;
  wines: Wine[];
  history: WineHistoryItem[];
  cabinets: Cabinet[];
  formatPrice: (amount: number, decimals?: number) => string;
  wineTextColors: ReturnType<typeof useWineTextColors>;
  onWineClick: (wine: Wine) => void;
}

/** What the metric renders, plus the list it renders from. */
type DetailView =
  | { kind: "wine"; wines: Wine[]; emptyText: string }
  | { kind: "value"; wines: Wine[] }
  | { kind: "history" }
  | { kind: "grouped"; groupKey: "country" | "grape"; basePath: string };

/** Pure: pick the list a metric shows. Kept out of the component so the
 *  component can memoize the result — the incremental lists restart at page
 *  one whenever their array identity changes, so a fresh array on every
 *  render (opening the detail dialog, editing a wine) would collapse a
 *  scrolled list. */
function buildView(
  metric: Metric,
  drillValue: string | null,
  wines: Wine[]
): DetailView {
  if (metric === "countries" && drillValue) {
    const target = decodeURIComponent(drillValue);
    return {
      kind: "wine",
      wines: wines.filter((w) => (w.country || "Unknown") === target),
      emptyText: "No wines from this country.",
    };
  }
  if (metric === "grapes" && drillValue) {
    const target = decodeURIComponent(drillValue);
    return {
      kind: "wine",
      wines: wines.filter((w) =>
        (w.grapeVariety || "")
          .split(",")
          .map((g) => g.trim())
          .includes(target)
      ),
      emptyText: "No wines with this grape.",
    };
  }

  switch (metric) {
    case "bottles":
      return { kind: "wine", wines, emptyText: "No bottles in your collection yet." };
    case "value":
      return { kind: "value", wines: [...wines].sort((a, b) => (b.price ?? 0) - (a.price ?? 0)) };
    case "ratings":
      return {
        kind: "wine",
        wines: wines
          .filter((w) => w.userRating != null && w.userRating > 0)
          .sort((a, b) => (b.userRating ?? 0) - (a.userRating ?? 0)),
        emptyText: "No rated wines yet.",
      };
    case "consumed":
      return { kind: "history" };
    case "price":
      return {
        kind: "wine",
        wines: [...wines]
          .filter((w) => w.price != null)
          .sort((a, b) => (b.price ?? 0) - (a.price ?? 0)),
        emptyText: "No bottles with a recorded price.",
      };
    case "vintage":
      return {
        kind: "wine",
        wines: [...wines]
          .filter((w) => w.vintage != null)
          .sort((a, b) => (a.vintage ?? 0) - (b.vintage ?? 0)),
        emptyText: "No vintage data available.",
      };
    case "countries":
      return { kind: "grouped", groupKey: "country", basePath: "/stats/countries" };
    case "grapes":
      return { kind: "grouped", groupKey: "grape", basePath: "/stats/grapes" };
  }
}

function DetailBody({
  metric,
  drillValue,
  wines,
  history,
  cabinets,
  formatPrice,
  wineTextColors,
  onWineClick,
}: DetailBodyProps) {
  const view = useMemo(
    () => buildView(metric, drillValue, wines),
    [metric, drillValue, wines]
  );

  switch (view.kind) {
    case "wine":
      return (
        <WineList
          wines={view.wines}
          cabinets={cabinets}
          formatPrice={formatPrice}
          wineTextColors={wineTextColors}
          onWineClick={onWineClick}
          emptyText={view.emptyText}
        />
      );

    case "value":
      return (
        <ValueList wines={view.wines} formatPrice={formatPrice} onWineClick={onWineClick} />
      );

    case "history":
      return <HistoryList history={history} formatPrice={formatPrice} />;

    case "grouped":
      return <GroupedList wines={wines} groupKey={view.groupKey} basePath={view.basePath} />;
  }
}

// -----------------------------------------------------------------------
// WineList — reuses inventory's WineListItem so visual style matches.
// -----------------------------------------------------------------------

interface WineListProps {
  wines: Wine[];
  cabinets: Cabinet[];
  formatPrice: (amount: number, decimals?: number) => string;
  wineTextColors: ReturnType<typeof useWineTextColors>;
  onWineClick: (wine: Wine) => void;
  emptyText: string;
}

function WineList({
  wines,
  cabinets,
  formatPrice,
  wineTextColors,
  onWineClick,
  emptyText,
}: WineListProps) {
  const cabinetMap = useMemo(() => buildCabinetMap(cabinets), [cabinets]);
  const { visible, hasMore, remaining, showMore, sentinelRef } = useIncrementalList(wines);
  if (wines.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {emptyText}
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {wines.length} {wines.length === 1 ? "wine" : "wines"}
      </p>
      {visible.map((wine) => (
        <WineListItem
          key={wine.id}
          wine={wine}
          cabinetName={getCabinetName(wine, cabinetMap)}
          wineTextColors={wineTextColors}
          formatPrice={formatPrice}
          onClick={() => onWineClick(wine)}
        />
      ))}
      {hasMore && (
        <LoadMore onMore={showMore} remaining={remaining} sentinelRef={sentinelRef} />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// ValueList — for /stats/value, shows cost / market / gain per bottle.
// -----------------------------------------------------------------------

interface ValueListProps {
  wines: Wine[];
  formatPrice: (amount: number, decimals?: number) => string;
  onWineClick: (wine: Wine) => void;
}

function ValueList({ wines, formatPrice, onWineClick }: ValueListProps) {
  const { visible, hasMore, remaining, showMore, sentinelRef } = useIncrementalList(wines);
  if (wines.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No bottles with pricing data.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{wines.length} bottles</p>
      {visible.map((w) => {
        const cost = w.price ?? 0;
        const market = w.retailPrice ?? 0;
        const gain = market > 0 ? market - cost : null;
        const gainPct = gain != null && cost > 0 ? (gain / cost) * 100 : null;
        return (
          <button
            key={w.id}
            type="button"
            onClick={() => onWineClick(w)}
            className="w-full text-left rounded-lg border bg-card p-4 hover:bg-accent/50 active:scale-[0.99] transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{w.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {w.winery}
                  {w.vintage ? ` · ${w.vintage}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular-nums">
                  {w.price != null ? formatPrice(cost) : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">cost</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">
                Market:{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {market > 0 ? formatPrice(market) : "—"}
                </span>
              </span>
              {gain != null && (
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    gain > 0 && "text-green-600 dark:text-green-500",
                    gain < 0 && "text-red-600 dark:text-red-500",
                    gain === 0 && "text-muted-foreground"
                  )}
                >
                  {gain > 0 ? "+" : ""}
                  {formatPrice(gain)}
                  {gainPct != null && (
                    <span className="ml-1 opacity-70">
                      ({gainPct > 0 ? "+" : ""}
                      {gainPct.toFixed(1)}%)
                    </span>
                  )}
                </span>
              )}
            </div>
          </button>
        );
      })}
      {hasMore && (
        <LoadMore onMore={showMore} remaining={remaining} sentinelRef={sentinelRef} />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// HistoryList — for /stats/consumed.
// -----------------------------------------------------------------------

function HistoryList({
  history,
  formatPrice,
}: {
  history: WineHistoryItem[];
  formatPrice: (amount: number, decimals?: number) => string;
}) {
  const sorted = useMemo(
    () =>
      [...history].sort(
        (a, b) =>
          new Date(b.removedAt).getTime() - new Date(a.removedAt).getTime()
      ),
    [history]
  );
  const { visible, hasMore, remaining, showMore, sentinelRef } = useIncrementalList(sorted);

  if (sorted.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No history yet — bottles you drink will show up here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {sorted.length} {sorted.length === 1 ? "entry" : "entries"}
      </p>
      {visible.map((h) => {
        const dateStr = h.removedAt
          ? new Date(h.removedAt).toLocaleDateString()
          : "—";
        const rating = h.consumeRating ?? h.rating;
        const typeColor =
          WINE_TYPE_COLORS[h.type as keyof typeof WINE_TYPE_COLORS] || "#666";
        return (
          <div
            key={h.id}
            className="rounded-lg border bg-card p-4 flex items-start gap-3"
          >
            <div
              className={cn(
                "shrink-0 w-9 h-9 rounded-full flex items-center justify-center",
                isLightWineType(h.type) && "border-2 border-border"
              )}
              style={{ backgroundColor: typeColor }}
            >
              <WineIcon
                className="h-4 w-4"
                style={{ color: isLightWineType(h.type) ? "#333" : "#fff" }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{h.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {h.winery}
                    {h.vintage ? ` · ${h.vintage}` : ""}
                  </p>
                </div>
                {rating != null && rating > 0 && (
                  <div className="shrink-0 flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-semibold tabular-nums">
                      {rating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{h.reason === "drank" ? "Drank" : h.reason || "Removed"}</span>
                <span>{dateStr}</span>
                {h.price != null && (
                  <span className="tabular-nums">{formatPrice(h.price)}</span>
                )}
              </div>
              {h.consumeNotes && (
                <p className="mt-1 text-xs text-foreground/80 line-clamp-2">
                  {h.consumeNotes}
                </p>
              )}
            </div>
          </div>
        );
      })}
      {hasMore && (
        <LoadMore onMore={showMore} remaining={remaining} sentinelRef={sentinelRef} />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// GroupedList — country / grape breakdown. Each row links to the same
// metric page with ?value=<groupName> to drill in.
// -----------------------------------------------------------------------

interface GroupedListProps {
  wines: Wine[];
  groupKey: "country" | "grape";
  basePath: string;
}

function GroupedList({ wines, groupKey, basePath }: GroupedListProps) {
  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    if (groupKey === "country") {
      for (const w of wines) {
        const key = (w.country || "").trim() || "Unknown";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    } else {
      for (const w of wines) {
        const grapes = (w.grapeVariety || "")
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean);
        if (grapes.length === 0) {
          counts.set("Unknown", (counts.get("Unknown") ?? 0) + 1);
          continue;
        }
        for (const g of grapes) {
          counts.set(g, (counts.get(g) ?? 0) + 1);
        }
      }
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [wines, groupKey]);

  if (groups.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No data yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {groups.length} {groupKey === "country" ? "countries" : "grapes"}
      </p>
      {groups.map((g) => (
        <Link
          key={g.name}
          href={`${basePath}?value=${encodeURIComponent(g.name)}`}
          className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 hover:bg-accent/50 active:scale-[0.99] transition-all"
        >
          <div className="min-w-0 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              {groupKey === "country" ? (
                <MapPin className="h-4 w-4 text-primary" />
              ) : (
                <Grape className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{g.name}</p>
              <p className="text-xs text-muted-foreground">
                {g.count} {g.count === 1 ? "bottle" : "bottles"}
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </Link>
      ))}
    </div>
  );
}
