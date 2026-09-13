import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Pins the client-side collection mutation protocol in wine-collection.ts —
 * the one home for how create/edit/consume/duplicate sync the UI copies of
 * the wine list. The cellar, inventory, and stats hooks each used to keep
 * their own copies of these handlers, and the copies drifted.
 */

const editWineSpy = vi.fn();
const deleteWineSpy = vi.fn();
const createWineSpy = vi.fn();
const bulkCreateWinesSpy = vi.fn();
vi.mock("@/lib/data", () => ({
  editWine: (...args: unknown[]) => editWineSpy(...args),
  deleteWine: (...args: unknown[]) => deleteWineSpy(...args),
  createWine: (...args: unknown[]) => createWineSpy(...args),
  bulkCreateWines: (...args: unknown[]) => bulkCreateWinesSpy(...args),
}));

const successSpy = vi.fn();
const errorSpy = vi.fn();
vi.mock("@/components/ui/custom-toast", () => ({
  toast: {
    success: (...args: unknown[]) => successSpy(...args),
    error: (...args: unknown[]) => errorSpy(...args),
  },
}));

import {
  addWineAndPrepend,
  buildDuplicateWineInput,
  consumeWineAndSync,
  duplicateWinesAndPrepend,
  editWineAndSync,
  editWinesInBatches,
} from "@/lib/wine-collection";
import type { Wine } from "@/types/wine";

