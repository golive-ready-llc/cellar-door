import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for `@/server/tier-check` — server-side tier enforcement and the
 * atomic AI-credit reservation primitive.
 *
 * Mocking strategy: prisma is fully stubbed so each test can assert the
 * exact transaction calls. We import the module under test fresh in
 * select tests via `vi.resetModules()` to pick up env-var changes.
 */

process.env.DATABASE_URL = "postgresql://stub";

// ─── Prisma mock spies ────────────────────────────────────────────────

const userFindUnique = vi.fn();
const userUpdateMany = vi.fn();
const userUpdate = vi.fn();
const wineCount = vi.fn();
const aiUsageFindUnique = vi.fn();
const aiUsageUpsert = vi.fn();
const aiUsageUpdate = vi.fn();
const aiUsageUpdateMany = vi.fn();
const aiUsageLogCreate = vi.fn();
const aiUsageLogDeleteMany = vi.fn();
const transactionFn = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => userFindUnique(...a),
      updateMany: (...a: unknown[]) => userUpdateMany(...a),
      update: (...a: unknown[]) => userUpdate(...a),
    },
    wine: {
      count: (...a: unknown[]) => wineCount(...a),
    },
    aiUsage: {
      findUnique: (...a: unknown[]) => aiUsageFindUnique(...a),
      upsert: (...a: unknown[]) => aiUsageUpsert(...a),
      update: (...a: unknown[]) => aiUsageUpdate(...a),
      updateMany: (...a: unknown[]) => aiUsageUpdateMany(...a),
    },
    aiUsageLog: {
      create: (...a: unknown[]) => aiUsageLogCreate(...a),
      deleteMany: (...a: unknown[]) => aiUsageLogDeleteMany(...a),
    },
    $transaction: (...a: unknown[]) => transactionFn(...a),
  },
}));

// Build a tx object that delegates to the spies so the interactive
// transaction body in reserveAiCredits can call tx.aiUsage.upsert etc.
const txProxy = {
  user: {
    findUnique: (...a: unknown[]) => userFindUnique(...a),
    updateMany: (...a: unknown[]) => userUpdateMany(...a),
    update: (...a: unknown[]) => userUpdate(...a),
  },
  aiUsage: {
    findUnique: (...a: unknown[]) => aiUsageFindUnique(...a),
    upsert: (...a: unknown[]) => aiUsageUpsert(...a),
    update: (...a: unknown[]) => aiUsageUpdate(...a),
    updateMany: (...a: unknown[]) => aiUsageUpdateMany(...a),
  },
  aiUsageLog: {
    create: (...a: unknown[]) => aiUsageLogCreate(...a),
    deleteMany: (...a: unknown[]) => aiUsageLogDeleteMany(...a),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  // getUserTier computes DEFAULT_TIER from NEXT_PUBLIC_DEFAULT_TIER at module
  // load and returns maxTier(dbTier, DEFAULT_TIER). The getUserTier describe
  // sets that env var (=PRO/PREMIUM) and only clears it in its own beforeEach,
  // so under shuffled order a leaked floor lifts a mocked FREE tier up to PRO —
  // a FREE-tier test then stops rejecting. Clear the env and reset the module
  // registry before EVERY test so each fresh import recomputes DEFAULT_TIER from
  // a clean env (FREE floor); env-floor tests set their own value afterward.
  delete process.env.NEXT_PUBLIC_DEFAULT_TIER;
  vi.resetModules();
  // Default: $transaction with a function callback runs the callback with txProxy.
  transactionFn.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: typeof txProxy) => Promise<unknown>)(txProxy);
    }
    // Array form (consumeAiCredits): just resolve.
    return [];
  });
  // Default usage row: empty.
  aiUsageFindUnique.mockResolvedValue({ creditsUsed: 0 });
  aiUsageUpsert.mockResolvedValue({});
  aiUsageUpdate.mockResolvedValue({});
  aiUsageLogCreate.mockResolvedValue({});
  aiUsageLogDeleteMany.mockResolvedValue({ count: 0 });
  userUpdate.mockResolvedValue({});
  // Default user record (PRO tier, no extra credits).
  userFindUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) => {
    const sel = args?.select ?? {};
    if (sel.tier) return { tier: "PRO" };
    if (sel.extraCredits) return { extraCredits: 0 };
    return { tier: "PRO", extraCredits: 0 };
  });
});

