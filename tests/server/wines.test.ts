import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.DATABASE_URL = "postgresql://stub";

const wineFindMany = vi.fn();
const wineFindFirst = vi.fn();
const wineCreate = vi.fn();
const wineUpdate = vi.fn();
const wineUpdateMany = vi.fn();
const wineDelete = vi.fn();
const wineDeleteMany = vi.fn();
const historyCreate = vi.fn();
const historyCreateMany = vi.fn();
const historyFindMany = vi.fn();
const historyFindFirst = vi.fn();
const historyUpdate = vi.fn();
const historyDeleteMany = vi.fn();
const historyDelete = vi.fn();
const txSpy = vi.fn();

const wineCount = vi.fn();
const cabinetFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    wine: {
      findMany: wineFindMany,
      findFirst: wineFindFirst,
      create: wineCreate,
      update: wineUpdate,
      updateMany: wineUpdateMany,
      delete: wineDelete,
      deleteMany: wineDeleteMany,
      count: wineCount,
    },
    cabinet: {
      findFirst: cabinetFindFirst,
    },
    wineHistory: {
      create: historyCreate,
      createMany: historyCreateMany,
      findMany: historyFindMany,
      findFirst: historyFindFirst,
      update: historyUpdate,
      delete: historyDelete,
      deleteMany: historyDeleteMany,
    },
    $transaction: txSpy,
  },
}));

const resolveServerUserId = vi.fn();
vi.mock("@/server/auth-guard", () => ({
  resolveServerUserId: (id?: string | null) => resolveServerUserId(id),
  getAuthenticatedUserId: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/demo", () => ({
  assertNotDemo: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/audit-log", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/actions/community", () => ({
  getCommunityScoresBatch: vi.fn().mockResolvedValue(new Map()),
}));

// Baseline seeding moved out of the "use server" file (unauthenticated-write
// fix) — wines.ts now imports it from the internal store module.
vi.mock("@/server/community-baseline-store", () => ({
  seedCommunityBaseline: vi.fn().mockResolvedValue(undefined),
  canonKey: (name: string, winery: string, vintage: number | null) => ({
    name: (name || "").trim().toLowerCase(),
    winery: (winery || "").trim().toLowerCase(),
    vintage: vintage ?? null,
  }),
}));

// Expert Score population hooks in addWine: metadata-cache lookup + the
// after()-scheduled background AI fetch. after() runs its callback inline
// here so tests can assert the fetch was (or wasn't) scheduled.
const findWineMetadata = vi.fn();
vi.mock("@/server/actions/wine-metadata", () => ({
  findWineMetadata: (...args: unknown[]) => findWineMetadata(...args),
  saveWineMetadata: vi.fn().mockResolvedValue(undefined),
}));
const fetchAndStoreExpertRatings = vi.fn();
vi.mock("@/server/expert-score", () => ({
  fetchAndStoreExpertRatings: (...args: unknown[]) =>
    fetchAndStoreExpertRatings(...args),
}));
vi.mock("next/server", () => ({
  after: (cb: () => unknown) => { void cb(); },
}));

vi.mock("@/generated/prisma/client", () => ({
  Prisma: { JsonNull: null, DbNull: null },
}));

function fakeWineRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "w1",
    userId: "u1",
    cabinetId: null,
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
    row: null,
    col: null,
    depth: 0,
    zone: "",
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    tastingNotes: null,
    tags: [],
    addedAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    aiEnrichedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveServerUserId.mockImplementation(async (id?: string | null) => {
    if (!id) throw new Error("Unauthorized");
    return id;
  });
  txSpy.mockImplementation((arg) =>
    typeof arg === "function" ? Promise.resolve(arg({})) : Promise.resolve(arg)
  );
  wineCount.mockResolvedValue(0);
  // Default: no existing duplicate (addWine now runs the dup check on name
  // alone, so it queries wineFindFirst even for winery-less wines), and a
  // roomy owned cabinet so slot-bounds checks pass unless a test overrides.
  wineFindFirst.mockResolvedValue(null);
  cabinetFindFirst.mockResolvedValue({ id: "cab", userId: "u1", rows: 100, cols: 100, depth: 10 });
  findWineMetadata.mockResolvedValue(null);
  fetchAndStoreExpertRatings.mockResolvedValue(undefined);
});

