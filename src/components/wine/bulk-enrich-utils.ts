import type { Wine } from "@/types/wine";

export interface EnrichResult {
  wineId: string;
  wineName: string;
  status: "pending" | "processing" | "success" | "error" | "skipped";
  error?: string;
}

/**
 * A wine is considered enriched if it has been through the AI enrichment
 * pipeline at least once. Uses `aiEnrichedAt` (set unconditionally by
 * every successful enrichment) because some fields AI returns may be
 * legitimately empty for obscure wines — checking foodPairings/aiRatings
 * values causes infinite re-enrichment on those wines.
 *
 * Legacy fallback: wines enriched before the `aiEnrichedAt` field existed
 * are treated as enriched if they have both foodPairings AND aiRatings
 * populated (the previous heuristic).
 */
export function isFullyEnriched(w: Wine): boolean {
  if (w.aiEnrichedAt) return true;
  return !!(w.foodPairings && w.aiRatings);
}

/** Generate a deduplication key for a wine (name+winery+vintage) */
export function dupeKey(w: Wine): string {
  return `${w.name.toLowerCase()}|${w.winery.toLowerCase()}|${w.vintage ?? ""}`;
}

/** Number of parallel AI calls */
export const CONCURRENCY = 5;

export interface DeduplicationResult {
  uniqueWines: Wine[];
  dupeMap: Map<number, Wine[]>;
}

/**
 * Group wines by name+winery+vintage. Returns the unique wines plus
 * a map from each unique index to its duplicate wines.
 */
export function deduplicateWines(wines: Wine[]): DeduplicationResult {
  const seen = new Map<string, number>();
  const uniqueWines: Wine[] = [];
  const dupeMap = new Map<number, Wine[]>();

  for (const w of wines) {
    const key = dupeKey(w);
    if (seen.has(key)) {
      const firstIdx = seen.get(key)!;
      dupeMap.get(firstIdx)!.push(w);
    } else {
      const idx = uniqueWines.length;
      seen.set(key, idx);
      uniqueWines.push(w);
      dupeMap.set(idx, []);
    }
  }

  return { uniqueWines, dupeMap };
}

/** Build the initial EnrichResult[] from deduplicated wines */
export function buildInitialResults(
  uniqueWines: Wine[],
  dupeMap: Map<number, Wine[]>
): EnrichResult[] {
  return uniqueWines.map((w, idx) => {
    const dupes = dupeMap.get(idx) || [];
    return {
      wineId: w.id,
      wineName: dupes.length > 0 ? `${w.name} (×${dupes.length + 1})` : w.name,
      status: "pending" as const,
    };
  });
}

/** Build the partial Wine updates from an enrichment result (non-overwriting) */
export function buildWineUpdates(
  wine: Wine,
  data: {
    description?: string;
    foodPairings?: string;
    estimatedPrice?: number | null;
    drinkWindow?: string;
    drinkBy?: string;
    disposition?: string;
    ratings?: Wine["aiRatings"];
  }
): Partial<Wine> {
  const updates: Partial<Wine> = {};
  if (!wine.description && data.description) updates.description = data.description;
  if (!wine.foodPairings && data.foodPairings) updates.foodPairings = data.foodPairings;
  if (!wine.retailPrice && data.estimatedPrice) updates.retailPrice = data.estimatedPrice;
  if (!wine.drinkWindow && data.drinkWindow) updates.drinkWindow = data.drinkWindow;
  if (!wine.drinkBy && data.drinkBy) updates.drinkBy = data.drinkBy;
  if (!wine.disposition && data.disposition) updates.disposition = data.disposition;
  if (!wine.aiRatings && data.ratings) updates.aiRatings = data.ratings;
  // Always stamp aiEnrichedAt so `isFullyEnriched` returns true next time,
  // even if AI returned empty values for obscure wines (otherwise they'd
  // re-enrich on every refresh).
  updates.aiEnrichedAt = new Date().toISOString();
  return updates;
}

/** Build a wine input object for the AI enrichment call */
export function buildWineInput(wine: Wine) {
  return {
    name: wine.name,
    winery: wine.winery,
    vintage: wine.vintage,
    type: wine.type,
    region: wine.region,
    country: wine.country,
    grapeVariety: wine.grapeVariety,
    description: wine.description,
    drinkBy: wine.drinkBy,
    price: wine.price,
  };
}

/** Count unique wines in a list (by name+winery+vintage) */
export function countUnique(wines: Wine[]): number {
  const seen = new Set<string>();
  for (const w of wines) {
    seen.add(dupeKey(w));
  }
  return seen.size;
}
