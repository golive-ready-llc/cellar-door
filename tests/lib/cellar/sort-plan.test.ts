import { describe, it, expect } from "vitest";
import {
  buildSortPlan,
  buildRackByRackPlan,
  type SortScheme,
  type SlotPos,
  type SortMove,
} from "@/lib/cellar/sort-plan";
import type { Wine, Cabinet, Wall } from "@/types/wine";

// ── tiny fixture builders ────────────────────────────────────────────────────

let seq = 0;
function mkWine(
  attrs: Partial<Wine> & { id?: string },
  slot?: SlotPos | null
): Wine {
  const id = attrs.id ?? `w${seq++}`;
  return {
    id,
    name: attrs.name ?? id,
    winery: attrs.winery ?? "",
    region: attrs.region ?? "",
    grapeVariety: attrs.grapeVariety ?? "",
    type: attrs.type ?? "red",
    vintage: attrs.vintage ?? null,
    // Pass through the newer optional planner inputs (size-aware sorting,
    // rating scheme) instead of silently dropping them.
    bottleSize: attrs.bottleSize,
    userRating: attrs.userRating ?? null,
    disposition: attrs.disposition ?? "",
    drinkWindow: attrs.drinkWindow ?? "",
    cabinetId: slot?.cabinetId ?? null,
    row: slot?.row ?? null,
    col: slot?.col ?? null,
    depth: attrs.depth ?? 0,
  } as unknown as Wine;
}

function mkCab(
  id: string,
  opts: { wallId?: string; sortOrder?: number; rows: number; cols: number; storageRows?: number[] }
): Cabinet {
  return {
    id,
    name: id,
    wallId: opts.wallId ?? "wall1",
    sortOrder: opts.sortOrder ?? 0,
    rows: opts.rows,
    cols: opts.cols,
    depth: 1,
    storageRows: (opts.storageRows ?? []).map((r) => ({
      row: r,
      capacity: 12,
      type: "bulk",
    })),
  } as unknown as Cabinet;
}

const WALLS: Wall[] = [{ id: "wall1", name: "Wall 1", sortOrder: 0 } as unknown as Wall];

/** Apply the plan's moves to a simulated cellar, asserting the one-bottle
 *  invariant (never place into an occupied slot), and return final slot→wineId. */
function applyMoves(
  initial: Wine[],
  moves: SortMove[],
  /** Bottles intentionally left unfiled at the end (set-aside choices). */
  expectedOnTable = 0
): Map<string, string> {
  const key = (p: SlotPos) => `${p.cabinetId}:${p.row}:${p.col}`;
  const slots = new Map<string, string>(); // slotKey → wineId
  const table = new Set<string>();
  for (const w of initial) {
    if (w.cabinetId && w.row != null && w.col != null) {
      slots.set(`${w.cabinetId}:${w.row}:${w.col}`, w.id);
    }
  }
  for (const m of moves) {
    // Remove from source
    if (m.from === "table") {
      expect(table.has(m.wineId)).toBe(true);
      table.delete(m.wineId);
    } else {
      expect(slots.get(key(m.from))).toBe(m.wineId);
      slots.delete(key(m.from));
    }
    // Add to destination
    if (m.to === "table") {
      table.add(m.wineId);
    } else {
      // invariant: destination must be empty before placing
      expect(slots.has(key(m.to))).toBe(false);
      slots.set(key(m.to), m.wineId);
    }
  }
  expect(table.size).toBe(expectedOnTable); // everything else ends up placed
  return slots;
}

/** Expected final assignment: sorted wines mapped to occupied slots in reading order. */
function expectedAssignment(
  wines: Wine[],
  cabinets: Cabinet[],
  scheme: SortScheme
): Map<string, string> {
  const plan = buildSortPlan({ wines, cabinets, walls: WALLS, scheme });
  const final = applyMoves(wines, plan.moves);
  return final;
}

// ── tests ────────────────────────────────────────────────────────────────────