describe("getWines", () => {
  it("scopes findMany to the resolved userId", async () => {
    wineFindMany.mockResolvedValue([fakeWineRow()]);
    const { getWines } = await import("@/server/actions/wines");
    await getWines("u1");
    expect(resolveServerUserId).toHaveBeenCalledWith("u1");
    expect(wineFindMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: { addedAt: "desc" },
    });
  });

  it("returns empty array when no wines exist", async () => {
    wineFindMany.mockResolvedValue([]);
    const { getWines } = await import("@/server/actions/wines");
    expect(await getWines("u1")).toEqual([]);
  });

  it("throws Unauthorized when no userId can be resolved", async () => {
    const { getWines } = await import("@/server/actions/wines");
    await expect(getWines()).rejects.toThrow("Unauthorized");
    expect(wineFindMany).not.toHaveBeenCalled();
  });
});

describe("getWine", () => {
  it("returns null when no row matches owner+id (IDOR protection)", async () => {
    wineFindFirst.mockResolvedValue(null);
    const { getWine } = await import("@/server/actions/wines");
    expect(await getWine("u1", "other-users-wine")).toBeNull();
    expect(wineFindFirst).toHaveBeenCalledWith({
      where: { id: "other-users-wine", userId: "u1" },
    });
  });

  it("returns the wine when ownership matches", async () => {
    wineFindFirst.mockResolvedValue(fakeWineRow({ id: "w1" }));
    const { getWine } = await import("@/server/actions/wines");
    const result = await getWine("u1", "w1");
    expect(result?.id).toBe("w1");
  });
});

describe("getWinesByCabinet", () => {
  it("filters by both userId and cabinetId", async () => {
    wineFindMany.mockResolvedValue([]);
    const { getWinesByCabinet } = await import("@/server/actions/wines");
    await getWinesByCabinet("u1", "cab1");
    expect(wineFindMany).toHaveBeenCalledWith({
      where: { userId: "u1", cabinetId: "cab1" },
      orderBy: { addedAt: "desc" },
    });
  });
});

