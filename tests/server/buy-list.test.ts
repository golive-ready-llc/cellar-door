import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.DATABASE_URL = "postgresql://stub";

const itemFindMany = vi.fn();
const itemFindFirst = vi.fn();
const itemFindUnique = vi.fn();
const itemCreate = vi.fn();
const itemUpdate = vi.fn();
const itemUpdateMany = vi.fn();
const itemDelete = vi.fn();
const itemDeleteMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    buyListItem: {
      findMany: itemFindMany,
      findFirst: itemFindFirst,
      findUnique: itemFindUnique,
      create: itemCreate,
      update: itemUpdate,
      updateMany: itemUpdateMany,
      delete: itemDelete,
      deleteMany: itemDeleteMany,
    },
  },
}));

const resolveServerUserId = vi.fn();
vi.mock("@/server/auth-guard", () => ({
  resolveServerUserId: (id?: string | null) => resolveServerUserId(id),
  getAuthenticatedUserId: vi.fn(),
}));

vi.mock("@/lib/demo", () => ({ assertNotDemo: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/generated/prisma/client", () => ({ Prisma: { JsonNull: null } }));

function fakeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "i1",
    userId: "u1",
    barcode: "",
    name: "Wine",
    winery: "",
    region: "",
    country: "",
    vintage: 2020,
    type: "red",
    sparkling: false,
    grapeVariety: "",
    imageUrl: "",
    retailPrice: null,
    notes: "",
    description: "",
    foodPairings: "",
    alcohol: "",
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    status: "wanted",
    orderDate: null,
    expectedDelivery: null,
    store: "",
    addedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveServerUserId.mockImplementation(async (id?: string | null) => {
    if (!id) throw new Error("Unauthorized");
    return id;
  });
});

describe("getBuyList", () => {
  it("scopes findMany to resolved userId", async () => {
    itemFindMany.mockResolvedValue([]);
    const { getBuyList } = await import("@/server/actions/buy-list");
    await getBuyList("u1");
    expect(itemFindMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: { addedAt: "desc" },
    });
  });

  it("throws when no userId resolvable", async () => {
    const { getBuyList } = await import("@/server/actions/buy-list");
    await expect(getBuyList()).rejects.toThrow();
  });
});

describe("addBuyListItem", () => {
  it("creates with resolved userId and defaults", async () => {
    itemCreate.mockResolvedValue(fakeItem());
    const { addBuyListItem } = await import("@/server/actions/buy-list");
    await addBuyListItem("u1", { name: "Wine" } as never);
    const data = itemCreate.mock.calls[0][0].data;
    expect(data.userId).toBe("u1");
    expect(data.name).toBe("Wine");
    expect(data.status).toBe("wanted");
  });
});

describe("updateBuyListItem", () => {
  it("rejects (scoped updateMany matches nothing) when not owned", async () => {
    itemUpdateMany.mockResolvedValue({ count: 0 });
    const { updateBuyListItem } = await import("@/server/actions/buy-list");
    await expect(updateBuyListItem("u1", "i1", { name: "x" })).rejects.toThrow(/not found/i);
  });

  it("updates only explicit fields, scoped to the owner", async () => {
    itemUpdateMany.mockResolvedValue({ count: 1 });
    itemFindUnique.mockResolvedValue(fakeItem({ status: "ordered" }));
    const { updateBuyListItem } = await import("@/server/actions/buy-list");
    await updateBuyListItem("u1", "i1", { status: "ordered" });
    const call = itemUpdateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "i1", userId: "u1" });
    expect(call.data).toEqual({ status: "ordered" });
  });
});

describe("removeBuyListItem", () => {
  it("rejects when item not owned by user (no IDOR)", async () => {
    itemDeleteMany.mockResolvedValue({ count: 0 });
    const { removeBuyListItem } = await import("@/server/actions/buy-list");
    await expect(removeBuyListItem("u1", "i1")).rejects.toThrow(/not found/i);
  });

  it("deletes, scoped to the owner, when ownership confirmed", async () => {
    itemDeleteMany.mockResolvedValue({ count: 1 });
    const { removeBuyListItem } = await import("@/server/actions/buy-list");
    await removeBuyListItem("u1", "i1");
    expect(itemDeleteMany).toHaveBeenCalledWith({ where: { id: "i1", userId: "u1" } });
  });
});
