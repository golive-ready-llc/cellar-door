import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.DATABASE_URL = "postgresql://stub";

// Deterministic providers: an instance whose apiKey is "dead" rejects with the
// exact error shapes real providers throw; any other key succeeds.
vi.mock("@/lib/ai/deepseek", () => ({
  OpenAICompatibleProvider: class {
    apiKey: string;
    constructor({ config }: { config: { apiKey: string } }) { this.apiKey = config.apiKey; }
    chat = vi.fn(async () => {
      if (this.apiKey === "dead") throw new Error("deepseek API error 401: Authentication Fails");
      if (this.apiKey === "leaky") throw new Error("deepseek API error 401 (key sk-abcdef1234567890)");
      return "failover-reply";
    });
  },
}));

import { ProviderRouter } from "@/lib/ai/provider-router";

const slot = (provider: string, apiKey: string) => ({ provider, apiKey, model: "", baseUrl: "" });
const emptySlot = { provider: "", apiKey: "", model: "", baseUrl: "" };

function routerConfig(overrides: Record<string, unknown>) {
  return {
    text: emptySlot, textFailover: emptySlot,
    vision: emptySlot, visionFailover: emptySlot,
    enabled: true,
    ...overrides,
  } as never;
}

describe("router failover logging", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("logs the primary provider's error when a text call falls back", async () => {
    // Regression: a dead primary key silently fell back for months because the
    // primary's error was discarded — only the failover's error ever surfaced.
    const router = new ProviderRouter(routerConfig({
      text: slot("deepseek", "dead"),
      textFailover: slot("deepseek", "good"),
    }));
    const reply = await router.chat("sys", [{ role: "user", content: "hi" }]);
    expect(reply).toBe("failover-reply");
    expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls[0][0] as string;
    expect(line).toContain("deepseek");          // provider label
    expect(line).toContain("401");               // the primary's actual error
  });

  it("logs when a chatStream provider fails before yielding and another is tried", async () => {
    const router = new ProviderRouter(routerConfig({
      text: slot("deepseek", "dead"),
      textFailover: slot("deepseek", "good"),
    }));
    const chunks: string[] = [];
    for await (const chunk of router.chatStream("sys", [{ role: "user", content: "hi" }])) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(["failover-reply"]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("401");
  });

  it("redacts key-shaped strings from the logged error", async () => {
    const router = new ProviderRouter(routerConfig({
      text: slot("deepseek", "leaky"),
      textFailover: slot("deepseek", "good"),
    }));
    await router.chat("sys", [{ role: "user", content: "hi" }]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).not.toContain("sk-abcdef1234567890");
    expect(warn.mock.calls[0][0]).toContain("[redacted]");
  });

  it("does not log when there is no failover (the error propagates to the caller)", async () => {
    const router = new ProviderRouter(routerConfig({ text: slot("deepseek", "dead") }));
    await expect(router.chat("sys", [{ role: "user", content: "hi" }])).rejects.toThrow(/401/);
    expect(warn).not.toHaveBeenCalled();
  });
});