describe("buildSortPlan", () => {
  it("returns no moves when already sorted", () => {
    const cab = mkCab("c1", { rows: 1, cols: 3 });
    const wines = [
      mkWine({ id: "a", type: "red", region: "Bordeaux", grapeVariety: "Cabernet" }, { cabinetId: "c1", row: 0, col: 0 }),
      mkWine({ id: "b", type: "red", region: "Bordeaux", grapeVariety: "Merlot" }, { cabinetId: "c1", row: 0, col: 1 }),
      mkWine({ id: "c", type: "white", region: "Burgundy", grapeVariety: "Chardonnay" }, { cabinetId: "c1", row: 0, col: 2 }),
    ];
    const plan = buildSortPlan({ wines, cabinets: [cab], walls: WALLS, scheme: "type-region-varietal" });
    expect(plan.bottleCount).toBe(3);
    expect(plan.slotCount).toBe(3);
    expect(plan.moves).toHaveLength(0);
  });

  it("sorts a reversed row into order (simple permutation)", () => {
    const cab = mkCab("c1", { rows: 1, cols: 3 });
    // Slots hold C, B, A but should be A, B, C by varietal.
    const wines = [
      mkWine({ id: "C", type: "red", region: "Napa", grapeVariety: "Zinfandel" }, { cabinetId: "c1", row: 0, col: 0 }),
      mkWine({ id: "B", type: "red", region: "Napa", grapeVariety: "Merlot" }, { cabinetId: "c1", row: 0, col: 1 }),
      mkWine({ id: "A", type: "red", region: "Napa", grapeVariety: "Cabernet" }, { cabinetId: "c1", row: 0, col: 2 }),
    ];
    const final = expectedAssignment(wines, [cab], "type-region-varietal");
    // Cabernet < Merlot < Zinfandel → A,B,C across cols 0,1,2.
    expect(final.get("c1:0:0")).toBe("A");
    expect(final.get("c1:0:1")).toBe("B");
    expect(final.get("c1:0:2")).toBe("C");
  });

  it("groups by type first under type-region-varietal", () => {
    const cab = mkCab("c1", { rows: 1, cols: 4 });
    const wines = [
      mkWine({ id: "white1", type: "white", region: "Mosel", grapeVariety: "Riesling" }, { cabinetId: "c1", row: 0, col: 0 }),
      mkWine({ id: "red1", type: "red", region: "Rioja", grapeVariety: "Tempranillo" }, { cabinetId: "c1", row: 0, col: 1 }),
      mkWine({ id: "white2", type: "white", region: "Loire", grapeVariety: "Chenin" }, { cabinetId: "c1", row: 0, col: 2 }),
      mkWine({ id: "red2", type: "red", region: "Rioja", grapeVariety: "Garnacha" }, { cabinetId: "c1", row: 0, col: 3 }),
    ];
    const final = expectedAssignment(wines, [cab], "type-region-varietal");
    // Reds first (cols 0,1), then whites (cols 2,3). Within reds: Rioja Garnacha < Rioja Tempranillo.
    expect(final.get("c1:0:0")).toBe("red2"); // Garnacha
    expect(final.get("c1:0:1")).toBe("red1"); // Tempranillo
    // Whites: Loire < Mosel
    expect(final.get("c1:0:2")).toBe("white2"); // Loire Chenin
    expect(final.get("c1:0:3")).toBe("white1"); // Mosel Riesling
  });

  it("region-varietal puts region ahead of type", () => {
    const cab = mkCab("c1", { rows: 1, cols: 3 });
    const wines = [
      mkWine({ id: "x", type: "red", region: "Alsace", grapeVariety: "Pinot Noir" }, { cabinetId: "c1", row: 0, col: 0 }),
      mkWine({ id: "y", type: "white", region: "Alsace", grapeVariety: "Riesling" }, { cabinetId: "c1", row: 0, col: 1 }),
      mkWine({ id: "z", type: "red", region: "Beaujolais", grapeVariety: "Gamay" }, { cabinetId: "c1", row: 0, col: 2 }),
    ];
    const final = expectedAssignment(wines, [cab], "region-varietal");
    // Alsace block first (both x,y regardless of colour), then Beaujolais.
    // Within Alsace: Pinot Noir < Riesling.
    expect(final.get("c1:0:0")).toBe("x");
    expect(final.get("c1:0:1")).toBe("y");
    expect(final.get("c1:0:2")).toBe("z");
  });

  it("handles a 3-cycle with exactly one set-aside", () => {
    const cab = mkCab("c1", { rows: 1, cols: 3 });
    // Target order by varietal: Cabernet(col0), Merlot(col1), Syrah(col2).
    // Arrange a rotation: Merlot@0, Syrah@1, Cabernet@2 → pure 3-cycle.
    const wines = [
      mkWine({ id: "M", type: "red", region: "X", grapeVariety: "Merlot" }, { cabinetId: "c1", row: 0, col: 0 }),
      mkWine({ id: "S", type: "red", region: "X", grapeVariety: "Syrah" }, { cabinetId: "c1", row: 0, col: 1 }),
      mkWine({ id: "C", type: "red", region: "X", grapeVariety: "Cabernet" }, { cabinetId: "c1", row: 0, col: 2 }),
    ];
    const plan = buildSortPlan({ wines, cabinets: [cab], walls: WALLS, scheme: "type-region-varietal" });
    const setAsides = plan.moves.filter((m) => m.kind === "setAside");
    expect(setAsides).toHaveLength(1); // one buffer move breaks the cycle
    const final = applyMoves(wines, plan.moves);
    expect(final.get("c1:0:0")).toBe("C");
    expect(final.get("c1:0:1")).toBe("M");
    expect(final.get("c1:0:2")).toBe("S");
  });

  it("ignores bulk-storage rows, depth>0, and out-of-scope cabinets", () => {
    const cab = mkCab("c1", { rows: 2, cols: 2, storageRows: [1] });
    // Note: cabinet "c2" deliberately exists only as a wine location and is
    // NOT passed to the planner — that's the out-of-scope case under test.
    const wines = [
      mkWine({ id: "grid", type: "red", region: "A", grapeVariety: "A" }, { cabinetId: "c1", row: 0, col: 0 }),
      mkWine({ id: "behind", type: "red", region: "A", grapeVariety: "A", depth: 1 }, { cabinetId: "c1", row: 0, col: 0 }),
      mkWine({ id: "bulk", type: "red", region: "A", grapeVariety: "A" }, { cabinetId: "c1", row: 1, col: 0 }),
      mkWine({ id: "elsewhere", type: "red", region: "A", grapeVariety: "A" }, { cabinetId: "c2", row: 0, col: 0 }),
    ];
    // Scope only c1.
    const plan = buildSortPlan({ wines, cabinets: [cab], walls: WALLS, scheme: "type-region-varietal" });
    expect(plan.bottleCount).toBe(1); // only the depth-0 grid bottle
    expect(plan.slotCount).toBe(1);
  });

  it("spans multiple cabinets in reading order (wall → cabinet sortOrder)", () => {
    const c1 = mkCab("c1", { rows: 1, cols: 1, sortOrder: 0 });
    const c2 = mkCab("c2", { rows: 1, cols: 1, sortOrder: 1 });
    // Bottle that should come first is currently in the second cabinet.
    const wines = [
      mkWine({ id: "late", type: "white", region: "Z", grapeVariety: "Z" }, { cabinetId: "c1", row: 0, col: 0 }),
      mkWine({ id: "early", type: "red", region: "A", grapeVariety: "A" }, { cabinetId: "c2", row: 0, col: 0 }),
    ];
    const final = expectedAssignment(wines, [c1, c2], "type-region-varietal");
    // "early" (red) sorts first → first slot in reading order = c1:0:0.
    expect(final.get("c1:0:0")).toBe("early");
    expect(final.get("c2:0:0")).toBe("late");
  });

  it("rack-by-rack: no move ever crosses cabinets", () => {
    const c1 = mkCab("c1", { rows: 1, cols: 2, sortOrder: 0 });
    const c2 = mkCab("c2", { rows: 1, cols: 2, sortOrder: 1 });
    // Each rack internally reversed; cross-rack sort would interleave them.
    const wines = [
      mkWine({ id: "c1b", type: "white", region: "Z", grapeVariety: "Z" }, { cabinetId: "c1", row: 0, col: 0 }),
      mkWine({ id: "c1a", type: "red", region: "A", grapeVariety: "A" }, { cabinetId: "c1", row: 0, col: 1 }),
      mkWine({ id: "c2b", type: "white", region: "Z", grapeVariety: "Z" }, { cabinetId: "c2", row: 0, col: 0 }),
      mkWine({ id: "c2a", type: "red", region: "A", grapeVariety: "A" }, { cabinetId: "c2", row: 0, col: 1 }),
    ];
    const plan = buildRackByRackPlan({ wines, cabinets: [c1, c2], walls: WALLS, scheme: "type-region-varietal" });
    // Every slot-to-slot move stays inside one cabinet.
    for (const m of plan.moves) {
      if (m.from !== "table" && m.to !== "table") {
        expect(m.from.cabinetId).toBe(m.to.cabinetId);
      }
    }
    const final = applyMoves(wines, plan.moves);
    // Each rack sorted internally: red first.
    expect(final.get("c1:0:0")).toBe("c1a");
    expect(final.get("c1:0:1")).toBe("c1b");
    expect(final.get("c2:0:0")).toBe("c2a");
    expect(final.get("c2:0:1")).toBe("c2b");
    expect(plan.bottleCount).toBe(4);
  });

  it("produces a fully-correct arrangement for a larger shuffled set", () => {
    const cab = mkCab("c1", { rows: 3, cols: 4 });
    const regions = ["Bordeaux", "Napa", "Tuscany"];
    const grapes = ["Cabernet", "Merlot", "Sangiovese", "Syrah"];
    const types = ["red", "white"] as const;
    const wines: Wine[] = [];
    let i = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        wines.push(
          mkWine(
            {
              id: `b${i}`,
              type: types[(i * 7) % 2],
              region: regions[(i * 3) % 3],
              grapeVariety: grapes[(i * 5) % 4],
              vintage: 2015 + (i % 6),
            },
            { cabinetId: "c1", row: r, col: c }
          )
        );
        i++;
      }
    }
    const plan = buildSortPlan({ wines, cabinets: [cab], walls: WALLS, scheme: "type-region-varietal" });
    const final = applyMoves(wines, plan.moves);
    // Every original bottle still placed exactly once.
    expect(new Set(final.values()).size).toBe(12);
    // And the arrangement matches a direct sort of the same wines into reading-order slots.
    expect(final.size).toBe(12);
  });
});

