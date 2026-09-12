// Guided cellar-sorting planner.
//
// Given the wines currently placed in a set of cabinets, produces an ordered
// list of single-bottle moves that rearranges them into a tidy grouping
// (e.g. Type → Region → Varietal) WITHIN the slots they already occupy — same
// physical footprint, just sorted contents. The UI walks the user through the
// moves one at a time, glowing the destination slot for each.
//
// The sequencer only ever asks the user to hold ONE bottle at a time. When a
// bottle's target slot is free it goes straight there; when every remaining
// target is occupied (a permutation cycle) one bottle is set aside on the
// "table" (the unfiled pile) to break the cycle, then placed once its slot
// opens up. This is selection/cycle-sort with a single buffer.
//
// Pure + deterministic so it can be unit-tested without React.

import type { Wine, Cabinet, Wall } from "@/types/wine";
import { bottleFitsSlot } from "@/types/wine";
import { getEffectiveDisposition } from "@/lib/drink-window";

export type SortScheme =
  | "type-region-varietal"
  | "region-varietal"
  | "varietal-region"
  | "drink-window"
  | "vintage"
  | "rating";

export interface SlotPos {
  cabinetId: string;
  row: number;
  col: number;
}

export interface SortMove {
  /** "place" → put the bottle into its destination slot. "setAside" → pull it
   *  out to the table to free its slot (a cycle-breaker; it gets placed later). */
  kind: "place" | "setAside";
  wineId: string;
  wineName: string;
  wineVintage: number | null;
  /** Where the bottle is right now: a slot, or "table" (already set aside). */
  from: SlotPos | "table";
  /** Where it's going: a slot, or "table" (for setAside). */
  to: SlotPos | "table";
}

/** A bottle that cannot go anywhere but where it is (no size-compatible slot
 *  left in scope). It stays pinned in place unless the user opts to set it
 *  aside to the unfiled pile instead. */
export interface SortConflict {
  wineId: string;
  wineName: string;
  wineVintage: number | null;
  bottleSize: string;
  /** The slot it currently occupies (and keeps, unless set aside). */
  slot: SlotPos;
  reason: "no-compatible-slot";
}

export interface SortPlan {
  scheme: SortScheme;
  /** Bottles considered (front-of-slot, grid-placed, in scope). */
  bottleCount: number;
  /** Occupied slots being rearranged. */
  slotCount: number;
  moves: SortMove[];
  /** The proposed end state: every scoped bottle → its final slot (pinned
   *  bottles included at their current slot; set-aside bottles excluded). */
  assignments: Array<{ wineId: string; slot: SlotPos }>;
  /** Bottles with no size-compatible destination — see SortConflict. */
  conflicts: SortConflict[];
}

const SCHEME_LABELS: Record<SortScheme, string> = {
  "type-region-varietal": "Type → Region → Varietal",
  "region-varietal": "Region → Varietal",
  "varietal-region": "Varietal → Region",
  "drink-window": "Drink-soon first",
  "vintage": "Vintage (oldest first)",
  "rating": "Your rating (best first)",
};

export function schemeLabel(scheme: SortScheme): string {
  return SCHEME_LABELS[scheme];
}

// ── helpers ────────────────────────────────────────────────────────────────

function slotKey(pos: SlotPos): string {
  return `${pos.cabinetId}:${pos.row}:${pos.col}`;
}

function parseSlotKey(key: string): SlotPos {
  const lastColon = key.lastIndexOf(":");
  const previousColon = key.lastIndexOf(":", lastColon - 1);
  return {
    cabinetId: key.slice(0, previousColon),
    row: Number(key.slice(previousColon + 1, lastColon)),
    col: Number(key.slice(lastColon + 1)),
  };
}

/** Empty strings sort LAST (a wine with no region shouldn't lead the list). */
function sortText(text: string | null | undefined): string {
  const value = (text ?? "").trim().toLowerCase();
  return value === "" ? "￿" : value;
}

/** Coarse colour groups so "Type" sorting keeps reds / whites / bubbles in
 *  contiguous blocks rather than splitting on every sparkling sub-variant. */
function typeGroupRank(type: string): string {
  const normalized = (type ?? "").toLowerCase();
  const order = [
    ["red"],
    ["orange"],
    ["rosé", "rose"],
    ["white", "green"],
    ["sparkling", "champagne", "prosecco", "cava", "crémant", "cremant", "franciacorta"],
    ["dessert"],
    ["fortified"],
  ];
  const rank = order.findIndex((group) => group.includes(normalized));
  return rank === -1 ? "99" : String(rank).padStart(2, "0"); // unknown types last
}

