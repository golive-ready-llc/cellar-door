import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for `@/server/actions/taste-profile` — generateTasteProfile.
 *
 * Mocks Prisma, tier-check, the auth resolver, the prompt helper, and the
 * dynamically-imported Gemini SDK. The action does a `await import()` of
 * `@google/genai` and `@/generated/prisma/client` so we mock those too.
 */

process.env.DATABASE_URL = "postgresql://stub";

const wineFindMany = vi.fn();
const wineHistoryFindMany = vi.fn();
const cacheFindUnique = vi.fn();
const cacheUpsert = vi.fn().mockResolvedValue({});
const resolveServerUserIdSpy = vi.fn();
const requireFeatureSpy = vi.fn().mockResolvedValue("PRO");
const reserveAiCreditsSpy = vi.fn();
const refundOnFailureSpy = vi.fn().mockResolvedValue(undefined);
const generateContentSpy = vi.fn();

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

vi.mock("@/lib/db", () => ({
  prisma: {
    wine: { findMany: (...a: unknown[]) => wineFindMany(...a) },
    wineHistory: { findMany: (...a: unknown[]) => wineHistoryFindMany(...a) },
    tasteProfileCache: {
      findUnique: (...a: unknown[]) => cacheFindUnique(...a),
      upsert: (...a: unknown[]) => cacheUpsert(...a),
    },
  },
}));

vi.mock("@/server/auth-guard", () => ({
  resolveServerUserId: (...a: unknown[]) => resolveServerUserIdSpy(...a),
  getAuthenticatedUserId: vi.fn(),
}));

vi.mock("@/server/tier-check", () => ({
  requireFeature: (...a: unknown[]) => requireFeatureSpy(...a),
  reserveAiCredits: (...a: unknown[]) => reserveAiCreditsSpy(...a),
  TierError: MockTierError,
}));

vi.mock("@/lib/ai", () => ({
  getAIProvider: () => ({}),
  isAIAvailable: () => true,
}));

vi.mock("@/lib/ai/prompts", () => ({
  tasteProfilePrompt: () => "PROMPT",
  vintageStoryPrompt: () => "STORY",
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: (...a: unknown[]) => generateContentSpy(...a),
    };
  },
}));

vi.mock("@/generated/prisma/client", () => ({
  Prisma: { JsonNull: Symbol("JsonNull") },
}));

