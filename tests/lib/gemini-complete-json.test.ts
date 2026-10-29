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
    expect(req.config).toEqual({
      responseMimeType: "application/json",
      temperature: 0.8,
      thinkingConfig: { thinkingBudget: 0 },
    });
  });
});