describe("addWine", () => {
  it("creates a wine with the resolved userId, not the caller-supplied one", async () => {
    resolveServerUserId.mockResolvedValueOnce("verified-user");
    wineCreate.mockResolvedValue(fakeWineRow({ userId: "verified-user" }));
    const { addWine } = await import("@/server/actions/wines");
    await addWine({ userId: "client-claimed", name: "Bordeaux" });
    expect(wineCreate).toHaveBeenCalledOnce();
    const call = wineCreate.mock.calls[0][0];
    expect(call.data.userId).toBe("verified-user");
    expect(call.data.name).toBe("Bordeaux");
  });

  it("defaults type to lowercase 'red' when not provided", async () => {
    wineCreate.mockResolvedValue(fakeWineRow());
    const { addWine } = await import("@/server/actions/wines");
    await addWine({ userId: "u1", name: "X" });
    expect(wineCreate.mock.calls[0][0].data.type).toBe("red");
  });

  it("lowercases provided type and infers sparkling case-insensitively", async () => {
    wineCreate.mockResolvedValue(fakeWineRow({ type: "sparkling", sparkling: true }));
    const { addWine } = await import("@/server/actions/wines");
    // Regression: previously `input.type === "sparkling"` was case-sensitive,
    // so "Sparkling" → type:"sparkling" but sparkling:false (inconsistent).
    // Fix derives sparkling from the lowercased type so any case works.
    await addWine({ userId: "u1", name: "Champagne", type: "Sparkling" });
    const data = wineCreate.mock.calls[0][0].data;
    expect(data.type).toBe("sparkling");
    expect(data.sparkling).toBe(true);
  });

  it("infers sparkling=true when type is exactly lowercase 'sparkling'", async () => {
    wineCreate.mockResolvedValue(fakeWineRow({ type: "sparkling", sparkling: true }));
    const { addWine } = await import("@/server/actions/wines");
    await addWine({ userId: "u1", name: "Champagne", type: "sparkling" });
    expect(wineCreate.mock.calls[0][0].data.sparkling).toBe(true);
  });

  it("fills aiRatings from the WineMetadata cache when the caller has none", async () => {
    findWineMetadata.mockResolvedValue({ ratings: { rating_ws: 94 } });
    wineCreate.mockResolvedValue(fakeWineRow({ aiRatings: { rating_ws: 94 } }));
    const { addWine } = await import("@/server/actions/wines");
    await addWine({ userId: "u1", name: "Cached Wine", winery: "Known Winery" });
    expect(findWineMetadata).toHaveBeenCalledWith("Known Winery", "Cached Wine", null);
    expect(wineCreate.mock.calls[0][0].data.aiRatings).toEqual({ rating_ws: 94 });
    // Cache hit — no background AI fetch needed
    expect(fetchAndStoreExpertRatings).not.toHaveBeenCalled();
  });

  it("schedules a background expert-ratings fetch on cache miss", async () => {
    findWineMetadata.mockResolvedValue(null);
    wineCreate.mockResolvedValue(
      fakeWineRow({ id: "w9", name: "New Wine", winery: "New Winery" })
    );
    const { addWine } = await import("@/server/actions/wines");
    await addWine({ userId: "u1", name: "New Wine", winery: "New Winery" });
    expect(fetchAndStoreExpertRatings).toHaveBeenCalledOnce();
    expect(fetchAndStoreExpertRatings.mock.calls[0][0]).toMatchObject({
      wineId: "w9",
      userId: "u1",
      name: "New Wine",
      winery: "New Winery",
    });
  });

  it("skips both cache lookup and AI fetch when the caller provides aiRatings", async () => {
    wineCreate.mockResolvedValue(fakeWineRow({ aiRatings: { rating_rp: 91 } }));
    const { addWine } = await import("@/server/actions/wines");
    await addWine({
      userId: "u1",
      name: "Scanned Wine",
      winery: "Scan Winery",
      aiRatings: { rating_rp: 91 },
    });
    expect(findWineMetadata).not.toHaveBeenCalled();
    expect(fetchAndStoreExpertRatings).not.toHaveBeenCalled();
  });
});

describe("updateWine", () => {
  it("ownership-checks BEFORE mutating", async () => {
    wineFindFirst.mockResolvedValue(null);
    const { updateWine } = await import("@/server/actions/wines");
    await expect(updateWine("u1", "w1", { name: "x" })).rejects.toThrow("Unauthorized");
    expect(wineUpdate).not.toHaveBeenCalled();
  });

  it("only forwards explicitly provided fields to update", async () => {
    wineFindFirst.mockResolvedValue(fakeWineRow());
    wineUpdate.mockResolvedValue(fakeWineRow({ name: "New Name" }));
    const { updateWine } = await import("@/server/actions/wines");
    await updateWine("u1", "w1", { name: "New Name" });
    const data = wineUpdate.mock.calls[0][0].data;
    expect(data).toEqual({ name: "New Name" });
    expect("winery" in data).toBe(false);
  });

  it("propagates shared fields to duplicate wines (same name+winery+vintage)", async () => {
    wineFindFirst.mockResolvedValue(fakeWineRow({
      name: "Bordeaux 2019",
      winery: "Chateau X",
      vintage: 2019,
    }));
    wineUpdate.mockResolvedValue(fakeWineRow());
    wineUpdateMany.mockResolvedValue({ count: 0 });
    const { updateWine } = await import("@/server/actions/wines");
    await updateWine("u1", "w1", { userRating: 5 });
    // updateMany should have been called for duplicates
    await new Promise((r) => setTimeout(r, 10));
    expect(wineUpdateMany).toHaveBeenCalled();
    const call = wineUpdateMany.mock.calls[0][0];
    expect(call.where.userId).toBe("u1");
    expect(call.where.id).toEqual({ not: "w1" });
    expect(call.data.userRating).toBe(5);
  });
});