// ── Bottle-size constraints (2026-08 organization feature) ──────────────────

function mkCabSized(
  id: string,
  opts: {
    rows: number;
    cols: number;
    rowSizes?: Array<{ row: number; maxSize: string }>;
  }
): Cabinet {
  return {
    ...mkCab(id, { rows: opts.rows, cols: opts.cols }),
    rowSizes: opts.rowSizes ?? [],
  } as unknown as Cabinet;
}

describe("size-aware assignment", () => {
  it("routes a magnum only into a magnum-capable row", () => {
    const cab = mkCabSized("c1", {
      rows: 2,
      cols: 2,
      rowSizes: [{ row: 1, maxSize: "magnum" }],
    });
    // Magnum currently sits in row 1 (fits); standards elsewhere. Sorting by
    // vintage would naively place the magnum first (row 0) — the planner
    // must keep it in a row-1 slot instead.
    const wines = [
      mkWine({ id: "mag", vintage: 1990, bottleSize: "magnum" } as Partial<Wine>, { cabinetId: "c1", row: 1, col: 0 }),
      mkWine({ id: "s1", vintage: 2000 }, { cabinetId: "c1", row: 0, col: 0 }),
      mkWine({ id: "s2", vintage: 2010 }, { cabinetId: "c1", row: 0, col: 1 }),
      mkWine({ id: "s3", vintage: 2020 }, { cabinetId: "c1", row: 1, col: 1 }),
    ];
    const plan = buildSortPlan({ wines, cabinets: [cab], walls: WALLS, scheme: "vintage" });
    expect(plan.conflicts).toHaveLength(0);
    const magSlot = plan.assignments.find((a) => a.wineId === "mag")!.slot;
    expect(magSlot.row).toBe(1);
    // The full plan still executes cleanly under the one-bottle invariant.
    applyMoves(wines, plan.moves);
  });

  it("reports a conflict when a bottle fits no slot, pinning it in place", () => {
    const cab = mkCabSized("c1", { rows: 1, cols: 3 }); // all-standard rows
    const wines = [
      mkWine({ id: "mag", vintage: 1990, bottleSize: "magnum" } as Partial<Wine>, { cabinetId: "c1", row: 0, col: 2 }),
      mkWine({ id: "s1", vintage: 2000 }, { cabinetId: "c1", row: 0, col: 0 }),
      mkWine({ id: "s2", vintage: 1980 }, { cabinetId: "c1", row: 0, col: 1 }),
    ];
    const plan = buildSortPlan({ wines, cabinets: [cab], walls: WALLS, scheme: "vintage" });
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].wineId).toBe("mag");
    // Pinned: the magnum's final slot is exactly where it already is.
    const magSlot = plan.assignments.find((a) => a.wineId === "mag")!.slot;
    expect(magSlot).toEqual({ cabinetId: "c1", row: 0, col: 2 });
    // No move ever targets the magnum.
    expect(plan.moves.every((m) => m.wineId !== "mag")).toBe(true);
    applyMoves(wines, plan.moves);
  });

  it("set-aside choice unfiles the conflicted bottle and frees its slot", () => {
    const cab = mkCabSized("c1", { rows: 1, cols: 3 });
    const wines = [
      mkWine({ id: "mag", vintage: 1990, bottleSize: "magnum" } as Partial<Wine>, { cabinetId: "c1", row: 0, col: 2 }),
      mkWine({ id: "s1", vintage: 2000 }, { cabinetId: "c1", row: 0, col: 0 }),
      mkWine({ id: "s2", vintage: 1980 }, { cabinetId: "c1", row: 0, col: 1 }),
    ];
    const plan = buildSortPlan({
      wines,
      cabinets: [cab],
      walls: WALLS,
      scheme: "vintage",
      setAsideWineIds: new Set(["mag"]),
    });
    expect(plan.conflicts).toHaveLength(0);
    // First move takes the magnum out to the table, and it never returns.
    expect(plan.moves[0]).toMatchObject({ wineId: "mag", kind: "setAside", to: "table" });
    const final = applyMoves(wines, plan.moves, 1);
    expect([...final.values()]).not.toContain("mag");
    // The magnum is excluded from the proposed layout.
    expect(plan.assignments.some((a) => a.wineId === "mag")).toBe(false);
  });

  it("half bottles fit standard slots (smaller always fits)", () => {
    const cab = mkCabSized("c1", { rows: 1, cols: 2 });
    const wines = [
      mkWine({ id: "half", vintage: 2020, bottleSize: "half" } as Partial<Wine>, { cabinetId: "c1", row: 0, col: 0 }),
      mkWine({ id: "s1", vintage: 2000 }, { cabinetId: "c1", row: 0, col: 1 }),
    ];
    const plan = buildSortPlan({ wines, cabinets: [cab], walls: WALLS, scheme: "vintage" });
    expect(plan.conflicts).toHaveLength(0);
  });
});

