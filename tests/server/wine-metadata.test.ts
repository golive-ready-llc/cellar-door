import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The shared WineMetadata cache feeds other users' wines, so its writes must
 * not be exported from a "use server" module (every such export is a public
 * endpoint). They live in the plain server module wine-metadata-store.
 */

process.env.DATABASE_URL = "postgresql://stub";

const findFirst = vi.fn();
const update = vi.fn();
const create = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    wineMetadata: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      update: (...a: unknown[]) => update(...a),
      create: (...a: unknown[]) => create(...a),
      updateMany: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({});
  create.mockResolvedValue({});
});

describe("wine metadata cache writes", () => {
  it("are not exported from the public server-action module", async () => {
    const actions = await import("@/server/actions/wine-metadata");
    expect(Object.keys(actions)).not.toContain("saveWineMetadata");
    expect(Object.keys(actions)).not.toContain("saveWineMetadataImage");
  });

  it("still merge into an existing row from server code", async () => {
    findFirst.mockResolvedValue({ id: "m1", description: "Existing notes", region: "" });
    const { saveWineMetadata } = await import("@/server/wine-metadata-store");
    await saveWineMetadata({ name: "Cuvée", winery: "Domaine", region: "Loire" });
    expect(update).toHaveBeenCalledTimes(1);
    const { data } = update.mock.calls[0][0];
    expect(data).toMatchObject({ description: "Existing notes", region: "Loire" });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("wine metadata lookups use the indexed keys", () => {
  it("matches trimmed, lower-cased winery and name exactly", async () => {
    findFirst.mockResolvedValue(null);
    const { findWineMetadata } = await import("@/server/actions/wine-metadata");
    await findWineMetadata("  Domaine Exemple ", "CUVÉE Réserve", 2019);
    expect(findFirst.mock.calls[0][0].where).toEqual({
      wineryKey: "domaine exemple",
      nameKey: "cuvée réserve",
      vintage: 2019,
    });
  });

  it("stores the keys on new rows", async () => {
    findFirst.mockResolvedValue(null);
    const { saveWineMetadata } = await import("@/server/wine-metadata-store");
    await saveWineMetadata({ name: "Cuvée", winery: "Domaine" });
    const { data } = create.mock.calls[0][0];
    expect(data).toMatchObject({ winery: "Domaine", wineryKey: "domaine", name: "Cuvée", nameKey: "cuvée" });
  });
});
