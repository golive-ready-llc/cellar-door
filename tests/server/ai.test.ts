import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for `@/server/actions/ai` — the wrapAI gate, refund-on-failure
 * path, and barcode lookup cache flow.
 *
 * Heavy mocking: we stub tier-check, auth-guard, the AI provider, and
 * the demo helper so each test deterministically exercises one branch.
 */

process.env.DATABASE_URL = "postgresql://stub";

// ─── Spy fns ──────────────────────────────────────────────────────────

const isDemoRequestSpy = vi.fn().mockResolvedValue(false);
const getAuthenticatedUserIdSpy = vi.fn().mockResolvedValue(null as string | null);
const requireFeatureSpy = vi.fn().mockResolvedValue("PRO");
const reserveAiCreditsSpy = vi.fn();
const refundOnFailureSpy = vi.fn().mockResolvedValue(undefined);
const getAiCreditsRemainingSpy = vi.fn().mockResolvedValue({
  used: 0,
  limit: 300,
  remaining: 300,
  extraCredits: 0,
  tier: "PRO",
});
const searchWineSpy = vi.fn();
const isAIAvailableSpy = vi.fn().mockReturnValue(true);
const barcodeFindUniqueSpy = vi.fn();
const barcodeCreateSpy = vi.fn().mockResolvedValue({});
const saveWineMetadataSpy = vi.fn().mockResolvedValue(undefined);

class MockTierError extends Error {
  code: string;
  requiredTier: string;
  constructor(code: string, requiredTier: string, message: string) {
    super(message);
    this.code = code;
    this.requiredTier = requiredTier;
    this.name = "TierError";
  }
}

// Mock Sentry so the per-test `vi.resetModules()` re-import (below) doesn't pull
// in the heavy real @sentry/nextjs module tree each time — that re-import under
// parallel load occasionally blew past the 5s test timeout.
vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/demo", () => ({
  isDemoRequest: () => isDemoRequestSpy(),
  DEMO_COOKIE: "demo_mode",
  assertNotDemo: vi.fn(),
}));

vi.mock("@/server/auth-guard", () => ({
  getAuthenticatedUserId: () => getAuthenticatedUserIdSpy(),
  resolveServerUserId: vi.fn(),
}));

vi.mock("@/server/tier-check", () => ({
  requireFeature: (...a: unknown[]) => requireFeatureSpy(...a),
  reserveAiCredits: (...a: unknown[]) => reserveAiCreditsSpy(...a),
  getAiCreditsRemaining: (...a: unknown[]) => getAiCreditsRemainingSpy(...a),
  TierError: MockTierError,
}));

vi.mock("@/lib/ai", () => ({
  getAIProvider: () => ({
    searchWine: (...a: unknown[]) => searchWineSpy(...a),
  }),
  isAIAvailable: () => isAIAvailableSpy(),
}));

vi.mock("@/lib/ai/mock", () => ({
  MockAIProvider: class {
    searchWine = (...a: unknown[]) => searchWineSpy(...a);
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    barcodeCache: {
      findUnique: (...a: unknown[]) => barcodeFindUniqueSpy(...a),
      create: (...a: unknown[]) => barcodeCreateSpy(...a),
    },
  },
}));

vi.mock("@/server/actions/wine-metadata", () => ({
  saveWineMetadata: (...a: unknown[]) => saveWineMetadataSpy(...a),
  saveWineMetadataImage: vi.fn(),
}));

// ─── Defaults ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Reset module registry so each test re-imports `@/server/actions/ai` with
  // EMPTY module-level caches (wineIdCache + inflightRequests dedup map). Those
  // caches are correct production behavior, but without this a query/barcode
  // used by an earlier test is served from cache in later tests — the gate
  // (requireFeature/reserveAiCredits) is skipped, so the spies show 0 calls.
  // vi.mock factories are hoisted and survive resetModules, so the spies below
  // still intercept after the fresh import.
  vi.resetModules();
  isDemoRequestSpy.mockResolvedValue(false);
  getAuthenticatedUserIdSpy.mockResolvedValue(null);
  requireFeatureSpy.mockResolvedValue("PRO");
  isAIAvailableSpy.mockReturnValue(true);
  searchWineSpy.mockResolvedValue({ name: "Chateau X", winery: "Wx" });
  reserveAiCreditsSpy.mockResolvedValue({
    ok: true,
    tier: "PRO",
    remaining: 299,
    chargedMonthly: 1,
    chargedExtra: 0,
    refundOnFailure: refundOnFailureSpy,
  });
  refundOnFailureSpy.mockResolvedValue(undefined);
  barcodeFindUniqueSpy.mockResolvedValue(null);
  // Suppress noisy console.error from wrapAI:
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ─── Tests ────────────────────────────────────────────────────────────

