import type { Wine, Wall, Cabinet, StorageRow } from "@/types/wine";

/** Calculate total cellar capacity across all cabinets */
export function calcTotalCapacity(cabinets: Cabinet[]): number {
  return cabinets.reduce((sum, c) => {
    const storageRowSet = new Set(
      c.storageRows.filter((sr) => sr.row >= 0 && sr.row < c.rows).map((sr) => sr.row)
    );
    const slotRows = c.rows - storageRowSet.size;
    const slotCapacity = slotRows * c.cols * (c.depth || 1);
    const bulkCapacity = c.storageRows.reduce((s, sr) => s + sr.capacity, 0);
    return sum + slotCapacity + bulkCapacity;
  }, 0);
}

/** Calculate cellar stats from wines and cabinets */
export function calcCellarStats(wines: Wine[], cabinets: Cabinet[]) {
  const totalBottles = wines.length;
  const totalValue = wines.reduce((sum, w) => sum + (w.price ?? 0), 0);
  const totalRetailValue = wines.reduce(
    (sum, w) => sum + (w.retailPrice ?? w.price ?? 0),
    0
  );
  const profitLoss = totalRetailValue - totalValue;
  const totalCapacity = calcTotalCapacity(cabinets);
  return { totalBottles, totalValue, totalRetailValue, profitLoss, totalCapacity };
}

/** Collect all unique tags from wines */
export function collectAllTags(wines: Wine[]): string[] {
  const tagSet = new Set<string>();
  wines.forEach((w) => w.tags?.forEach((t) => tagSet.add(t)));
  return Array.from(tagSet).sort();
}

/** Collect unique storage locations from walls */
export function collectLocations(walls: Wall[]): string[] {
  const locs = new Set<string>();
  walls.forEach((w) => locs.add(w.location || "Home"));
  return Array.from(locs).sort();
}

/** Filter wines that are unfiled (no cabinet or no position) */
export function filterUnfiledWines(wines: Wine[]): Wine[] {
  return wines.filter(
    (w) => w.cabinetId === null || w.row === null || w.col === null
  );
}

/** Determine if a wine is stored in box or bulk */
export function getWineStorageInfo(
  wine: Wine,
  cabinets: Cabinet[],
  wines: Wine[]
): { type: "box" | "bulk" | null; count: number; capacity: number } {
  if (!wine.cabinetId || wine.row === null || wine.row === undefined)
    return { type: null, count: 0, capacity: 0 };
  const cabinet = cabinets.find((c) => c.id === wine.cabinetId);
  if (!cabinet) return { type: null, count: 0, capacity: 0 };
  const sr = cabinet.storageRows?.find((s) => s.row === wine.row);
  if (!sr) return { type: null, count: 0, capacity: 0 };
  const count = wines.filter(
    (w) => w.cabinetId === wine.cabinetId && w.row === wine.row
  ).length;
  return { type: sr.type, count, capacity: sr.capacity };
}

/** Build edit-mode draft capacity info */
export function calcDraftCapacity(
  draft: { rows: number; cols: number; depth: number; storageRows: StorageRow[] }
) {
  const storageRowMap = new Map<number, StorageRow>();
  for (const sr of draft.storageRows) storageRowMap.set(sr.row, sr);
  const gridSlots = Array.from({ length: draft.rows }, (_, r) =>
    storageRowMap.has(r) ? 0 : draft.cols * (draft.depth || 1)
  ).reduce((a, b) => a + b, 0);
  const storageCapacity = draft.storageRows.reduce(
    (sum, sr) => sum + sr.capacity,
    0
  );
  return gridSlots + storageCapacity;
}

/** Count out-of-bounds wines in a draft section */
export function countOutOfBounds(
  draft: { id: string; rows: number; cols: number; storageRows: StorageRow[]; isNew?: boolean },
  wines: Wine[]
): number {
  if (draft.isNew) return 0;
  const cabinetWines = wines.filter((w) => w.cabinetId === draft.id);
  const storageRowIndicesSet = new Set(draft.storageRows.map((sr) => sr.row));
  return cabinetWines.filter(
    (w) =>
      w.row !== null &&
      w.col !== null &&
      !storageRowIndicesSet.has(w.row!) &&
      (w.row! >= draft.rows || w.col! >= draft.cols)
  ).length;
}
