import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * isTextAIAvailable: a vision-only config makes isAIAvailable() true, but its
 * text calls land on the mock provider. The taste profile and challenges gate
 * on this check so that config gets their mock/fallback, not an error.
 */

process.env.DATABASE_URL = "postgresql://stub";

const getAIConfigSpy = vi.fn();
vi.mock("@/lib/ai/config", () => ({ getAIConfig: () => getAIConfigSpy() }));

import { isAIAvailable, isTextAIAvailable } from "@/lib/ai";

const empty = { provider: "", apiKey: "", model: "", baseUrl: "" };
const config = (over: Record<string, unknown>) => ({
  text: empty, textFailover: empty, vision: empty, visionFailover: empty, enabled: true, ...over,
});

beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
  getAIConfigSpy.mockReset();
});

describe("isTextAIAvailable", () => {
  it("is false for a vision-only config, though isAIAvailable is true", async () => {
    getAIConfigSpy.mockResolvedValue(config({ vision: { ...empty, provider: "minimax", apiKey: "k" } }));
    expect(await isAIAvailable()).toBe(true);
    expect(await isTextAIAvailable()).toBe(false);
  });

  it("is true with a text primary or a text failover", async () => {
    getAIConfigSpy.mockResolvedValue(config({ text: { ...empty, provider: "minimax", apiKey: "k" } }));
    expect(await isTextAIAvailable()).toBe(true);
    getAIConfigSpy.mockResolvedValue(config({ textFailover: { ...empty, provider: "deepseek", apiKey: "k" } }));
    expect(await isTextAIAvailable()).toBe(true);
  });

  it("ignores a mock slot and a disabled config", async () => {
    getAIConfigSpy.mockResolvedValue(config({ text: { ...empty, provider: "mock" } }));
    expect(await isTextAIAvailable()).toBe(false);
    getAIConfigSpy.mockResolvedValue(config({ text: { ...empty, provider: "minimax" }, enabled: false }));
    expect(await isTextAIAvailable()).toBe(false);
  });

  it("is true with only the GEMINI_API_KEY fallback", async () => {
    process.env.GEMINI_API_KEY = "k";
    getAIConfigSpy.mockResolvedValue(config({}));
    expect(await isTextAIAvailable()).toBe(true);
  });
});