function makeWine(partial: Partial<Wine> = {}): Wine {
  return {
    id: "w1",
    userId: "u1",
    cabinetId: "c1",
    barcode: "",
    name: "Test Wine",
    winery: "Test Winery",
    region: "",
    country: "",
    vintage: 2020,
    type: "red",
    sparkling: false,
    grapeVariety: "",
    userRating: null,
    imageUrl: "",
    price: null,
    retailPrice: null,
    purchaseDate: "",
    drinkBy: "",
    notes: "",
    description: "",
    foodPairings: "",
    alcohol: "",
    row: 1,
    col: 2,
    depth: 0,
    zone: "",
    tastingNotes: null,
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    tags: [],
    addedAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

/** Stand-in for a useState pair so the sync helpers can be tested bare. */
function captureState<T>(initial: T) {
  let value = initial;
  const set = (updater: T | ((prev: T) => T)) => {
    value =
      typeof updater === "function" ? (updater as (p: T) => T)(value) : updater;
  };
  return { set, get: () => value };
}

function wineTargets(overrides: Partial<Parameters<typeof editWineAndSync>[2]> = {}) {
  const wines = captureState<Wine[]>([]);
  const selectedWine = captureState<Wine | null>(null);
  return {
    targets: {
      userId: "u1",
      setWines: wines.set,
      setSelectedWine: selectedWine.set,
      ...overrides,
    },
    wines,
    selectedWine,
  };
}

beforeEach(() => {
  editWineSpy.mockReset();
  deleteWineSpy.mockReset();
  createWineSpy.mockReset();
  bulkCreateWinesSpy.mockReset();
  successSpy.mockClear();
  errorSpy.mockClear();
});

describe("editWineAndSync", () => {
  it("passes the edit to the data layer and mirrors the returned row into wines and the selected wine", async () => {
    const updated = makeWine({ name: "Renamed" });
    editWineSpy.mockResolvedValue(updated);
    const { targets, wines, selectedWine } = wineTargets();
    wines.set([makeWine(), makeWine({ id: "w2" })]);
    selectedWine.set(makeWine());

    const result = await editWineAndSync("w1", { name: "Renamed" }, targets);

    expect(editWineSpy).toHaveBeenCalledWith("w1", { name: "Renamed" }, "u1");
    expect(result).toEqual(updated);
    expect(wines.get()).toEqual([
      updated,
      makeWine({ id: "w2" }),
    ]);
    expect(selectedWine.get()).toEqual(updated);
  });

  it("leaves every state copy alone when the server reports no change", async () => {
    editWineSpy.mockResolvedValue(null);
    const { targets, wines, selectedWine } = wineTargets();
    wines.set([makeWine()]);
    selectedWine.set(makeWine());

    const result = await editWineAndSync("w1", { name: "x" }, targets);

    expect(result).toBeNull();
    expect(wines.get()).toEqual([makeWine()]);
    expect(selectedWine.get()).toEqual(makeWine());
  });

  it("works without a selected-wine setter", async () => {
    const updated = makeWine({ name: "Renamed" });
    editWineSpy.mockResolvedValue(updated);
    const { targets, wines } = wineTargets({
      setSelectedWine: undefined,
    });
    wines.set([makeWine()]);

    await editWineAndSync("w1", { name: "Renamed" }, targets);

    expect(wines.get()).toEqual([updated]);
  });
});

describe("consumeWineAndSync", () => {
  it("removes the wine, closes the detail dialog, and toasts success", async () => {
    deleteWineSpy.mockResolvedValue(undefined);
    const { targets, wines, selectedWine } = wineTargets();
    wines.set([makeWine(), makeWine({ id: "w2" })]);
    selectedWine.set(makeWine());
    let detailOpen = true;
    const setDetailOpen = (open: boolean) => {
      detailOpen = open;
    };

    await consumeWineAndSync("w1", "drunk", 4, "tasty", {
      ...targets,
      setDetailOpen,
    });

    expect(deleteWineSpy).toHaveBeenCalledWith("w1", "drunk", 4, "tasty", "u1");
    expect(wines.get()).toEqual([makeWine({ id: "w2" })]);
    expect(selectedWine.get()).toBeNull();
    expect(detailOpen).toBe(false);
    expect(successSpy).toHaveBeenCalledWith("Wine moved to history");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("toasts the error message and changes nothing when the delete fails", async () => {
    deleteWineSpy.mockRejectedValue(new Error("still listed"));
    const { targets, wines } = wineTargets();
    wines.set([makeWine()]);
    const setDetailOpen = vi.fn();

    await consumeWineAndSync("w1", "lost", null, undefined, {
      ...targets,
      setDetailOpen,
    });

    expect(errorSpy).toHaveBeenCalledWith("still listed");
    expect(successSpy).not.toHaveBeenCalled();
    expect(wines.get()).toEqual([makeWine()]);
    expect(setDetailOpen).not.toHaveBeenCalled();
  });
});

describe("addWineAndPrepend", () => {
  it("creates the wine and puts it at the top of the collection", async () => {
    const created = makeWine({ id: "new", name: "New Bottle" });
    createWineSpy.mockResolvedValue(created);
    const { targets, wines } = wineTargets();
    wines.set([makeWine()]);

    const result = await addWineAndPrepend(
      { name: "New Bottle" } as never,
      targets
    );

    expect(createWineSpy).toHaveBeenCalled();
    expect(result).toEqual(created);
    expect(wines.get()).toEqual([created, makeWine()]);
  });
});

describe("buildDuplicateWineInput", () => {
  it("strips identity fields and skips the duplicate check", () => {
    const input = buildDuplicateWineInput(makeWine(), { unfile: false });

    expect(input).not.toHaveProperty("id");
    expect(input).not.toHaveProperty("addedAt");
    expect(input).not.toHaveProperty("updatedAt");
    expect(input).not.toHaveProperty("userId");
    expect(input.skipDuplicateCheck).toBe(true);
    expect(input.name).toBe("Test Wine");
  });

  it("keeps the slot placement for Add Bottle", () => {
    const input = buildDuplicateWineInput(makeWine(), { unfile: false });

    expect(input.cabinetId).toBe("c1");
    expect(input.row).toBe(1);
    expect(input.col).toBe(2);
  });

  it("clears the slot placement for the Duplicate flow (unfiled pile)", () => {
    const input = buildDuplicateWineInput(makeWine(), { unfile: true });

    expect(input.cabinetId).toBeNull();
    expect(input.row).toBeNull();
    expect(input.col).toBeNull();
    expect(input.depth).toBe(0);
    expect(input.zone).toBe("");
    expect(input.skipDuplicateCheck).toBe(true);
  });
});

describe("duplicateWinesAndPrepend", () => {
  it("issues ONE batched call for N copies and prepends the created bottles", async () => {
    const created = [makeWine({ id: "d1" }), makeWine({ id: "d2" })];
    bulkCreateWinesSpy.mockResolvedValue(created);
    const { targets, wines } = wineTargets();
    wines.set([makeWine({ id: "old" })]);

    const result = await duplicateWinesAndPrepend(makeWine(), 2, targets);

    expect(bulkCreateWinesSpy).toHaveBeenCalledTimes(1);
    const [payloads, uid] = bulkCreateWinesSpy.mock.calls[0];
    expect(uid).toBe("u1");
    expect(payloads).toHaveLength(2);
    for (const p of payloads) {
      expect(p.cabinetId).toBeNull();
      expect(p.skipDuplicateCheck).toBe(true);
    }
    expect(result).toEqual(created);
    expect(wines.get()).toEqual([...created, makeWine({ id: "old" })]);
  });

  it("clamps the count to 1–99 and whole bottles", async () => {
    bulkCreateWinesSpy.mockResolvedValue([]);
    const { targets } = wineTargets();

    await duplicateWinesAndPrepend(makeWine(), 0, targets);
    expect(bulkCreateWinesSpy.mock.calls[0][0]).toHaveLength(1);

    await duplicateWinesAndPrepend(makeWine(), 2.7, targets);
    expect(bulkCreateWinesSpy.mock.calls[1][0]).toHaveLength(2);

    await duplicateWinesAndPrepend(makeWine(), 150, targets);
    expect(bulkCreateWinesSpy.mock.calls[2][0]).toHaveLength(99);
  });
});

describe("editWinesInBatches", () => {
  it("edits every wine and runs at most five server calls concurrently", async () => {
    editWineSpy.mockResolvedValue(makeWine());
    const ids = Array.from({ length: 12 }, (_, i) => `w${i}`);
    let inFlight = 0;
    let maxInFlight = 0;
    editWineSpy.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      return makeWine();
    });

    await editWinesInBatches(ids, () => ({ notes: "batched" }), "u1");

    expect(editWineSpy).toHaveBeenCalledTimes(12);
    expect(maxInFlight).toBeLessThanOrEqual(5);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("skips wines whose mapper returns null", async () => {
    editWineSpy.mockResolvedValue(makeWine());

    await editWinesInBatches(
      ["w1", "w2", "w3"],
      (id) => (id === "w2" ? null : { notes: "batched" }),
      "u1"
    );

    expect(editWineSpy).toHaveBeenCalledTimes(2);
    expect(editWineSpy.mock.calls.map((c) => c[0])).toEqual(["w1", "w3"]);
  });
});