describe("moveWine", () => {
  it("rejects when the wine doesn't belong to the user", async () => {
    wineFindFirst.mockResolvedValue(null);
    const { moveWine } = await import("@/server/actions/wines");
    await expect(moveWine("u1", "w1", "cab1", 0, 0)).rejects.toThrow("Unauthorized");
  });

  it("updates only the requested location fields on success", async () => {
    wineFindFirst.mockResolvedValue(fakeWineRow());
    wineUpdate.mockResolvedValue(fakeWineRow());
    const { moveWine } = await import("@/server/actions/wines");
    await moveWine("u1", "w1", "cab2", 3, 4, 1, "top");
    expect(wineUpdate).toHaveBeenCalledWith({
      where: { id: "w1" },
      data: { cabinetId: "cab2", row: 3, col: 4, depth: 1, zone: "top" },
    });
  });
});

describe("removeWine", () => {
  it("returns success:false when wine not found", async () => {
    wineFindFirst.mockResolvedValue(null);
    const { removeWine } = await import("@/server/actions/wines");
    const result = await removeWine("u1", "w1");
    expect(result).toEqual({ success: false, error: "Wine not found" });
    expect(txSpy).not.toHaveBeenCalled();
  });

  it("creates history entry then deletes wine in a transaction", async () => {
    wineFindFirst.mockResolvedValue(fakeWineRow({ id: "w1", name: "X" }));
    const { removeWine } = await import("@/server/actions/wines");
    const result = await removeWine("u1", "w1", "drank");
    expect(result).toEqual({ success: true });
    expect(txSpy).toHaveBeenCalledOnce();
  });
});

describe("bulkRemoveWines", () => {
  it("returns 0 immediately when given an empty list", async () => {
    const { bulkRemoveWines } = await import("@/server/actions/wines");
    expect(await bulkRemoveWines("u1", [])).toBe(0);
    expect(wineFindMany).not.toHaveBeenCalled();
  });

  it("only acts on wines owned by the resolved user", async () => {
    wineFindMany.mockResolvedValue([fakeWineRow({ id: "w1" })]);
    const { bulkRemoveWines } = await import("@/server/actions/wines");
    const count = await bulkRemoveWines("u1", ["w1", "w2-not-mine"]);
    expect(wineFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["w1", "w2-not-mine"] }, userId: "u1" },
    });
    expect(count).toBe(1);
  });
});

describe("history queries", () => {
  it("getHistory scopes to the resolved userId", async () => {
    historyFindMany.mockResolvedValue([]);
    const { getHistory } = await import("@/server/actions/wines");
    await getHistory("u1");
    expect(historyFindMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: { removedAt: "desc" },
    });
  });

  it("deleteHistoryItem uses deleteMany scoped by userId (no IDOR)", async () => {
    historyDeleteMany.mockResolvedValue({ count: 1 });
    const { deleteHistoryItem } = await import("@/server/actions/wines");
    await deleteHistoryItem("u1", "h1");
    expect(historyDeleteMany).toHaveBeenCalledWith({
      where: { id: "h1", userId: "u1" },
    });
  });

  it("updateHistoryItem ownership-checks before update", async () => {
    historyFindFirst.mockResolvedValue(null);
    const { updateHistoryItem } = await import("@/server/actions/wines");
    const r = await updateHistoryItem("u1", "h1", { notes: "x" } as never);
    expect(r).toEqual({ success: false, error: "History record not found" });
    expect(historyUpdate).not.toHaveBeenCalled();
  });
});

describe("importWines", () => {
  it("inserts in one transaction, unfiled, with text limits and no AI side effects", async () => {
    const createManyAndReturn = vi.fn().mockImplementation(async ({ data }: { data: unknown[] }) =>
      data.map((_, i) => fakeWineRow({ id: `imp${i}` }))
    );
    txSpy.mockImplementationOnce((fn: (tx: unknown) => unknown) => fn({ wine: { createManyAndReturn } }));
    const { importWines } = await import("@/server/actions/wines");
    const created = await importWines("u1", [
      { name: "A", notes: "x".repeat(30_000), cabinetId: "c9", row: 3, col: 2 },
      { name: "B" },
    ] as never);
    expect(created).toHaveLength(2);
    const rows = createManyAndReturn.mock.calls[0][0].data;
    expect(rows[0]).toMatchObject({ userId: "u1", cabinetId: null, row: null, col: null });
    expect(rows[0].notes).toHaveLength(20_000);
    expect(fetchAndStoreExpertRatings).not.toHaveBeenCalled();
  });

  it("rejects callers without a session", async () => {
    const { importWines } = await import("@/server/actions/wines");
    await expect(importWines(undefined, [{ name: "A" }] as never)).rejects.toThrow("Unauthorized");
  });
});

