import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.DATABASE_URL = "postgresql://stub";

// GeminiProvider instances are markers — we only test ROUTING, not calls.
vi.mock("@/lib/ai/gemini", () => ({
  GeminiProvider: class {
    key: string;
    constructor(key: string) { this.key = key; }
    fetchWineImage = vi.fn().mockResolvedValue({ imageUrl: "https://img", source: "google" });
  },
}));

import { OpenAICompatibleProvider } from "@/lib/ai/deepseek";
import { ProviderRouter } from "@/lib/ai/provider-router";

const WINE = { name: "W", winery: "Y", vintage: 2020, type: "red", region: "", country: "", grapeVariety: "" } as never;

const slot = (provider: string, apiKey = "k") => ({ provider, apiKey, model: "", baseUrl: "" });
const emptySlot = { provider: "", apiKey: "", model: "", baseUrl: "" };

function routerConfig(overrides: Record<string, unknown>) {
  return {
    text: emptySlot, textFailover: emptySlot,
    vision: emptySlot, visionFailover: emptySlot,
    enabled: true,
    ...overrides,
  } as never;
}

describe("label-image search routing", () => {
  const OLD_ENV = process.env.GEMINI_API_KEY;
  beforeEach(() => { delete process.env.GEMINI_API_KEY; });
  afterEach(() => { process.env.GEMINI_API_KEY = OLD_ENV; });

  it("OpenAI-compatible providers THROW on image search instead of empty success", async () => {
    // Regression: Alibaba's stub returned {imageUrl: ""} as a success, which
    // consumed 5 credits per call while every backfill "found nothing".
    const alibaba = new OpenAICompatibleProvider({
      config: slot("alibaba") as never, label: "alibaba", supportsVision: true,
    });
    await expect(alibaba.fetchWineImage(WINE)).rejects.toThrow(/requires Gemini/);
  });

  it("routes fetchWineImage to a Gemini slot even when vision primary is Alibaba", async () => {
    const router = new ProviderRouter(routerConfig({
      vision: slot("alibaba"),
      text: slot("gemini", "gkey"),
    }));
    const result = await router.fetchWineImage(WINE);
    expect(result.imageUrl).toBe("https://img");
  });

  it("falls back to the GEMINI_API_KEY env var when no Gemini slot exists", async () => {
    process.env.GEMINI_API_KEY = "env-key";
    const router = new ProviderRouter(routerConfig({ vision: slot("alibaba") }));
    const result = await router.fetchWineImage(WINE);
    expect(result.imageUrl).toBe("https://img");
  });

  it("with no Gemini anywhere, image search rejects loudly (never empty success)", async () => {
    const router = new ProviderRouter(routerConfig({ vision: slot("alibaba") }));
    await expect(router.fetchWineImage(WINE)).rejects.toThrow(/requires Gemini|cannot search/);
  });
});
