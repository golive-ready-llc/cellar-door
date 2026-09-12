import {
  WINE_TYPES,
  WINE_TYPE_COLORS,
  WINE_TYPE_LABELS,
  DISPOSITION_LABELS,
  DISPOSITION_COLORS,
} from "@/types/constants";
import type { Wine, WineHistoryItem } from "@/types/wine";

// ============ Core Stats ============

export interface CoreStats {
  totalBottles: number;
  totalValue: number;
  totalRetailValue: number;
  avgPrice: number;
  avgRating: number;
  oldestVintage: number | null;
  newestVintage: number | null;
  totalConsumed: number;
}

export function computeCoreStats(wines: Wine[], history: WineHistoryItem[]): CoreStats {
  const totalBottles = wines.length;
  const totalValue = wines.reduce((s, w) => s + (w.price ?? 0), 0);
  const totalRetailValue = wines.reduce((s, w) => s + (w.retailPrice ?? 0), 0);
  const avgPrice = totalBottles > 0 ? totalValue / totalBottles : 0;

  const ratedWines = wines.filter((w) => w.userRating !== null);
  const avgRating =
    ratedWines.length > 0
      ? ratedWines.reduce((s, w) => s + (w.userRating ?? 0), 0) / ratedWines.length
      : 0;

  const vintageWines = wines.filter((w) => w.vintage !== null);
  const oldestVintage = vintageWines.reduce(
    (min, w) => (w.vintage !== null && w.vintage < min ? w.vintage : min),
    Infinity
  );
  const newestVintage = vintageWines.reduce(
    (max, w) => (w.vintage !== null && w.vintage > max ? w.vintage : max),
    0
  );

  return {
    totalBottles,
    totalValue,
    totalRetailValue,
    avgPrice,
    avgRating,
    oldestVintage: oldestVintage === Infinity ? null : oldestVintage,
    newestVintage: newestVintage === 0 ? null : newestVintage,
    totalConsumed: history.length,
  };
}

// ============ Chart Data ============

export interface TypeDataItem {
  name: string;
  value: number;
  color: string;
  type: string;
}

export function computeTypeData(wines: Wine[]): TypeDataItem[] {
  const counts: Record<string, number> = {};
  for (const w of wines) {
    counts[w.type] = (counts[w.type] || 0) + 1;
  }
  return WINE_TYPES.filter((t) => (counts[t] || 0) > 0).map((t) => ({
    name: WINE_TYPE_LABELS[t],
    value: counts[t] || 0,
    color: WINE_TYPE_COLORS[t],
    type: t,
  }));
}

export interface VintageDataItem {
  vintage: string;
  count: number;
}

export function computeVintageData(wines: Wine[]): VintageDataItem[] {
  const counts: Record<number, number> = {};
  for (const w of wines) {
    if (w.vintage !== null) {
      counts[w.vintage] = (counts[w.vintage] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([year, count]) => ({ vintage: year, count }))
    .sort((a, b) => Number(a.vintage) - Number(b.vintage));
}

export interface RegionDataItem {
  country: string;
  count: number;
}

export function computeRegionData(wines: Wine[]): RegionDataItem[] {
  const counts: Record<string, number> = {};
  for (const w of wines) {
    const key = w.country || "Unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export interface DispositionDataItem {
  name: string;
  value: number;
  color: string;
}

export function computeDispositionData(wines: Wine[]): DispositionDataItem[] {
  const counts: Record<string, number> = {};
  for (const w of wines) {
    if (w.disposition) {
      counts[w.disposition] = (counts[w.disposition] || 0) + 1;
    }
  }
  return Object.entries(counts).map(([key, count]) => ({
    name: DISPOSITION_LABELS[key] || key,
    value: count,
    color: DISPOSITION_COLORS[key] || "#666",
  }));
}

export interface ConsumptionDataItem {
  month: string;
  count: number;
  sortKey: string;
}

export function computeConsumptionData(history: WineHistoryItem[]): ConsumptionDataItem[] {
  const counts: Record<string, number> = {};
  for (const h of history) {
    const date = new Date(h.removedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([month, count]) => {
      const [year, m] = month.split("-");
      const date = new Date(Number(year), Number(m) - 1);
      return {
        month: date.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        count,
        sortKey: month,
      };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export interface PriceDataItem {
  label: string;
  min: number;
  max: number;
  count: number;
}

export function computePriceData(wines: Wine[]): PriceDataItem[] {
  const buckets: PriceDataItem[] = [
    { label: "$0-25", min: 0, max: 25, count: 0 },
    { label: "$25-50", min: 25, max: 50, count: 0 },
    { label: "$50-100", min: 50, max: 100, count: 0 },
    { label: "$100-250", min: 100, max: 250, count: 0 },
    { label: "$250-500", min: 250, max: 500, count: 0 },
    { label: "$500+", min: 500, max: Infinity, count: 0 },
  ];
  for (const w of wines) {
    // A wine with no recorded price is not a $0 wine (CSV import maps a $0
    // price to null on purpose). Bucketing it as "$0-25" invented a bar and
    // hid the chart's "Add prices to see distribution" empty state.
    if (w.price == null) continue;
    const price = w.price;
    for (const b of buckets) {
      if (price >= b.min && price < b.max) {
        b.count++;
        break;
      }
    }
  }
  return buckets.filter((b) => b.count > 0);
}

export function computeTopRated(wines: Wine[]): Wine[] {
  return [...wines]
    .filter((w) => w.userRating !== null)
    .sort((a, b) => (b.userRating ?? 0) - (a.userRating ?? 0))
    .slice(0, 5);
}

export interface GrapeDataItem {
  grape: string;
  count: number;
}

export function computeGrapeData(wines: Wine[]): GrapeDataItem[] {
  const counts: Record<string, number> = {};
  for (const w of wines) {
    if (w.grapeVariety) {
      const grapes = w.grapeVariety.split(",").map((g) => g.trim());
      for (const g of grapes) {
        if (g) counts[g] = (counts[g] || 0) + 1;
      }
    }
  }
  return Object.entries(counts)
    .map(([grape, count]) => ({ grape, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// ============ Share Stats Helpers ============

export function computeShareData(wines: Wine[]) {
  const regionCounts: Record<string, number> = {};
  const grapeCounts: Record<string, number> = {};
  for (const w of wines) {
    if (w.region) regionCounts[w.region] = (regionCounts[w.region] || 0) + 1;
    if (w.grapeVariety) {
      w.grapeVariety.split(",").forEach((g) => {
        const gr = g.trim();
        if (gr) grapeCounts[gr] = (grapeCounts[gr] || 0) + 1;
      });
    }
  }
  const topRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const topGrape = Object.entries(grapeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const byType: Record<string, number> = {};
  for (const w of wines) {
    byType[w.type] = (byType[w.type] || 0) + 1;
  }
  return {
    totalBottles: wines.length,
    totalValue: wines.reduce((sum, w) => sum + (w.price || 0), 0),
    byType,
    topRegion,
    topGrape,
  };
}