/** Ascending vintage within a group; missing vintage sorts last ("~" > digits). */
function vintageKey(vintage: number | null | undefined): string {
  return vintage != null ? String(vintage).padStart(5, "0") : "~";
}

/** "Drink soon" rank: past-peak leads (rescue it), then drink-now, then hold. */
function dispositionRank(wine: Wine): string {
  const disposition = getEffectiveDisposition(wine);
  if (disposition === "P") return "0";
  if (disposition === "D") return "1";
  if (disposition === "H") return "2";
  return "3"; // unknown last
}

/** Descending 0-5 rating; unrated last. 5.0 → "0500"…, so higher rating sorts first. */
function ratingKey(rating: number | null | undefined): string {
  if (rating == null || rating <= 0) return "~";
  return String(Math.round((5 - rating) * 100)).padStart(4, "0");
}

function sortKeys(wine: Wine, scheme: SortScheme): string[] {
  const region = sortText(wine.region);
  const varietal = sortText(wine.grapeVariety);
  const type = typeGroupRank(wine.type);
  const winery = sortText(wine.winery);
  const vintage = vintageKey(wine.vintage);
  const name = sortText(wine.name);
  switch (scheme) {
    case "type-region-varietal":
      return [type, region, varietal, winery, vintage, name];
    case "region-varietal":
      return [region, varietal, type, winery, vintage, name];
    case "varietal-region":
      return [varietal, region, type, winery, vintage, name];
    case "drink-window":
      return [dispositionRank(wine), vintage, type, region, name];
    case "vintage":
      return [vintage, type, region, winery, name];
    case "rating":
      return [ratingKey(wine.userRating), type, region, vintage, name];
  }
}

function makeComparator(scheme: SortScheme): (a: Wine, b: Wine) => number {
  return (a, b) => {
    const keysA = sortKeys(a, scheme);
    const keysB = sortKeys(b, scheme);
    for (let i = 0; i < keysA.length; i++) {
      if (keysA[i] < keysB[i]) return -1;
      if (keysA[i] > keysB[i]) return 1;
    }
    // Stable tiebreak on id so the plan is deterministic across runs.
    return a.id.localeCompare(b.id);
  };
}

function moveOf(
  kind: SortMove["kind"],
  wine: Wine,
  from: SlotPos | "table",
  to: SlotPos | "table"
): SortMove {
  return {
    kind,
    wineId: wine.id,
    wineName: wine.name,
    wineVintage: wine.vintage,
    from,
    to,
  };
}

// ── planner ─────────────────────────────────────────────────────────────────

export interface BuildSortPlanParams {
  /** All wines (the planner filters to the scope cabinets itself). */
  wines: Wine[];
  /** The cabinets in scope (one rack, a wall's worth, or the whole cellar). */
  cabinets: Cabinet[];
  /** All walls — used only for reading order (wall sortOrder). */
  walls: Wall[];
  scheme: SortScheme;
  /** Conflicted bottles the user chose to SET ASIDE (unfile) rather than
   *  leave pinned in place. Their slots become available to other bottles. */
  setAsideWineIds?: ReadonlySet<string>;
}

/**
 * Build a sort plan. Only front-of-slot bottles in real grid rows are
 * rearranged — bottles stacked behind (depth > 0) and loose/bulk-zone bottles
 * are left untouched (they have no single canonical slot to sort into).
 */