beforeEach(() => {
  vi.clearAllMocks();
  resolveServerUserIdSpy.mockResolvedValue("u1");
  requireFeatureSpy.mockResolvedValue("PRO");
  reserveAiCreditsSpy.mockResolvedValue({
    ok: true,
    tier: "PRO",
    remaining: 299,
    chargedMonthly: 1,
    chargedExtra: 0,
    refundOnFailure: refundOnFailureSpy,
  });
  refundOnFailureSpy.mockResolvedValue(undefined);
  cacheFindUnique.mockResolvedValue(null);
  wineHistoryFindMany.mockResolvedValue([]);
  process.env.GEMINI_API_KEY = "test-key";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function makeWines(n: number, type = "red") {
  return Array.from({ length: n }, (_, i) => ({
    id: `w${i}`,
    name: `Wine ${i}`,
    winery: `W${i}`,
    vintage: 2020,
    type,
    region: "R",
    grapeVariety: "G",
    userRating: 4,
  }));
}

const fullSlice = {
  body: 7,
  tannin: 6,
  acidity: 5,
  sweetness: 2,
  fruit: 7,
  oak: 5,
  summary: "ok",
};

describe("generateTasteProfile", () => {
  it("<3 wines → error, no reservation, no AI call", async () => {
    wineFindMany.mockResolvedValueOnce(makeWines(2));
    const { generateTasteProfile } = await import(
      "@/server/actions/taste-profile"
    );
    const result = await generateTasteProfile("u1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/at least 3 wines/i);
    }
    expect(reserveAiCreditsSpy).not.toHaveBeenCalled();
    expect(generateContentSpy).not.toHaveBeenCalled();
  });

  it("cache hit (matching fingerprint) → cached bundle, no reservation, no AI", async () => {
    const wines = makeWines(5);
    wineFindMany.mockResolvedValueOnce(wines);
    // First call computes the fingerprint we need to feed back into cache.
    // Easier: stub findUnique to return whatever fingerprint the action
    // computes by intercepting the upsert call from a prior run. Simpler
    // here: bypass by capturing the fingerprint via a second arrange step.
    // Instead, run once with no cache to capture the fingerprint, then
    // re-run with cache returning that fingerprint.
    cacheFindUnique.mockResolvedValueOnce(null);
    generateContentSpy.mockResolvedValueOnce({
      text: JSON.stringify({ all: fullSlice, red: fullSlice, white: null }),
    });
    const mod = await import("@/server/actions/taste-profile");
    await mod.generateTasteProfile("u1");
    const fp = cacheUpsert.mock.calls[0][0].create.collectionFingerprint;

    // Second run: cache hits.
    wineFindMany.mockResolvedValueOnce(wines);
    cacheFindUnique.mockResolvedValueOnce({
      collectionFingerprint: fp,
      all: fullSlice,
      red: fullSlice,
      white: null,
    });
    reserveAiCreditsSpy.mockClear();
    generateContentSpy.mockClear();
    const result = await mod.generateTasteProfile("u1");
    expect(result.success).toBe(true);
    expect(reserveAiCreditsSpy).not.toHaveBeenCalled();
    expect(generateContentSpy).not.toHaveBeenCalled();
  });

  it("cache miss + force=true → bypasses cache, calls AI, writes new fingerprint", async () => {
    wineFindMany.mockResolvedValueOnce(makeWines(5));
    cacheFindUnique.mockResolvedValue({
      collectionFingerprint: "stale",
      all: fullSlice,
      red: null,
      white: null,
    });
    generateContentSpy.mockResolvedValueOnce({
      text: JSON.stringify({ all: fullSlice, red: fullSlice, white: null }),
    });
    const { generateTasteProfile } = await import(
      "@/server/actions/taste-profile"
    );
    const result = await generateTasteProfile("u1", { force: true });
    expect(result.success).toBe(true);
    expect(generateContentSpy).toHaveBeenCalledTimes(1);
    expect(reserveAiCreditsSpy).toHaveBeenCalledWith("u1", "enrich_text", 1);
    expect(cacheUpsert).toHaveBeenCalled();
  });

  it("malformed AI JSON wrapped in fenced block → fenced extraction works", async () => {
    wineFindMany.mockResolvedValueOnce(makeWines(5));
    generateContentSpy.mockResolvedValueOnce({
      text: "Here is your profile:\n```json\n" +
        JSON.stringify({ all: fullSlice, red: null, white: null }) +
        "\n```\n",
    });
    const { generateTasteProfile } = await import(
      "@/server/actions/taste-profile"
    );
    const result = await generateTasteProfile("u1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.all.body).toBe(7);
    }
  });

  it("AI returns red/white slices but inputs <3 → action force-nulls those slices", async () => {
    // 5 reds, 0 whites → red slice should be present, white must be nulled.
    wineFindMany.mockResolvedValueOnce(makeWines(5, "red"));
    generateContentSpy.mockResolvedValueOnce({
      text: JSON.stringify({
        all: fullSlice,
        red: fullSlice,
        white: fullSlice, // model lied — only 0 whites in input
      }),
    });
    const { generateTasteProfile } = await import(
      "@/server/actions/taste-profile"
    );
    const result = await generateTasteProfile("u1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.white).toBeNull(); // forced null
      expect(result.data.red).not.toBeNull();
    }
  });

  it("reservation refunded if AI throws", async () => {
    wineFindMany.mockResolvedValueOnce(makeWines(5));
    generateContentSpy.mockRejectedValueOnce(new Error("Gemini 500"));
    const { generateTasteProfile } = await import(
      "@/server/actions/taste-profile"
    );
    const result = await generateTasteProfile("u1");
    expect(result.success).toBe(false);
    expect(refundOnFailureSpy).toHaveBeenCalledTimes(1);
  });

  it("CREDITS_EXHAUSTED reservation → no AI call, returns code", async () => {
    wineFindMany.mockResolvedValueOnce(makeWines(5));
    reserveAiCreditsSpy.mockResolvedValueOnce({
      ok: false,
      reason: "CREDITS_EXHAUSTED",
      remaining: 0,
      tier: "PRO",
      message: "Out of credits",
    });
    const { generateTasteProfile } = await import(
      "@/server/actions/taste-profile"
    );
    const result = await generateTasteProfile("u1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("CREDITS_EXHAUSTED");
    expect(generateContentSpy).not.toHaveBeenCalled();
    expect(refundOnFailureSpy).not.toHaveBeenCalled();
  });

  it("no GEMINI_API_KEY → mock bundle, zero credit charge", async () => {
    delete process.env.GEMINI_API_KEY;
    wineFindMany.mockResolvedValueOnce(makeWines(5));
    const { generateTasteProfile } = await import(
      "@/server/actions/taste-profile"
    );
    const result = await generateTasteProfile("u1");
    expect(result.success).toBe(true);
    if (result.success) expect(result.isMock).toBe(true);
    expect(reserveAiCreditsSpy).not.toHaveBeenCalled();
    expect(generateContentSpy).not.toHaveBeenCalled();
  });
});
