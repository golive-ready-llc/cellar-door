import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for `@/server/actions/chat` — chatWithSommelier.
 *
 * Covers tier gate, atomic credit reservation, refund-on-failure, and
 * demo-mode bypass. Uses the mock provider path (no real Gemini).
 */

process.env.DATABASE_URL = "postgresql://stub";

const isDemoRequestSpy = vi.fn().mockResolvedValue(false);
const getAuthenticatedUserIdSpy = vi.fn().mockResolvedValue(null as string | null);
const requireFeatureSpy = vi.fn().mockResolvedValue("PRO");
const reserveAiCreditsSpy = vi.fn();
const refundOnFailureSpy = vi.fn().mockResolvedValue(undefined);
const buildCellarContextSpy = vi.fn().mockReturnValue("CELLAR CONTEXT");
const isAIAvailableSpy = vi.fn().mockReturnValue(false);
// chatWithSommelier now calls getAIProvider().chat(systemPrompt, messages) via
// the ProviderRouter. The provider mock must expose a chat() method or the
// success path throws "provider.chat is not a function".
const chatSpy = vi.fn().mockResolvedValue("Mock sommelier reply");

class MockGeminiProvider {}

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

vi.mock("@/lib/demo", () => ({
  isDemoRequest: () => isDemoRequestSpy(),
  DEMO_COOKIE: "demo_mode",
  assertNotDemo: vi.fn(),
}));

vi.mock("@/server/auth-guard", () => ({
  getAuthenticatedUserId: () => getAuthenticatedUserIdSpy(),
  resolveServerUserId: async (id?: string | null) => {
    const authId = await getAuthenticatedUserIdSpy();
    if (authId) return authId;
    if (id) return id;
    throw new Error("Unauthorized");
  },
}));

vi.mock("@/server/tier-check", () => ({
  requireFeature: (...a: unknown[]) => requireFeatureSpy(...a),
  reserveAiCredits: (...a: unknown[]) => reserveAiCreditsSpy(...a),
  TierError: MockTierError,
}));

vi.mock("@/lib/ai", () => ({
  getAIProvider: () => ({ chat: (...a: unknown[]) => chatSpy(...a) }),
  isAIAvailable: () => isAIAvailableSpy(),
}));

vi.mock("@/lib/ai/gemini", () => ({
  GeminiProvider: MockGeminiProvider,
}));

vi.mock("@/lib/ai/context", () => ({
  buildCellarContext: (...a: unknown[]) => buildCellarContextSpy(...a),
}));

beforeEach(() => {
  vi.clearAllMocks();
  isDemoRequestSpy.mockResolvedValue(false);
  getAuthenticatedUserIdSpy.mockResolvedValue(null);
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
  chatSpy.mockResolvedValue("Mock sommelier reply");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const wines = [{ id: "w1", name: "Test", winery: "TW", vintage: 2020, type: "red", disposition: "D" }] as unknown as import("@/types/wine").Wine[];

describe("chatWithSommelier", () => {
  it("demo mode skips auth + reservation entirely", async () => {
    isDemoRequestSpy.mockResolvedValue(true);
    const { chatWithSommelier } = await import("@/server/actions/chat");
    const result = await chatWithSommelier(
      [{ role: "user", content: "hello" }],
      wines
    );
    expect(result.success).toBe(true);
    expect(getAuthenticatedUserIdSpy).not.toHaveBeenCalled();
    expect(requireFeatureSpy).not.toHaveBeenCalled();
    expect(reserveAiCreditsSpy).not.toHaveBeenCalled();
  });

  it("authenticated: requireFeature('cellarChat') → reserve('chat',1) → success no refund", async () => {
    getAuthenticatedUserIdSpy.mockResolvedValueOnce("verified-uid");
    const { chatWithSommelier } = await import("@/server/actions/chat");
    const result = await chatWithSommelier(
      [{ role: "user", content: "recommend something" }],
      wines
    );
    expect(result.success).toBe(true);
    expect(requireFeatureSpy).toHaveBeenCalledWith("verified-uid", "cellarChat");
    expect(reserveAiCreditsSpy).toHaveBeenCalledWith("verified-uid", "chat", 1);
    expect(refundOnFailureSpy).not.toHaveBeenCalled();
  });

  it("token resolution falls back to clientUserId when cookie missing", async () => {
    getAuthenticatedUserIdSpy.mockResolvedValueOnce(null);
    const { chatWithSommelier } = await import("@/server/actions/chat");
    const result = await chatWithSommelier(
      [{ role: "user", content: "hi" }],
      wines,
      "client-uid"
    );
    expect(result.success).toBe(true);
    expect(requireFeatureSpy).toHaveBeenCalledWith("client-uid", "cellarChat");
  });

  it("anonymous (no cookie + no client) → Unauthorized", async () => {
    getAuthenticatedUserIdSpy.mockResolvedValueOnce(null);
    const { chatWithSommelier } = await import("@/server/actions/chat");
    const result = await chatWithSommelier(
      [{ role: "user", content: "hi" }],
      wines
    );
    expect(result).toMatchObject({ success: false, error: "Unauthorized" });
    expect(requireFeatureSpy).not.toHaveBeenCalled();
    expect(reserveAiCreditsSpy).not.toHaveBeenCalled();
  });

  it("AI throws → refund called", async () => {
    getAuthenticatedUserIdSpy.mockResolvedValueOnce("u1");
    // Force the success path through the mock branch to throw by making
    // buildCellarContext throw — chat catches anything after the reserve.
    buildCellarContextSpy.mockImplementationOnce(() => {
      throw new Error("context build failed");
    });
    const { chatWithSommelier } = await import("@/server/actions/chat");
    const result = await chatWithSommelier(
      [{ role: "user", content: "hi" }],
      wines
    );
    expect(result.success).toBe(false);
    expect(refundOnFailureSpy).toHaveBeenCalledTimes(1);
  });

  it("CREDITS_EXHAUSTED reservation → returns code:CREDITS_EXHAUSTED, no AI work", async () => {
    getAuthenticatedUserIdSpy.mockResolvedValueOnce("u1");
    reserveAiCreditsSpy.mockResolvedValueOnce({
      ok: false,
      reason: "CREDITS_EXHAUSTED",
      remaining: 0,
      tier: "PRO",
      message: "Out of credits",
    });
    const { chatWithSommelier } = await import("@/server/actions/chat");
    const result = await chatWithSommelier(
      [{ role: "user", content: "hi" }],
      wines
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("CREDITS_EXHAUSTED");
    // No reservation refund — reservation never succeeded.
    expect(refundOnFailureSpy).not.toHaveBeenCalled();
  });

  it("UPGRADE_REQUIRED from requireFeature → no reservation, no refund", async () => {
    getAuthenticatedUserIdSpy.mockResolvedValueOnce("u1");
    requireFeatureSpy.mockRejectedValueOnce(
      new MockTierError("UPGRADE_REQUIRED", "PRO", "Upgrade to PRO")
    );
    const { chatWithSommelier } = await import("@/server/actions/chat");
    const result = await chatWithSommelier(
      [{ role: "user", content: "hi" }],
      wines
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("UPGRADE_REQUIRED");
    expect(reserveAiCreditsSpy).not.toHaveBeenCalled();
    expect(refundOnFailureSpy).not.toHaveBeenCalled();
  });
});