export function buildSortPlan({
  wines,
  cabinets,
  walls,
  scheme,
  setAsideWineIds = new Set(),
}: BuildSortPlanParams): SortPlan {
  const cabIds = new Set(cabinets.map((c) => c.id));

  // Which rows of each cabinet are bulk/box storage (not sortable grid slots).
  const storageRowsByCab = new Map<string, Set<number>>();
  for (const c of cabinets) {
    storageRowsByCab.set(c.id, new Set((c.storageRows ?? []).map((sr) => sr.row)));
  }

  const isGridSlotWine = (w: Wine): boolean =>
    !!w.cabinetId &&
    cabIds.has(w.cabinetId) &&
    w.row != null &&
    w.col != null &&
    (w.depth ?? 0) === 0 &&
    !(storageRowsByCab.get(w.cabinetId)?.has(w.row) ?? false);

  const scopeWines = wines.filter(isGridSlotWine);

  // Occupied slots in reading order: wall sortOrder → cabinet sortOrder →
  // row (top to bottom) → col (left to right).
  const wallRank = new Map(walls.map((w) => [w.id, w.sortOrder ?? 0]));
  const sortedCabs = [...cabinets].sort(
    (a, b) =>
      (wallRank.get(a.wallId) ?? 0) - (wallRank.get(b.wallId) ?? 0) ||
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
      a.id.localeCompare(b.id)
  );

  const wineAt = new Map<string, Wine>();
  for (const w of scopeWines) wineAt.set(`${w.cabinetId}:${w.row}:${w.col}`, w);

  const occupiedSlots: SlotPos[] = [];
  for (const c of sortedCabs) {
    const storage = storageRowsByCab.get(c.id) ?? new Set<number>();
    for (let r = 0; r < c.rows; r++) {
      if (storage.has(r)) continue;
      for (let col = 0; col < c.cols; col++) {
        const w = wineAt.get(`${c.id}:${r}:${col}`);
        if (w) occupiedSlots.push({ cabinetId: c.id, row: r, col });
      }
    }
  }

  // ── Size-constrained slot assignment ─────────────────────────────────
  // Each slot has a max bottle size (per-row rowSizes; default "standard").
  // Sorted bottles are assigned slot-major in reading order: every slot
  // takes the earliest still-unplaced bottle that physically fits it, which
  // keeps the sorted grouping as close to reading order as fit allows.
  // Bottles that fit NO remaining slot get pinned where they are (reported
  // as conflicts, unless the user chose to set them aside instead) and
  // their slot leaves the pool; assignment reruns until it converges.
  const rowMax = new Map<string, string>(); // "cabinetId:row" → maxSize
  for (const c of cabinets) {
    for (const rs of c.rowSizes ?? []) rowMax.set(`${c.id}:${rs.row}`, rs.maxSize);
  }
  const slotMaxSize = (pos: SlotPos): string =>
    rowMax.get(`${pos.cabinetId}:${pos.row}`) ?? "standard";

  const wineById = new Map(scopeWines.map((w) => [w.id, w]));
  const currentSlotOf = new Map<string, SlotPos>(); // wineId → current slot
  for (const [key, wine] of wineAt) currentSlotOf.set(wine.id, parseSlotKey(key));

  const asideChosen = new Set(
    scopeWines.filter((w) => setAsideWineIds.has(w.id)).map((w) => w.id)
  );

  const sortedAll = [...scopeWines].sort(makeComparator(scheme));
  const pinned = new Map<string, SlotPos>(); // wineId → its (kept) current slot
  const conflicts: SortConflict[] = [];

  const targetSlotOf = new Map<string, SlotPos>(); // wineId → target slot
  const targetWineKey = new Map<string, string>(); // slotKey → desired wineId

  // Iterative assignment: pinning removes a bottle AND its slot, so re-run
  // until every remaining bottle found a home. Each round pins ≥1 bottle,
  // so this terminates in ≤ bottles rounds.
  for (;;) {
    targetSlotOf.clear();
    targetWineKey.clear();
    const candidates = sortedAll.filter(
      (w) => !pinned.has(w.id) && !asideChosen.has(w.id)
    );
    // Pool = occupied slots whose occupant isn't pinned there. (A pinned
    // bottle keeps exactly its own slot, so excluding by occupant is enough;
    // slots of set-aside bottles stay in the pool — they'll be free.)
    const poolSlots = occupiedSlots.filter(
      (pos) => !pinned.has(wineAt.get(slotKey(pos))!.id)
    );

    const placed = new Set<string>();
    for (const slot of poolSlots) {
      const max = slotMaxSize(slot);
      const next = candidates.find(
        (w) => !placed.has(w.id) && bottleFitsSlot(w.bottleSize, max)
      );
      if (!next) continue; // slot stays empty (more slots than fitting bottles)
      placed.add(next.id);
      targetSlotOf.set(next.id, slot);
      targetWineKey.set(slotKey(slot), next.id);
    }

    const leftovers = candidates.filter((w) => !placed.has(w.id));
    if (leftovers.length === 0) break;
    for (const wine of leftovers) {
      const slot = currentSlotOf.get(wine.id)!;
      pinned.set(wine.id, slot);
      conflicts.push({
        wineId: wine.id,
        wineName: wine.name,
        wineVintage: wine.vintage,
        bottleSize: wine.bottleSize ?? "standard",
        slot,
        reason: "no-compatible-slot",
      });
    }
  }

  // Pinned bottles keep their slot in the final layout.
  for (const [wineId, pos] of pinned) {
    targetSlotOf.set(wineId, pos);
    targetWineKey.set(slotKey(pos), wineId);
  }

  // Simulate the rearrangement to produce the ordered move list.
  const current = new Map<string, string>(); // slotKey → wineId currently there
  for (const [key, wine] of wineAt) current.set(key, wine.id);
  const onTable: string[] = []; // wineIds set aside, in the order they came out

  // Set-aside choices go out FIRST — they free their slots for everyone else
  // and never come back (they end the plan unfiled).
  const upfrontMoves: SortMove[] = [];
  for (const wine of sortedAll) {
    if (!asideChosen.has(wine.id)) continue;
    const slot = currentSlotOf.get(wine.id)!;
    upfrontMoves.push(moveOf("setAside", wine, slot, "table"));
    current.delete(slotKey(slot));
  }

  const slotKeysInOrder = occupiedSlots.map(slotKey);
  const isCorrect = (key: string): boolean =>
    current.get(key) === targetWineKey.get(key);

  const moves: SortMove[] = [...upfrontMoves];
  const maxIter = slotKeysInOrder.length * 4 + 16; // safety bound
  let guard = 0;

  while (guard++ < maxIter) {
    // 1a) A bottle on the table whose target slot is now free → place it.
    const tableIndex = onTable.findIndex(
      (wineId) => !current.has(slotKey(targetSlotOf.get(wineId)!))
    );
    if (tableIndex !== -1) {
      const wineId = onTable[tableIndex];
      const dest = targetSlotOf.get(wineId)!;
      moves.push(moveOf("place", wineById.get(wineId)!, "table", dest));
      current.set(slotKey(dest), wineId);
      onTable.splice(tableIndex, 1);
      continue;
    }

    // 1b) A misplaced bottle in a slot whose target slot is free → move it.
    let acted = false;
    for (const occupiedKey of slotKeysInOrder) {
      const wineId = current.get(occupiedKey);
      if (!wineId || isCorrect(occupiedKey)) continue;
      const dest = targetSlotOf.get(wineId)!;
      const destKey = slotKey(dest);
      if (destKey === occupiedKey || current.has(destKey)) continue;
      moves.push(moveOf("place", wineById.get(wineId)!, parseSlotKey(occupiedKey), dest));
      current.delete(occupiedKey);
      current.set(destKey, wineId);
      acted = true;
      break;
    }
    if (acted) continue;

    // 2) Every remaining target is occupied (a cycle). Set one misplaced
    //    bottle aside on the table to open up its slot.
    let setAside = false;
    for (const occupiedKey of slotKeysInOrder) {
      const wineId = current.get(occupiedKey);
      if (!wineId || isCorrect(occupiedKey)) continue;
      moves.push(moveOf("setAside", wineById.get(wineId)!, parseSlotKey(occupiedKey), "table"));
      current.delete(occupiedKey);
      onTable.push(wineId);
      setAside = true;
      break;
    }
    if (!setAside) break; // nothing left to do
  }

  return {
    scheme,
    bottleCount: scopeWines.length,
    slotCount: occupiedSlots.length,
    moves,
    assignments: [...targetSlotOf.entries()].map(([wineId, slot]) => ({ wineId, slot })),
    conflicts,
  };
}

