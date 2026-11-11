import { expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ models: [] as string[] }));
vi.mock("@/lib/ai/gemini", () => ({
  GeminiProvider: class {
    constructor(_key: string, private model?: string) {}
    async searchWine() { calls.models.push(this.model ?? "default"); return {}; }
    async scanLabel() { calls.models.push(this.model ?? "default"); return {}; }
  },
}));
vi.mock("@/lib/ai/deepseek", () => ({ OpenAICompatibleProvider: class {} }));

import type { ProviderSlot } from "@/lib/ai/config";
import { ProviderRouter } from "@/lib/ai/provider-router";

it("routes separate Gemini text and vision model selections to the provider", async () => {
  calls.models.length = 0;
  const empty: ProviderSlot = { provider: "", apiKey: "", model: "", baseUrl: "" };
  const router = new ProviderRouter({
    enabled: true,
    text: { ...empty, provider: "gemini", apiKey: "test-key", model: "text-model" },
    vision: { ...empty, provider: "gemini", apiKey: "test-key", model: "vision-model" },
    textFailover: empty,
    visionFailover: empty,
  });
  await router.searchWine("example wine");
  await router.scanLabel("YQ==", "image/jpeg");
  expect(calls.models).toEqual(["text-model", "vision-model"]);
});
