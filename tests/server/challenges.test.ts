import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * generateWeeklyChallenge calls a paid AI model. It must enforce the paid
 * tier and reserve a credit itself: exported server actions are public
 * endpoints, so hiding the button in the UI is not enough.
 */

process.env.DATABASE_URL = "postgresql://stub";

const resolveServerUserIdSpy = vi.fn();
const requireFeatureSpy = vi.fn();
const reserveAiCreditsSpy = vi.fn();
const refundSpy = vi.fn();
const completeJSONSpy = vi.fn();
const challengeCreateSpy = vi.fn();
const challengeFindManySpy = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    wine: { findMany: () => Promise.resolve([]) },
    wineHistory: { findMany: () => Promise.resolve([]) },
    challenge: {
      findMany: (...a: unknown[]) => challengeFindManySpy(...a),
      create: (...a: unknown[]) => challengeCreateSpy(...a),
    },
  },
}));
vi.mock("@/server/auth-guard", () => ({
  resolveServerUserId: (id?: string) => resolveServerUserIdSpy(id),
}));
vi.mock("@/server/tier-check", () => ({
  requireFeature: (...a: unknown[]) => requireFeatureSpy(...a),
  reserveAiCredits: (...a: unknown[]) => reserveAiCreditsSpy(...a),
}));
vi.mock("@/lib/ai", () => ({
  isTextAIAvailable: () => Promise.resolve(true),
  getAIProvider: async () => ({ completeJSON: (...a: unknown[]) => completeJSONSpy(...a) }),
}));
vi.mock("@/lib/ai/prompts", () => ({ challengePrompt: () => "prompt" }));
vi.mock("@/lib/demo", () => ({ isDemoRequest: () => Promise.resolve(false) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  resolveServerUserIdSpy.mockResolvedValue("u1");
  requireFeatureSpy.mockResolvedValue("PRO");
  challengeFindManySpy.mockResolvedValue([]);
  refundSpy.mockResolvedValue(undefined);
  reserveAiCreditsSpy.mockResolvedValue({
    ok: true,
    tier: "PRO",
    remaining: 299,
    chargedMonthly: 1,
    chargedExtra: 0,
    refundOnFailure: refundSpy,
  });
  completeJSONSpy.mockResolvedValue(
    JSON.stringify({ title: "AI title", description: "AI desc", type: "explore", criteria: {} })
  );
  challengeCreateSpy.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "c1",
    ...data,
  }));
});

describe("generateWeeklyChallenge", () => {
  it("rejects Free-tier callers before any AI call or credit use", async () => {
    requireFeatureSpy.mockRejectedValue(new Error("UPGRADE_REQUIRED"));
    const { generateWeeklyChallenge } = await import("@/server/actions/challenges");
    await expect(generateWeeklyChallenge("u1")).rejects.toThrow("UPGRADE_REQUIRED");
    expect(requireFeatureSpy).toHaveBeenCalledWith("u1", "aiEnabled");
    expect(reserveAiCreditsSpy).not.toHaveBeenCalled();
    expect(completeJSONSpy).not.toHaveBeenCalled();
    expect(challengeCreateSpy).not.toHaveBeenCalled();
  });

  it("reserves a credit, then uses the AI result", async () => {
    const { generateWeeklyChallenge } = await import("@/server/actions/challenges");
    const challenge = await generateWeeklyChallenge("u1");
    expect(reserveAiCreditsSpy).toHaveBeenCalledWith("u1", "enrich_text", 1);
    // Through the configured provider, not Gemini directly (spend cap, 2026-10-27).
    expect(completeJSONSpy).toHaveBeenCalledWith("prompt", 0.8);
    expect(challenge.title).toBe("AI title");
    expect(refundSpy).not.toHaveBeenCalled();
  });

  it("out of credits: no AI call, deterministic fallback challenge", async () => {
    reserveAiCreditsSpy.mockResolvedValue({
      ok: false,
      reason: "CREDITS_EXHAUSTED",
      remaining: 0,
      tier: "PRO",
      message: "Out of credits",
    });
    const { generateWeeklyChallenge } = await import("@/server/actions/challenges");
    const challenge = await generateWeeklyChallenge("u1");
    expect(completeJSONSpy).not.toHaveBeenCalled();
    expect(challenge.title).toBeTruthy();
    expect(challenge.title).not.toBe("AI title");
    expect(refundSpy).not.toHaveBeenCalled();
  });

  it("refunds the credit when the AI call fails", async () => {
    completeJSONSpy.mockRejectedValue(new Error("Provider down"));
    const { generateWeeklyChallenge } = await import("@/server/actions/challenges");
    const challenge = await generateWeeklyChallenge("u1");
    expect(refundSpy).toHaveBeenCalledTimes(1);
    expect(challenge.title).toBeTruthy();
  });
});

describe("getUserStreak — ISO week math", () => {
  // The streak walk-back reconstructs each previous week from its label as
  // Jan 1 + (week-1)*7. getISOWeek used to anchor at Jan 4 without the
  // weekday term, so in years that don't start on a Monday (2025, 2026, …)
  // every label was one low and the walk-back skipped every other week —
  // a 6-week streak counted 3. These tests pin real-calendar sequences.
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts every consecutive week (2026 starts on a Thursday)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 8, 12)); // Sunday inside ISO 2026-W45
    challengeFindManySpy.mockResolvedValue(
      [0, 1, 2, 3, 4, 5].map((w) => ({
        completedAt: new Date(2026, 10, 8 - 7 * w, 12),
        createdAt: new Date(2026, 10, 8 - 7 * w, 12),
      }))
    );
    const { getUserStreak } = await import("@/server/actions/challenges");
    expect(await getUserStreak("u1")).toBe(6);
  });

  it("walks across the year boundary without a phantom W00", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 14, 12)); // Wednesday inside ISO 2026-W03
    challengeFindManySpy.mockResolvedValue([
      { completedAt: new Date(2026, 0, 14, 12), createdAt: new Date(2026, 0, 14, 12) }, // W03
      { completedAt: new Date(2026, 0, 7, 12), createdAt: new Date(2026, 0, 7, 12) }, // W02
      // Dec 31 2025 is Wednesday of ISO 2026-W01: the week belongs to 2026.
      { completedAt: new Date(2025, 11, 31, 12), createdAt: new Date(2025, 11, 31, 12) },
    ]);
    const { getUserStreak } = await import("@/server/actions/challenges");
    expect(await getUserStreak("u1")).toBe(3);
  });
});