afterEach(() => {
  // NEXT_PUBLIC_DEFAULT_TIER lives on process.env, which is shared across all
  // test files running in the same worker. The getUserTier env-floor tests set
  // it; if we don't clear it here, the LAST such test leaves it dirty and leaks
  // a PRO/PREMIUM floor into other files (e.g. walls.test.ts) that exercise the
  // real getUserTier and expect DEFAULT_TIER=FREE.
  delete process.env.NEXT_PUBLIC_DEFAULT_TIER;
});

// ─── getUserTier ──────────────────────────────────────────────────────

describe("getUserTier — DEFAULT_TIER_FLOOR / NEXT_PUBLIC_DEFAULT_TIER", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_DEFAULT_TIER;
    vi.resetModules();
  });

  it("returns DB tier when no env-var floor is set (FREE)", async () => {
    userFindUnique.mockResolvedValueOnce({ tier: "FREE" });
    const { getUserTier } = await import("@/server/tier-check");
    expect(await getUserTier("u1")).toBe("FREE");
  });

  it("env floor PREMIUM lifts a FREE DB tier to PREMIUM", async () => {
    process.env.NEXT_PUBLIC_DEFAULT_TIER = "PREMIUM";
    userFindUnique.mockResolvedValueOnce({ tier: "FREE" });
    const { getUserTier } = await import("@/server/tier-check");
    expect(await getUserTier("u1")).toBe("PREMIUM");
  });

  it("never downgrades when DB tier is higher than the env floor", async () => {
    process.env.NEXT_PUBLIC_DEFAULT_TIER = "PRO";
    userFindUnique.mockResolvedValueOnce({ tier: "PREMIUM" });
    const { getUserTier } = await import("@/server/tier-check");
    expect(await getUserTier("u1")).toBe("PREMIUM");
  });

  it("returns DEFAULT_TIER (FREE) when user record is missing", async () => {
    userFindUnique.mockResolvedValueOnce(null);
    const { getUserTier } = await import("@/server/tier-check");
    expect(await getUserTier("missing")).toBe("FREE");
  });

  it("invalid env value (e.g. 'NOPE') falls back to FREE floor", async () => {
    process.env.NEXT_PUBLIC_DEFAULT_TIER = "NOPE";
    userFindUnique.mockResolvedValueOnce({ tier: "FREE" });
    const { getUserTier } = await import("@/server/tier-check");
    expect(await getUserTier("u1")).toBe("FREE");
  });

  it("returns DEFAULT_TIER on DB error", async () => {
    userFindUnique.mockRejectedValueOnce(new Error("db down"));
    const { getUserTier } = await import("@/server/tier-check");
    expect(await getUserTier("u1")).toBe("FREE");
  });
});

// ─── requireFeature ───────────────────────────────────────────────────

describe("requireFeature", () => {
  it("FREE → throws TierError(UPGRADE_REQUIRED) for cellarChat (an AI feature)", async () => {
    userFindUnique.mockResolvedValueOnce({ tier: "FREE" });
    const { requireFeature, TierError } = await import("@/server/tier-check");
    await expect(requireFeature("u1", "cellarChat")).rejects.toBeInstanceOf(TierError);
    userFindUnique.mockResolvedValueOnce({ tier: "FREE" });
    await expect(requireFeature("u1", "cellarChat")).rejects.toMatchObject({
      code: "UPGRADE_REQUIRED",
      requiredTier: "PRO",
    });
  });

  it("PRO → succeeds for cellarChat", async () => {
    userFindUnique.mockResolvedValueOnce({ tier: "PRO" });
    const { requireFeature } = await import("@/server/tier-check");
    await expect(requireFeature("u1", "cellarChat")).resolves.toBe("PRO");
  });

  it("PRO → throws for bulkEnrich (PREMIUM-only)", async () => {
    userFindUnique.mockResolvedValueOnce({ tier: "PRO" });
    const { requireFeature, TierError } = await import("@/server/tier-check");
    await expect(requireFeature("u1", "bulkEnrich")).rejects.toBeInstanceOf(TierError);
  });
});

// ─── requireCanAddWine ────────────────────────────────────────────────

