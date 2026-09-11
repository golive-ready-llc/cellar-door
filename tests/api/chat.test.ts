import { describe, it, expect, vi, beforeEach } from "vitest";

/** POST /api/chat streams CellarChat replies with the same gates as the server action. */

const h = vi.hoisted(() => {
  class TierError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    TierError,
    authSpy: vi.fn(),
    demoSpy: vi.fn(),
    requireFeatureSpy: vi.fn(),
    reserveSpy: vi.fn(),
    refundSpy: vi.fn(),
    streamSpy: vi.fn(),
  };
});

vi.mock("@/server/auth-guard", () => ({ getAuthenticatedUserId: () => h.authSpy() }));
vi.mock("@/lib/demo", () => ({ isDemoRequest: () => h.demoSpy() }));
vi.mock("@/server/tier-check", () => ({
  requireFeature: (...a: unknown[]) => h.requireFeatureSpy(...a),
  reserveAiCredits: (...a: unknown[]) => h.reserveSpy(...a),
  TierError: h.TierError,
}));
vi.mock("@/lib/ai", () => ({
  getAIProvider: async () => ({
    chat: async () => "unused",
    chatStream: (...a: unknown[]) => h.streamSpy(...a),
  }),
}));
vi.mock("@/lib/ai/mock", () => ({
  MockAIProvider: class {
    async chat() {
      return "demo reply";
    }
    async *chatStream() {
      yield "demo ";
      yield "reply";
    }
  },
}));
vi.mock("@/lib/ai/context", () => ({ buildCellarContext: () => "CELLAR" }));

import { POST } from "@/app/api/chat/route";
import { CHAT_STREAM_ERROR } from "@/lib/ai/chat-prompt";

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body) }));
const BODY = { messages: [{ role: "user", content: "What should I open tonight?" }], wines: [] };

beforeEach(() => {
  vi.clearAllMocks();
  h.demoSpy.mockResolvedValue(false);
  h.authSpy.mockResolvedValue("u1");
  h.requireFeatureSpy.mockResolvedValue("PRO");
  h.refundSpy.mockResolvedValue(undefined);
  h.reserveSpy.mockResolvedValue({ ok: true, tier: "PRO", remaining: 10, chargedMonthly: 1, chargedExtra: 0, refundOnFailure: h.refundSpy });
  h.streamSpy.mockImplementation(async function* () {
    yield "Try the ";
    yield "Barolo.";
  });
});

describe("POST /api/chat", () => {
  it("requires a session", async () => {
    h.authSpy.mockResolvedValue(null);
    const res = await post(BODY);
    expect(res.status).toBe(401);
    expect(h.reserveSpy).not.toHaveBeenCalled();
  });

  it("rejects callers without the chat feature", async () => {
    h.requireFeatureSpy.mockRejectedValue(new h.TierError("UPGRADE_REQUIRED", "Upgrade to chat"));
    const res = await post(BODY);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "UPGRADE_REQUIRED" });
  });

  it("reports exhausted credits without calling the model", async () => {
    h.reserveSpy.mockResolvedValue({ ok: false, reason: "CREDITS_EXHAUSTED", remaining: 0, tier: "PRO", message: "Out of credits" });
    const res = await post(BODY);
    expect(res.status).toBe(402);
    expect(h.streamSpy).not.toHaveBeenCalled();
  });

  it("rejects malformed messages", async () => {
    const res = await post({ messages: [{ role: "system", content: "x" }], wines: [] });
    expect(res.status).toBe(400);
  });

  it("streams the reply after reserving one credit", async () => {
    const res = await post(BODY);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Try the Barolo.");
    expect(h.reserveSpy).toHaveBeenCalledWith("u1", "chat", 1);
    expect(h.refundSpy).not.toHaveBeenCalled();
  });

  it("refunds the credit when the model fails before replying", async () => {
    h.streamSpy.mockImplementation(async function* () {
      if (Date.now() > 0) throw new Error("model down");
      yield "";
    });
    const res = await post(BODY);
    expect(await res.text()).toBe(CHAT_STREAM_ERROR);
    expect(h.refundSpy).toHaveBeenCalledTimes(1);
  });

  it("streams the demo reply without a session or credits", async () => {
    h.demoSpy.mockResolvedValue(true);
    h.authSpy.mockResolvedValue(null);
    const res = await post(BODY);
    expect(await res.text()).toBe("demo reply");
    expect(h.reserveSpy).not.toHaveBeenCalled();
  });
});
