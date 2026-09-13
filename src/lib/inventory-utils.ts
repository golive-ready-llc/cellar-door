import type { Wine, WineType } from "@/types/wine";

export type SortKey = "name" | "vintage" | "price" | "rating" | "addedAt" | "type";
export type SortDirection = "asc" | "desc";
export type ViewMode = "grid" | "list" | "gallery";

export function collectUniqueTags(wines: Wine[]): string[] {
  const tagSet = new Set<string>();
  wines.forEach((w) => w.tags?.forEach((t) => tagSet.add(t)));
  return Array.from(tagSet).sort();
}

export function buildCabinetMap(cabinets: { id: string; name: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const cab of cabinets) {
    map.set(cab.id, cab.name);
  }
  return map;
}

export function filterWines(
  wines: Wine[],
  selectedType: WineType | "all",
  selectedTags: string[],
  searchQuery: string
): Wine[] {
  let result = wines;

  if (selectedType !== "all") {
    if (selectedType === "sparkling") {
      // Sparkling is orthogonal to color — match boolean flag OR legacy type="sparkling"
      result = result.filter((w) => w.sparkling === true || (
        ["sparkling", "champagne", "prosecco", "cava", "crémant", "cremant", "franciacorta"].includes(
          (w.type ?? "").toLowerCase()
        )
      ));
    } else {
      result = result.filter((w) => w.type === selectedType);
    }
  }

  if (selectedTags.length > 0) {
    result = result.filter((w) =>
      selectedTags.every((tag) => w.tags?.includes(tag))
    );
  }

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    result = result.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.winery.toLowerCase().includes(q) ||
        w.grapeVariety.toLowerCase().includes(q) ||
        w.region.toLowerCase().includes(q) ||
        w.country.toLowerCase().includes(q) ||
        (w.vintage && w.vintage.toString().includes(q)) ||
        w.tags?.some((t) => t.includes(q))
    );
  }

  return result;
}

export function sortWines(wines: Wine[], sortKey: SortKey, sortDir: SortDirection): Wine[] {
  return [...wines].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "name":
        return dir * a.name.localeCompare(b.name);
      case "vintage":
        return dir * ((a.vintage ?? 0) - (b.vintage ?? 0));
      case "price":
        return dir * ((a.price ?? 0) - (b.price ?? 0));
      case "rating":
        return dir * ((a.userRating ?? 0) - (b.userRating ?? 0));
      case "addedAt":
        return (
          dir *
          ((new Date(a.addedAt).getTime() || 0) - (new Date(b.addedAt).getTime() || 0))
        );
      case "type":
        return dir * a.type.localeCompare(b.type);
      default:
        return 0;
    }
  });
}

export function getCabinetName(wine: Wine, cabinetMap: Map<string, string>): string {
  return wine.cabinetId ? cabinetMap.get(wine.cabinetId) || "" : "Unassigned";
}

export function computeTotalValue(wines: Wine[]): number {
  return wines.reduce((sum, w) => sum + (w.price ?? 0), 0);
}

// ─── Wine Grouping (×N badge) ───────────────────────────────

export interface GroupedWine {
  /** The first wine in the group (used for display and detail click) */
  wine: Wine;
  /** All wine IDs in this group */
  wineIds: string[];
  /** Number of identical bottles */
  count: number;
  /** Total value of all bottles in the group */
  totalPrice: number | null;
  /** Grouping key */
  groupKey: string;
}

/** Build a grouping key from name + winery + vintage */
function wineGroupKey(w: Wine): string {
  const name = (w.name || "").trim().toLowerCase();
  const winery = (w.winery || "").trim().toLowerCase();
  const vintage = w.vintage ?? "";
  return `${name}||${winery}||${vintage}`;
}

/** Group wines by name+winery+vintage. Returns grouped entries preserving original sort order. */
export function groupWinesByIdentity(wines: Wine[]): GroupedWine[] {
  const map = new Map<string, GroupedWine>();
  const order: string[] = [];

  for (const wine of wines) {
    const key = wineGroupKey(wine);
    const existing = map.get(key);
    if (existing) {
      existing.wineIds.push(wine.id);
      existing.count += 1;
      if (wine.price !== null) {
        existing.totalPrice = (existing.totalPrice ?? 0) + wine.price;
      }
    } else {
      order.push(key);
      map.set(key, {
        wine,
        wineIds: [wine.id],
        count: 1,
        totalPrice: wine.price,
        groupKey: key,
      });
    }
  }

  return order.map((key) => map.get(key)!);
}

/** Count unique wines (by name+winery+vintage). */
export function countUniqueWines(wines: Wine[]): number {
  const seen = new Set<string>();
  for (const w of wines) {
    seen.add(wineGroupKey(w));
  }
  return seen.size;
}