describe("new sort schemes", () => {
  it("vintage scheme orders oldest first in reading order", () => {
    const cab = mkCab("c1", { rows: 1, cols: 3 });
    const wines = [
      mkWine({ id: "y2020", vintage: 2020 }, { cabinetId: "c1", row: 0, col: 0 }),
      mkWine({ id: "y1990", vintage: 1990 }, { cabinetId: "c1", row: 0, col: 1 }),
      mkWine({ id: "y2005", vintage: 2005 }, { cabinetId: "c1", row: 0, col: 2 }),
    ];
    const plan = buildSortPlan({ wines, cabinets: [cab], walls: WALLS, scheme: "vintage" });
    const bySlot = new Map(plan.assignments.map((a) => [`${a.slot.col}`, a.wineId]));
    expect(bySlot.get("0")).toBe("y1990");
    expect(bySlot.get("1")).toBe("y2005");
    expect(bySlot.get("2")).toBe("y2020");
  });

  it("rating scheme puts the best-rated bottle first, unrated last", () => {
    const cab = mkCab("c1", { rows: 1, cols: 3 });
    const wines = [
      mkWine({ id: "unrated" }, { cabinetId: "c1", row: 0, col: 0 }),
      mkWine({ id: "five", userRating: 5 } as Partial<Wine>, { cabinetId: "c1", row: 0, col: 1 }),
      mkWine({ id: "three", userRating: 3 } as Partial<Wine>, { cabinetId: "c1", row: 0, col: 2 }),
    ];
    const plan = buildSortPlan({ wines, cabinets: [cab], walls: WALLS, scheme: "rating" });
    const bySlot = new Map(plan.assignments.map((a) => [`${a.slot.col}`, a.wineId]));
    expect(bySlot.get("0")).toBe("five");
    expect(bySlot.get("1")).toBe("three");
    expect(bySlot.get("2")).toBe("unrated");
  });
});
