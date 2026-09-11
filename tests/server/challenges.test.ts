import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * generateWeeklyChallenge calls a paid AI model. It must enforce the paid
 * tier and reserve a credit itself: exported server actions are public
 * endpoints, so hiding the button in the UI is not enough.
 */

process.env.DATABASE_URL = "postgresql://stub";
process.env.GEMINI_API_KEY = "test-key";

const resolveServerUserIdSpy = vi.fn();
const requireFeatureSpy = vi.fn();
const reserveAiCreditsSpy = vi.fn();
const refundSpy = vi.fn();
const generateContentSpy = vi.fn();
const challengeCreateSpy = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    wine: { findMany: () => Promise.resolve([]) },
    wineHistory: { findMany: () => Promise.resolve([]) },
    challenge: {
      findMany: () => Promise.resolve([]),
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
vi.mock("@/lib/ai", () => ({ isAIAvailable: () => Promise.resolve(true) }));
vi.mock("@/lib/ai/prompts", () => ({ challengePrompt: () => "prompt" }));
vi.mock("@/lib/demo", () => ({ isDemoRequest: () => Promise.resolve(false) }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: (...a: unknown[]) => generateContentSpy(...a) };
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  resolveServerUserIdSpy.mockResolvedValue("u1");
  requireFeatureSpy.mockResolvedValue("PRO");
  refundSpy.mockResolvedValue(undefined);
  reserveAiCreditsSpy.mockResolvedValue({
    ok: true,
    tier: "PRO",
    remaining: 299,
    chargedMonthly: 1,
    chargedExtra: 0,
    refundOnFailure: refundSpy,
  });
  generateContentSpy.mockResolvedValue({
    text: JSON.stringify({ title: "AI title", description: "AI desc", type: "explore", criteria: {} }),
  });
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
    expect(generateContentSpy).not.toHaveBeenCalled();
    expect(challengeCreateSpy).not.toHaveBeenCalled();
  });

  it("reserves a credit, then uses the AI result", async () => {
    const { generateWeeklyChallenge } = await import("@/server/actions/challenges");
    const challenge = await generateWeeklyChallenge("u1");
    expect(reserveAiCreditsSpy).toHaveBeenCalledWith("u1", "enrich_text", 1);
    expect(generateContentSpy).toHaveBeenCalledTimes(1);
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
    expect(generateContentSpy).not.toHaveBeenCalled();
    expect(challenge.title).toBeTruthy();
    expect(challenge.title).not.toBe("AI title");
    expect(refundSpy).not.toHaveBeenCalled();
  });

  it("refunds the credit when the AI call fails", async () => {
    generateContentSpy.mockRejectedValue(new Error("Gemini down"));
    const { generateWeeklyChallenge } = await import("@/server/actions/challenges");
    const challenge = await generateWeeklyChallenge("u1");
    expect(refundSpy).toHaveBeenCalledTimes(1);
    expect(challenge.title).toBeTruthy();
  });
});
