import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A backup is a round trip: Settings → Create Backup → Restore. The restore
 * re-created wines and cabinets from a hand-written field list that omitted
 * bottleSize, aiEnrichedAt and cabinet rowSizes — fields the export does
 * include — so restoring your own backup reset every magnum to "standard",
 * cleared the AI-enriched state, and dropped custom row layouts.
 */

process.env.DATABASE_URL = "postgresql://stub";

const tx = {
  wine: { deleteMany: vi.fn(), create: vi.fn() },
  cabinet: { deleteMany: vi.fn(), createMany: vi.fn() },
  wall: { deleteMany: vi.fn(), createMany: vi.fn() },
  wineHistory: { deleteMany: vi.fn(), create: vi.fn() },
  buyListItem: { deleteMany: vi.fn(), create: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<void>) => fn(tx),
  },
}));

const resolveServerUserId = vi.fn();
vi.mock("@/server/auth-guard", () => ({
  resolveServerUserId: (id?: string | null) => resolveServerUserId(id),
}));

const assertNotDemo = vi.fn();
vi.mock("@/lib/demo", () => ({ assertNotDemo: (action?: string) => assertNotDemo(action) }));

import { restoreBackup } from "@/server/actions/backup";
import type { Cabinet, Wine } from "@/types/wine";

function makeWine(partial: Partial<Wine>): Wine {
  return {
    id: "w-test",
    userId: "u-test",
    cabinetId: null,
    barcode: "",
    name: "Test",
    winery: "",
    region: "",
    country: "",
    vintage: null,
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
    tastingNotes: null,
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    tags: [],
    addedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  } as Wine;
}

function makeCabinet(partial: Partial<Cabinet>): Cabinet {
  return {
    id: "c-test",
    userId: "u-test",
    wallId: "wl-test",
    name: "Main",
    rows: 4,
    cols: 3,
    depth: 1,
    storageRows: [],
    rowSizes: [],
    sortOrder: 0,
    ...partial,
  } as Cabinet;
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveServerUserId.mockResolvedValue("u-resolved");
  assertNotDemo.mockResolvedValue(undefined);
});

describe("restoreBackup", () => {
  it("restores the wine's bottle size and AI-enriched timestamp", async () => {
    await restoreBackup(
      {
        wines: [
          makeWine({
            name: "Dom Pérignon",
            winery: "Moët",
            bottleSize: "magnum",
            aiEnrichedAt: "2026-09-01T10:00:00.000Z",
          }),
        ],
      },
      "u-client"
    );
    const data = tx.wine.create.mock.calls[0][0].data;
    expect(data.bottleSize).toBe("magnum");
    expect(data.aiEnrichedAt).toEqual(new Date("2026-09-01T10:00:00.000Z"));
  });

  it("restores custom cabinet row sizes", async () => {
    await restoreBackup(
      {
        cabinets: [
          makeCabinet({ rowSizes: [{ row: 1, maxSize: "magnum" }] }),
        ],
      },
      "u-client"
    );
    const first = tx.cabinet.createMany.mock.calls[0][0].data[0];
    expect(first.rowSizes).toEqual([{ row: 1, maxSize: "magnum" }]);
  });

  it("defaults a wine without those fields, the way a fresh create would", async () => {
    await restoreBackup(
      { wines: [makeWine({ name: "Côtes du Rhône", winery: "Guigal" })] },
      "u-client"
    );
    const data = tx.wine.create.mock.calls[0][0].data;
    expect(data.bottleSize).toBe("standard");
    expect(data.aiEnrichedAt).toBeNull();
  });
});