/**
 * "Rack by rack" plan: every cabinet is sorted within itself — no bottle ever
 * crosses to another rack. Just a concatenation of per-cabinet plans in
 * reading order (wall sortOrder → cabinet sortOrder), so the user finishes one
 * rack completely before the assistant points them at the next.
 */
export function buildRackByRackPlan({
  wines,
  cabinets,
  walls,
  scheme,
  setAsideWineIds,
}: BuildSortPlanParams): SortPlan {
  const wallRank = new Map(walls.map((w) => [w.id, w.sortOrder ?? 0]));
  const orderedCabs = [...cabinets].sort(
    (a, b) =>
      (wallRank.get(a.wallId) ?? 0) - (wallRank.get(b.wallId) ?? 0) ||
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
      a.id.localeCompare(b.id)
  );

  let bottleCount = 0;
  let slotCount = 0;
  const moves: SortMove[] = [];
  const assignments: SortPlan["assignments"] = [];
  const conflicts: SortConflict[] = [];
  for (const cab of orderedCabs) {
    const sub = buildSortPlan({ wines, cabinets: [cab], walls, scheme, setAsideWineIds });
    bottleCount += sub.bottleCount;
    slotCount += sub.slotCount;
    moves.push(...sub.moves);
    assignments.push(...sub.assignments);
    conflicts.push(...sub.conflicts);
  }
  return { scheme, bottleCount, slotCount, moves, assignments, conflicts };
}
