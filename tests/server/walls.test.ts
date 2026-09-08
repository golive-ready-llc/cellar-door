import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.DATABASE_URL = "postgresql://stub";

const wallFindMany = vi.fn();
const wallFindFirst = vi.fn();
const wallCreate = vi.fn();
const wallUpdate = vi.fn();
const wallDelete = vi.fn();
const cabinetFindMany = vi.fn();
const cabinetDeleteMany = vi.fn();
const wineUpdateMany = vi.fn();
const userFindUnique = vi.fn();
const tx = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    wall: {
      findMany: wallFindMany,
      findFirst: wallFindFirst,
      create: wallCreate,
      update: wallUpdate,
      delete: wallDelete,
    },
    cabinet: { findMany: cabinetFindMany, deleteMany: cabinetDeleteMany },
    wine: { updateMany: wineUpdateMany },
    user: { findUnique: userFindUnique },
    $transaction: tx,
  },
}));

const resolveServerUserId = vi.fn();
vi.mock("@/server/auth-guard", () => ({
  resolveServerUserId: (id?: string | null) => resolveServerUserId(id),
  getAuthenticatedUserId: vi.fn(),
}));

vi.mock("@/lib/demo", () => ({ assertNotDemo: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/encryption", () => ({
  encrypt: (s: string) => `enc:${s}`,
  decrypt: (s: string) => s.replace(/^enc:/, ""),
}));
vi.mock("@/lib/tier", () => ({
  hasFeature: (tier: string, feat: string) => tier === "PREMIUM" && feat === "haSensors",
}));

function fakeWall(overrides: Record<string, unknown> = {}) {
  return {
    id: "wall1",
    userId: "u1",
    name: "Main",
    location: "Home",
    sortOrder: 0,
    haConfig: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveServerUserId.mockImplementation(async (id?: string | null) => {
    if (!id) throw new Error("Unauthorized");
    return id;
  });
  tx.mockImplementation((arg: unknown) => Promise.resolve(arg));
});

describe("addWall", () => {
  it("creates with resolved userId and defaults", async () => {
    wallCreate.mockResolvedValue(fakeWall());
    const { addWall } = await import("@/server/actions/walls");
    await addWall({ userId: "u1" });
    const data = wallCreate.mock.calls[0][0].data;
    expect(data.userId).toBe("u1");
    expect(data.name).toBe("New Wall");
    expect(data.location).toBe("Home");
  });
});

describe("getWalls", () => {
  it("scopes findMany to userId", async () => {
    wallFindMany.mockResolvedValue([]);
    const { getWalls } = await import("@/server/actions/walls");
    await getWalls("u1");
    expect(wallFindMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: { sortOrder: "asc" },
    });
  });
});

describe("getWall", () => {
  it("returns null on ownership mismatch", async () => {
    wallFindFirst.mockResolvedValue(null);
    const { getWall } = await import("@/server/actions/walls");
    expect(await getWall("u1", "wall-other")).toBeNull();
  });
});

describe("updateWall", () => {
  it("ownership-checks before update", async () => {
    wallFindFirst.mockResolvedValue(null);
    const { updateWall } = await import("@/server/actions/walls");
    await expect(updateWall("u1", "wall1", { name: "x" })).rejects.toThrow("Unauthorized");
    expect(wallUpdate).not.toHaveBeenCalled();
  });

  it("only forwards explicitly provided fields", async () => {
    wallFindFirst.mockResolvedValue(fakeWall());
    wallUpdate.mockResolvedValue(fakeWall({ name: "Updated" }));
    const { updateWall } = await import("@/server/actions/walls");
    await updateWall("u1", "wall1", { name: "Updated" });
    expect(wallUpdate.mock.calls[0][0].data).toEqual({ name: "Updated" });
  });
});

describe("deleteWall", () => {
  it("rejects when wall not owned by user", async () => {
    wallFindFirst.mockResolvedValue(null);
    const { deleteWall } = await import("@/server/actions/walls");
    await expect(deleteWall("u1", "wall1")).rejects.toThrow(/not found/i);
    expect(wallDelete).not.toHaveBeenCalled();
  });

  it("cascades cabinet+wine cleanup scoped to user", async () => {
    wallFindFirst.mockResolvedValue(fakeWall());
    cabinetFindMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    const { deleteWall } = await import("@/server/actions/walls");
    await deleteWall("u1", "wall1");
    expect(cabinetFindMany).toHaveBeenCalledWith({
      where: { wallId: "wall1", userId: "u1" },
      select: { id: true },
    });
    expect(wineUpdateMany).toHaveBeenCalledWith({
      where: { userId: "u1", cabinetId: { in: ["c1", "c2"] } },
      data: { cabinetId: null, row: null, col: null, depth: 0 },
    });
    expect(cabinetDeleteMany).toHaveBeenCalledWith({
      where: { wallId: "wall1", userId: "u1" },
    });
    expect(wallDelete).toHaveBeenCalledWith({ where: { id: "wall1" } });
  });
});

describe("updateWallHaConfig", () => {
  it("rejects when user lacks haSensors feature", async () => {
    // The wall must exist so updateWallHaConfig reaches the feature gate — it
    // checks wall ownership BEFORE requirePremium and returns "Wall not found"
    // first otherwise. Without mocking this, the test only passed when a prior
    // test happened to leave wallFindFirst returning a wall (order-dependent).
    wallFindFirst.mockResolvedValue(fakeWall());
    userFindUnique.mockResolvedValue({ tier: "FREE" });
    const { updateWallHaConfig } = await import("@/server/actions/walls");
    const r = await updateWallHaConfig("u1", "wall1", "http://ha", "tok", "t", "h");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/Cellar Pro/i);
  });

  it("encrypts the token before storing", async () => {
    userFindUnique.mockResolvedValue({ tier: "PREMIUM" });
    wallFindFirst.mockResolvedValue(fakeWall());
    wallUpdate.mockResolvedValue(fakeWall());
    const { updateWallHaConfig } = await import("@/server/actions/walls");
    await updateWallHaConfig("u1", "wall1", "http://ha/", "secret-token", "t", "h");
    const data = wallUpdate.mock.calls[0][0].data;
    expect(data.haConfig.encryptedToken).toBe("enc:secret-token");
    expect(data.haConfig.haUrl).toBe("http://ha"); // trailing slash stripped
  });
});

describe("removeWallHaConfig", () => {
  it("returns error when wall not found", async () => {
    wallFindFirst.mockResolvedValue(null);
    const { removeWallHaConfig } = await import("@/server/actions/walls");
    const r = await removeWallHaConfig("u1", "wall-other");
    expect(r.success).toBe(false);
    expect(wallUpdate).not.toHaveBeenCalled();
  });

  it("clears haConfig with Prisma.JsonNull (not undefined)", async () => {
    // Regression: passing `haConfig: undefined` is silently dropped by
    // Prisma for Json? fields, leaving the encrypted Bearer token in the
    // DB. Must use Prisma.JsonNull to actually null the column.
    const { Prisma } = await import("@/generated/prisma/client");
    wallFindFirst.mockResolvedValue(fakeWall());
    wallUpdate.mockResolvedValue(fakeWall({ haConfig: null }));
    const { removeWallHaConfig } = await import("@/server/actions/walls");
    await removeWallHaConfig("u1", "wall1");
    const data = wallUpdate.mock.calls[0][0].data;
    expect(data.haConfig).toBe(Prisma.JsonNull);
    expect(data.haConfig).not.toBeUndefined();
  });
});