describe("aiSearchWine — gate building", () => {
  it("cookie auth path: gate built from verified userId, not client param", async () => {
    getAuthenticatedUserIdSpy.mockResolvedValueOnce("verified-uid");
    const { aiSearchWine } = await import("@/server/actions/ai");
    const result = await aiSearchWine("Bordeaux", "client-uid");
    expect(result.success).toBe(true);
    // requireFeature should have been called with the verified id, NOT client-uid.
    expect(requireFeatureSpy).toHaveBeenCalledWith("verified-uid", "barcodeAiLookup");
    expect(reserveAiCreditsSpy).toHaveBeenCalledWith("verified-uid", "auto_fill", 1);
  });

  it("cookie missing → falls back to clientUserId (audit-1 rollback)", async () => {
    getAuthenticatedUserIdSpy.mockResolvedValueOnce(null);
    const { aiSearchWine } = await import("@/server/actions/ai");
    const result = await aiSearchWine("Bordeaux", "client-uid");
    expect(result.success).toBe(true);
    expect(requireFeatureSpy).toHaveBeenCalledWith("client-uid", "barcodeAiLookup");
  });

  it("anonymous (no cookie + no client) → success:false Unauthorized", async () => {
    getAuthenticatedUserIdSpy.mockResolvedValueOnce(null);
    const { aiSearchWine } = await import("@/server/actions/ai");
    const result = await aiSearchWine("Bordeaux", undefined);
    expect(result).toMatchObject({ success: false, error: "Unauthorized" });
    expect(requireFeatureSpy).not.toHaveBeenCalled();
    expect(reserveAiCreditsSpy).not.toHaveBeenCalled();
  });

  it("demo mode: skips gate entirely, uses provider mock", async () => {
    isDemoRequestSpy.mockResolvedValue(true);
    const { aiSearchWine } = await import("@/server/actions/ai");
    const result = await aiSearchWine("Bordeaux", undefined);
    expect(result.success).toBe(true);
    expect(getAuthenticatedUserIdSpy).not.toHaveBeenCalled();
    expect(requireFeatureSpy).not.toHaveBeenCalled();
    expect(reserveAiCreditsSpy).not.toHaveBeenCalled();
  });
});

describe("aiSearchWine — refund flow", () => {
  it("AI throws → refundOnFailure called, error returned", async () => {
    getAuthenticatedUserIdSpy.mockResolvedValueOnce("u1");
    searchWineSpy.mockRejectedValueOnce(new Error("Gemini timed out"));
    const { aiSearchWine } = await import("@/server/actions/ai");
    const result = await aiSearchWine("Bordeaux");
    expect(result.success).toBe(false);
    expect(refundOnFailureSpy).toHaveBeenCalledTimes(1);
  });

  it("AI throws + refund itself fails → original error still returned, no crash", async () => {
    getAuthenticatedUserIdSpy.mockResolvedValueOnce("u1");
    searchWineSpy.mockRejectedValueOnce(new Error("Gemini timed out"));
    refundOnFailureSpy.mockRejectedValueOnce(new Error("refund DB write failed"));
    const { aiSearchWine } = await import("@/server/actions/ai");
    const result = await aiSearchWine("Bordeaux");
    expect(result.success).toBe(false);
    if (!result.success) {
      // Should NOT be the refund error message — original AI failure surfaces.
      expect(result.error).not.toBe("refund DB write failed");
    }
  });

  it("TierError(CREDITS_EXHAUSTED) from reservation → returns code:CREDITS_EXHAUSTED", async () => {
    getAuthenticatedUserIdSpy.mockResolvedValueOnce("u1");
    reserveAiCreditsSpy.mockResolvedValueOnce({
      ok: false,
      reason: "CREDITS_EXHAUSTED",
      remaining: 0,
      tier: "PRO",
      message: "Out of credits",
    });
    const { aiSearchWine } = await import("@/server/actions/ai");
    const result = await aiSearchWine("Bordeaux");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("CREDITS_EXHAUSTED");
    }
    // AI provider should NOT have been called.
    expect(searchWineSpy).not.toHaveBeenCalled();
    // refund should NOT be called — reservation was never made.
    expect(refundOnFailureSpy).not.toHaveBeenCalled();
  });

  it("requireFeature throws UPGRADE_REQUIRED → code surfaces, no AI call, no refund", async () => {
    getAuthenticatedUserIdSpy.mockResolvedValueOnce("u1");
    requireFeatureSpy.mockRejectedValueOnce(
      new MockTierError("UPGRADE_REQUIRED", "PRO", "Upgrade")
    );
    const { aiSearchWine } = await import("@/server/actions/ai");
    const result = await aiSearchWine("Bordeaux");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("UPGRADE_REQUIRED");
    expect(searchWineSpy).not.toHaveBeenCalled();
    expect(refundOnFailureSpy).not.toHaveBeenCalled();
  });
});