describe("wine images in list responses", () => {
  const JPEG = "data:image/jpeg;base64," + Buffer.from("label").toString("base64");

  it("getWines references stored images by URL; backups still get the data", async () => {
    wineFindMany.mockResolvedValue([
      fakeWineRow({ id: "w1", imageUrl: JPEG }),
      fakeWineRow({ id: "w2", imageUrl: "https://img.example/x.jpg" }),
    ]);
    const { getWines } = await import("@/server/actions/wines");
    const list = await getWines("u1");
    expect(list[0].imageUrl).toMatch(/^\/api\/wine-image\/w1\?v=/);
    expect(list[1].imageUrl).toBe("https://img.example/x.jpg");
    const full = await getWines("u1", { fullImages: true });
    expect(full[0].imageUrl).toBe(JPEG);
  });

  it("updateWine treats the wine's own image URL as unchanged", async () => {
    wineFindFirst.mockResolvedValue(fakeWineRow({ id: "w1", imageUrl: JPEG }));
    wineUpdate.mockResolvedValue(fakeWineRow({ id: "w1", imageUrl: JPEG, name: "Renamed" }));
    const { updateWine } = await import("@/server/actions/wines");
    await updateWine("u1", "w1", { name: "Renamed", imageUrl: "/api/wine-image/w1?v=abc" } as never);
    const { data } = wineUpdate.mock.calls[0][0];
    expect(data).not.toHaveProperty("imageUrl");
    expect(data.name).toBe("Renamed");
  });
});

describe("restoreWineFromHistory", () => {
  function fakeHistoryRow() {
    return {
      id: "h1",
      userId: "u1",
      wineId: "w-old",
      name: "Restored Wine",
      winery: "Winery",
      region: "",
      country: "",
      vintage: 2019,
      type: "red",
      sparkling: false,
      grapeVariety: "",
      imageUrl: "",
      price: 25,
      retailPrice: null,
      description: "",
      foodPairings: "",
      alcohol: "",
      disposition: "",
      drinkWindow: "",
      aiRatings: null,
      consumeRating: null,
      consumeNotes: "",
      reason: "other",
      consumedAt: new Date("2026-01-01"),
    };
  }

  it("creates the wine and deletes the history entry inside one transaction", async () => {
    const txWineCreate = vi.fn().mockResolvedValue(fakeWineRow({ id: "w-new", name: "Restored Wine" }));
    const txHistoryDelete = vi.fn().mockResolvedValue({});
    txSpy.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({ wine: { create: txWineCreate }, wineHistory: { delete: txHistoryDelete } })
    );
    historyFindFirst.mockResolvedValue(fakeHistoryRow());

    const { restoreWineFromHistory } = await import("@/server/actions/wines");
    const restored = await restoreWineFromHistory("u1", "h1");

    expect(txSpy).toHaveBeenCalledOnce();
    expect(txWineCreate).toHaveBeenCalledOnce();
    expect(txHistoryDelete).toHaveBeenCalledWith({ where: { id: "h1" } });
    expect(restored.id).toBe("w-new");
  });

  it("fails as one unit when the history delete fails", async () => {
    const txWineCreate = vi.fn().mockResolvedValue(fakeWineRow({ id: "w-new" }));
    const txHistoryDelete = vi.fn().mockRejectedValue(new Error("delete failed"));
    txSpy.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({ wine: { create: txWineCreate }, wineHistory: { delete: txHistoryDelete } })
    );
    historyFindFirst.mockResolvedValue(fakeHistoryRow());

    const { restoreWineFromHistory } = await import("@/server/actions/wines");
    await expect(restoreWineFromHistory("u1", "h1")).rejects.toThrow("delete failed");
    expect(txWineCreate).toHaveBeenCalledOnce();
    expect(txHistoryDelete).toHaveBeenCalledOnce();
  });
});