describe("requireCanAddWine", () => {
  // Since the 2026-08 pricing revamp every tier has unlimited wines
  // (maxWines: null). requireCanAddWine and its WINE_LIMIT_REACHED path are
  // kept for future capped tiers (e.g. a metered BUSINESS trial).
  it("FREE unlimited → never throws regardless of count", async () => {
    userFindUnique.mockResolvedValueOnce({ tier: "FREE" });
    wineCount.mockResolvedValueOnce(1_000_000);
    const { requireCanAddWine } = await import("@/server/tier-check");
    await expect(requireCanAddWine("u1")).resolves.toBe("FREE");
  });

  it("PREMIUM unlimited → never throws regardless of count", async () => {
    userFindUnique.mockResolvedValueOnce({ tier: "PREMIUM" });
    wineCount.mockResolvedValueOnce(1_000_000);
    const { requireCanAddWine } = await import("@/server/tier-check");
    await expect(requireCanAddWine("u1")).resolves.toBe("PREMIUM");
  });
});

// ─── reserveAiCredits ─────────────────────────────────────────────────

describe("reserveAiCredits", () => {
  it("happy path: monthly pool covers, returns ok with refundOnFailure", async () => {
    userFindUnique.mockResolvedValueOnce({ tier: "PRO" });   // getUserTier
    aiUsageUpdateMany.mockResolvedValueOnce({ count: 1 });   // monthly try succeeds
    // post-tx refresh:
    aiUsageFindUnique.mockResolvedValueOnce({ creditsUsed: 1 });
    userFindUnique.mockResolvedValueOnce({ extraCredits: 0 }); // for getAiUsage call inside post
    userFindUnique.mockResolvedValueOnce({ tier: "PRO" });     // getUserTier inside getAiUsage
    // Actually getAiUsage calls getUserTier first, then both queries.

    const { reserveAiCredits } = await import("@/server/tier-check");
    const result = await reserveAiCredits("u1", "auto_fill", 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.chargedMonthly).toBe(1);
      expect(result.chargedExtra).toBe(0);
      expect(typeof result.refundOnFailure).toBe("function");
    }
    expect(aiUsageUpsert).toHaveBeenCalled();
    expect(aiUsageLogCreate).toHaveBeenCalled();
  });

  it("partial pool + extraCredits split charges both", async () => {
    userFindUnique.mockResolvedValue({ tier: "PRO", extraCredits: 100 });
    // Make implementation route by select:
    userFindUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) => {
      if (args?.select?.tier) return { tier: "PRO" };
      if (args?.select?.extraCredits) return { extraCredits: 100 };
      return { tier: "PRO", extraCredits: 100 };
    });
    // First conditional updateMany on aiUsage fails (would exceed cap):
    aiUsageUpdateMany.mockResolvedValueOnce({ count: 0 });
    // After read, monthlyHeadroom = creditsLimit - creditsUsed.
    // Set creditsUsed close to limit so monthlyHeadroom = 2 (PRO: 300 cap).
    aiUsageFindUnique.mockResolvedValueOnce({ creditsUsed: 298 });
    // Partial monthly charge succeeds:
    aiUsageUpdateMany.mockResolvedValueOnce({ count: 1 });
    // Extra credits decrement succeeds:
    userUpdateMany.mockResolvedValueOnce({ count: 1 });

    const { reserveAiCredits } = await import("@/server/tier-check");
    const result = await reserveAiCredits("u1", "label_scan", 5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.chargedMonthly).toBe(2);
      expect(result.chargedExtra).toBe(3);
    }
  });

  it("exhausted: returns ok:false reason CREDITS_EXHAUSTED when neither pool covers", async () => {
    userFindUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) => {
      if (args?.select?.tier) return { tier: "PRO" };
      if (args?.select?.extraCredits) return { extraCredits: 0 };
      return { tier: "PRO", extraCredits: 0 };
    });
    // Monthly conditional fails:
    aiUsageUpdateMany.mockResolvedValueOnce({ count: 0 });
    // Headroom is zero (creditsUsed at the cap):
    aiUsageFindUnique.mockResolvedValueOnce({ creditsUsed: 300 });
    // No partial possible. Extra try fails:
    userUpdateMany.mockResolvedValueOnce({ count: 0 });

    const { reserveAiCredits } = await import("@/server/tier-check");
    const result = await reserveAiCredits("u1", "auto_fill", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("CREDITS_EXHAUSTED");
      expect(result.tier).toBe("PRO");
    }
  });

  it("invalid amount NaN → INVALID_AMOUNT, no DB calls", async () => {
    const { reserveAiCredits } = await import("@/server/tier-check");
    const result = await reserveAiCredits("u1", "auto_fill", Number.NaN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_AMOUNT");
    expect(transactionFn).not.toHaveBeenCalled();
  });

  it("invalid amount negative → INVALID_AMOUNT", async () => {
    const { reserveAiCredits } = await import("@/server/tier-check");
    const result = await reserveAiCredits("u1", "auto_fill", -3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_AMOUNT");
  });

  it("zero credits: logs usage, no reservation, refundOnFailure is a no-op", async () => {
    userFindUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) => {
      if (args?.select?.tier) return { tier: "PRO" };
      if (args?.select?.extraCredits) return { extraCredits: 0 };
      return { tier: "PRO", extraCredits: 0 };
    });
    aiUsageFindUnique.mockResolvedValueOnce({ creditsUsed: 0 });
    const { reserveAiCredits } = await import("@/server/tier-check");
    const result = await reserveAiCredits("u1", "auto_fill", 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.chargedMonthly).toBe(0);
      expect(result.chargedExtra).toBe(0);
      // Should not have wrapped the work in a $transaction
      expect(transactionFn).not.toHaveBeenCalled();
      // refundOnFailure no-op
      await expect(result.refundOnFailure()).resolves.toBeUndefined();
    }
  });

  it("refundOnFailure decrements monthly counter and removes audit row", async () => {
    userFindUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) => {
      if (args?.select?.tier) return { tier: "PRO" };
      if (args?.select?.extraCredits) return { extraCredits: 0 };
      return { tier: "PRO", extraCredits: 0 };
    });
    aiUsageUpdateMany.mockResolvedValueOnce({ count: 1 });
    aiUsageFindUnique.mockResolvedValueOnce({ creditsUsed: 1 });

    const { reserveAiCredits } = await import("@/server/tier-check");
    const result = await reserveAiCredits("u1", "enrich_text", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Now refund — decrements via a CONDITIONAL updateMany (creditsUsed >=
    // charged) so a double refund can't drive the counter negative, then
    // removes the audit row.
    transactionFn.mockClear();
    aiUsageUpdateMany.mockClear();
    aiUsageLogDeleteMany.mockClear();
    aiUsageUpdateMany.mockResolvedValueOnce({ count: 1 });
    await result.refundOnFailure();
    expect(transactionFn).toHaveBeenCalledTimes(1);
    expect(aiUsageUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ creditsUsed: { gte: 1 } }),
        data: { creditsUsed: { decrement: 1 } },
      })
    );
    expect(aiUsageLogDeleteMany).toHaveBeenCalled();
  });

  it("refund with chargedExtra also increments extraCredits back", async () => {
    userFindUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) => {
      if (args?.select?.tier) return { tier: "PRO" };
      if (args?.select?.extraCredits) return { extraCredits: 100 };
      return { tier: "PRO", extraCredits: 100 };
    });
    aiUsageUpdateMany.mockResolvedValueOnce({ count: 0 }); // monthly fails
    aiUsageFindUnique.mockResolvedValueOnce({ creditsUsed: 300 }); // no headroom
    userUpdateMany.mockResolvedValueOnce({ count: 1 });   // extra covers all

    const { reserveAiCredits } = await import("@/server/tier-check");
    const result = await reserveAiCredits("u1", "auto_fill", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chargedExtra).toBe(1);
    expect(result.chargedMonthly).toBe(0);

    userUpdate.mockClear();
    await result.refundOnFailure();
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { extraCredits: { increment: 1 } },
      })
    );
  });

  it("concurrent contention: monthly update count=0 + insufficient extra → CREDITS_EXHAUSTED (TOCTOU-safe)", async () => {
    userFindUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) => {
      if (args?.select?.tier) return { tier: "PRO" };
      if (args?.select?.extraCredits) return { extraCredits: 0 };
      return { tier: "PRO", extraCredits: 0 };
    });
    // Two concurrent reservations. The losing one observes count=0.
    aiUsageUpdateMany.mockResolvedValueOnce({ count: 0 });
    aiUsageFindUnique.mockResolvedValueOnce({ creditsUsed: 300 });
    userUpdateMany.mockResolvedValueOnce({ count: 0 });

    const { reserveAiCredits } = await import("@/server/tier-check");
    const result = await reserveAiCredits("u1", "auto_fill", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("CREDITS_EXHAUSTED");
    }
  });

  it("non-credits-exhausted DB error propagates (not silently granted)", async () => {
    userFindUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) => {
      if (args?.select?.tier) return { tier: "PRO" };
      return { tier: "PRO" };
    });
    transactionFn.mockImplementationOnce(async () => {
      throw new Error("connection refused");
    });
    const { reserveAiCredits } = await import("@/server/tier-check");
    await expect(reserveAiCredits("u1", "auto_fill", 1)).rejects.toThrow(
      "connection refused"
    );
  });
});