describe("aiBarcodeLookup", () => {
  it("cache hit: returns cached data, no reservation, no AI call", async () => {
    barcodeFindUniqueSpy.mockResolvedValueOnce({
      barcode: "0123456789012",
      data: { name: "Cached Wine", winery: "CW" },
    });
    const { aiBarcodeLookup } = await import("@/server/actions/ai");
    const result = await aiBarcodeLookup("0123456789012", "u1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ name: "Cached Wine" });
    }
    expect(reserveAiCreditsSpy).not.toHaveBeenCalled();
    expect(searchWineSpy).not.toHaveBeenCalled();
    expect(getAuthenticatedUserIdSpy).not.toHaveBeenCalled();
  });

  it("verified userId beats client-supplied id for the gate", async () => {
    barcodeFindUniqueSpy.mockResolvedValueOnce(null);
    getAuthenticatedUserIdSpy.mockResolvedValueOnce("verified");
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("OFF down"));
    const { aiBarcodeLookup } = await import("@/server/actions/ai");
    await aiBarcodeLookup("9990000000001", "client-spoof");
    expect(reserveAiCreditsSpy).toHaveBeenCalledWith("verified", "auto_fill", 1);
  });

  it("anonymous (no cookie + no client) → Unauthorized, no AI call", async () => {
    barcodeFindUniqueSpy.mockResolvedValueOnce(null);
    getAuthenticatedUserIdSpy.mockResolvedValueOnce(null);
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("OFF down"));
    const { aiBarcodeLookup } = await import("@/server/actions/ai");
    const result = await aiBarcodeLookup("8880000000002", undefined);
    expect(result).toMatchObject({ success: false, error: "Unauthorized" });
    expect(searchWineSpy).not.toHaveBeenCalled();
  });

  it("cache miss + Open Food Facts fails → AI fallback builds gate, reserves credits", async () => {
    barcodeFindUniqueSpy.mockResolvedValueOnce(null);
    getAuthenticatedUserIdSpy.mockResolvedValueOnce("u1");
    // Stub global fetch so the OFF call cleanly fails to "no wine".
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("OFF down"));
    const { aiBarcodeLookup } = await import("@/server/actions/ai");
    const result = await aiBarcodeLookup("0123456789012", "u1");
    expect(result.success).toBe(true);
    expect(requireFeatureSpy).toHaveBeenCalledWith("u1", "barcodeAiLookup");
    expect(reserveAiCreditsSpy).toHaveBeenCalledWith("u1", "auto_fill", 1);
    expect(searchWineSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("rejects an implausible barcode before any cache/fetch/AI", async () => {
    const { aiBarcodeLookup } = await import("@/server/actions/ai");
    const result = await aiBarcodeLookup("../etc/passwd", "u1");
    expect(result).toMatchObject({ success: false, error: "Invalid barcode" });
    expect(barcodeFindUniqueSpy).not.toHaveBeenCalled();
    expect(searchWineSpy).not.toHaveBeenCalled();
  });
});
