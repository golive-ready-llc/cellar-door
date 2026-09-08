import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.DATABASE_URL = "postgresql://stub";

const cabinetFindMany = vi.fn();
const cabinetFindFirst = vi.fn();
const cabinetCreate = vi.fn();
const cabinetUpdate = vi.fn();
const cabinetDelete = vi.fn();
const wallFindFirst = vi.fn();
const wineUpdateMany = vi.fn();
const txSpy = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    cabinet: {
      findMany: cabinetFindMany,
      findFirst: cabinetFindFirst,
      create: cabinetCreate,
      update: cabinetUpdate,
      delete: cabinetDelete,
    },
    wall: { findFirst: wallFindFirst },
    wine: { updateMany: wineUpdateMany },
    $transaction: txSpy,
  },
}));

const resolveServerUserId = vi.fn();
vi.mock("@/server/auth-guard", () => ({
  resolveServerUserId: (id?: string | null) => resolveServerUserId(id),
  getAuthenticatedUserId: vi.fn(),
}));

vi.mock("@/lib/demo", () => ({ assertNotDemo: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/generated/prisma/client", () => ({ Prisma: { JsonNull: null } }));

function fakeCab(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    userId: "u1",
    wallId: "wall1",
    name: "Cab",
    rows: 8,
    cols: 8,
    depth: 1,
    storageRows: [],
    sortOrder: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveServerUserId.mockImplementation(async (id?: string | null) => {
    if (!id) throw new Error("Unauthorized");
    return id;
  });
  // $transaction is used two ways: the ARRAY form (deleteCabinet) and the
  // interactive CALLBACK form (updateCabinet's shrink-and-unassign). Support
  // both: invoke a callback with a tx client that proxies to the same spies as
  // the top-level prisma mock, or resolve an array as-is.
  txSpy.mockImplementation((argOrCallback) => {
    if (typeof argOrCallback === "function") {
      return argOrCallback({
        cabinet: { update: cabinetUpdate },
        wine: { updateMany: wineUpdateMany },
      });
    }
    return Promise.resolve(argOrCallback);
  });
});

describe("addCabinet", () => {
  it("creates with resolved userId and applies defaults", async () => {
    wallFindFirst.mockResolvedValue({ id: "wall1", userId: "u1" });
    cabinetCreate.mockResolvedValue(fakeCab());
    const { addCabinet } = await import("@/server/actions/cabinets");
    await addCabinet({ userId: "u1", wallId: "wall1" });
    const data = cabinetCreate.mock.calls[0][0].data;
    expect(data.userId).toBe("u1");
    expect(data.name).toBe("New Section");
    expect(data.rows).toBe(8);
    expect(data.cols).toBe(8);
  });
});

describe("getCabinets", () => {
  it("scopes findMany to userId, ordered by sortOrder asc", async () => {
    cabinetFindMany.mockResolvedValue([]);
    const { getCabinets } = await import("@/server/actions/cabinets");
    await getCabinets("u1");
    expect(cabinetFindMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: { sortOrder: "asc" },
    });
  });
});

describe("getCabinet", () => {
  it("returns null on ownership mismatch", async () => {
    cabinetFindFirst.mockResolvedValue(null);
    const { getCabinet } = await import("@/server/actions/cabinets");
    expect(await getCabinet("u1", "c-other")).toBeNull();
  });
});

describe("updateCabinet", () => {
  it("rejects when cabinet not owned by user", async () => {
    cabinetFindFirst.mockResolvedValue(null);
    const { updateCabinet } = await import("@/server/actions/cabinets");
    await expect(updateCabinet("u1", "c1", { name: "x" })).rejects.toThrow(/unauthorized|not found/i);
    expect(cabinetUpdate).not.toHaveBeenCalled();
  });

  it("unassigns out-of-bounds wines when shrinking dimensions", async () => {
    cabinetFindFirst.mockResolvedValue(fakeCab({ rows: 8, cols: 8 }));
    cabinetUpdate.mockResolvedValue(fakeCab({ rows: 4, cols: 4 }));
    const { updateCabinet } = await import("@/server/actions/cabinets");
    await updateCabinet("u1", "c1", { rows: 4, cols: 4 });
    expect(wineUpdateMany).toHaveBeenCalledOnce();
    const call = wineUpdateMany.mock.calls[0][0];
    expect(call.where.cabinetId).toBe("c1");
    expect(call.data).toEqual({ cabinetId: null, row: null, col: null, depth: 0 });
  });

  it("does NOT unassign wines when growing dimensions", async () => {
    cabinetFindFirst.mockResolvedValue(fakeCab({ rows: 4, cols: 4 }));
    cabinetUpdate.mockResolvedValue(fakeCab({ rows: 8, cols: 8 }));
    const { updateCabinet } = await import("@/server/actions/cabinets");
    await updateCabinet("u1", "c1", { rows: 8, cols: 8 });
    expect(wineUpdateMany).not.toHaveBeenCalled();
  });
});

describe("deleteCabinet", () => {
  it("rejects when cabinet not owned by user", async () => {
    cabinetFindFirst.mockResolvedValue(null);
    const { deleteCabinet } = await import("@/server/actions/cabinets");
    await expect(deleteCabinet("u1", "c1")).rejects.toThrow(/not found/i);
    expect(cabinetDelete).not.toHaveBeenCalled();
  });

  it("unassigns wines (scoped to user) before deleting cabinet", async () => {
    cabinetFindFirst.mockResolvedValue(fakeCab());
    const { deleteCabinet } = await import("@/server/actions/cabinets");
    await deleteCabinet("u1", "c1");
    expect(wineUpdateMany).toHaveBeenCalledWith({
      where: { cabinetId: "c1", userId: "u1" },
      data: { cabinetId: null, row: null, col: null, depth: 0 },
    });
    expect(cabinetDelete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });
});

describe("reorderCabinets", () => {
  it("throws Unauthorized if any cabinet id is not owned by user", async () => {
    cabinetFindMany.mockResolvedValue([{ id: "c1" }]); // only one of the two
    const { reorderCabinets } = await import("@/server/actions/cabinets");
    await expect(reorderCabinets("u1", ["c1", "c-not-mine"])).rejects.toThrow(/unauthorized/i);
    expect(txSpy).not.toHaveBeenCalled();
  });

  it("transactionally renumbers when ownership confirmed", async () => {
    cabinetFindMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    cabinetUpdate.mockResolvedValue(fakeCab());
    const { reorderCabinets } = await import("@/server/actions/cabinets");
    await reorderCabinets("u1", ["c2", "c1"]);
    expect(txSpy).toHaveBeenCalledOnce();
  });
});
