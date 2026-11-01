import { describe, it, expect, vi } from "vitest";

/**
 * completeJSON carries the taste profile's Gemini settings with it now that
 * the action goes through the provider router instead of the SDK.
 */

const generateContentSpy = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: (...a: unknown[]) => generateContentSpy(...a) };
  },
}));

import { GeminiProvider } from "@/lib/ai/gemini";
import type { WineDataInput } from "@/lib/ai/types";

describe("GeminiProvider.completeJSON", () => {
  it("asks for JSON with thinking disabled (2026-09-12 504 DEADLINE_EXCEEDED fix)", async () => {
    generateContentSpy.mockResolvedValueOnce({ text: '{"all":{}}' });
    const text = await new GeminiProvider("test-key").completeJSON("PROMPT", 0.8);
    expect(text).toBe('{"all":{}}');
    const req = generateContentSpy.mock.calls[0][0];
    expect(req.contents).toBe("PROMPT");
    expect(req.config).toEqual({
      responseMimeType: "application/json",
      temperature: 0.8,
      thinkingConfig: { thinkingBudget: 0 },
    });
  });
});

const WINE: WineDataInput = {
  name: "Termes",
  winery: "Numanthia",
  vintage: 2019,
  type: "red",
  region: "Toro",
  country: "Spain",
  grapeVariety: "Tinta de Toro",
};

describe("GeminiProvider JSON helpers", () => {
  it("scanLabel disables the default thinking phase (label scan is the hottest AI flow)", async () => {
    generateContentSpy.mockResolvedValueOnce({ text: '{"name":"Termes","winery":"Numanthia"}' });
    await new GeminiProvider("test-key").scanLabel("aW1hZ2U=", "image/jpeg");
    const req = generateContentSpy.mock.calls[0][0];
    expect(req.config.responseMimeType).toBe("application/json");
    expect(req.config.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it("enrichWine disables the default thinking phase", async () => {
    generateContentSpy.mockResolvedValueOnce({ text: '{"description":"Toro red"}' });
    await new GeminiProvider("test-key").enrichWine(WINE);
    const req = generateContentSpy.mock.calls[0][0];
    expect(req.config.responseMimeType).toBe("application/json");
    expect(req.config.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });
});
