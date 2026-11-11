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

describe("GeminiProvider.completeJSON", () => {
  it("asks for JSON with thinking disabled (2026-09-12 504 DEADLINE_EXCEEDED fix)", async () => {
    generateContentSpy.mockResolvedValueOnce({ text: '{"all":{}}' });
    const text = await new GeminiProvider("test-key").completeJSON("PROMPT", 0.8);
    expect(text).toBe('{"all":{}}');
    const req = generateContentSpy.mock.calls[0][0];
    expect(req.contents).toBe("PROMPT");
    expect(req.model).toBe("gemini-2.5-flash");
    expect(req.config).toEqual({
      responseMimeType: "application/json",
      temperature: 0.8,
      thinkingConfig: { thinkingBudget: 0 },
    });
  });
});


describe("GeminiProvider model selection", () => {
  it("uses the configured model for text and image requests", async () => {
    generateContentSpy.mockClear();
    generateContentSpy.mockResolvedValue({ text: '{}' });
    const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
    await provider.searchWine("example wine");
    await provider.scanLabel("YQ==", "image/jpeg");
    expect(generateContentSpy).toHaveBeenCalledTimes(2);
    for (const [request] of generateContentSpy.mock.calls) {
      expect(request.model).toBe("gemini-3.6-flash");
    }
  });

  it("keeps the existing default when the configured model is blank", async () => {
    generateContentSpy.mockClear();
    generateContentSpy.mockResolvedValueOnce({ text: '{}' });
    await new GeminiProvider("test-key", "  ").searchWine("example wine");
    expect(generateContentSpy.mock.calls[0][0].model).toBe("gemini-2.5-flash");
  });
});
