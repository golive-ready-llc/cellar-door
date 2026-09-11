import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * AI provider keys are secrets. In production they must be encrypted at rest,
 * so saving one without a valid ENCRYPTION_KEY fails instead of silently
 * storing plaintext.
 */

const upsert = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    aIConfig: {
      findUnique: async () => null,
      upsert: (...a: unknown[]) => upsert(...a),
    },
  },
}));

const slot = { provider: "gemini", apiKey: "secret-key", model: "", baseUrl: "" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  upsert.mockReset();
});

describe("setAIConfig and ENCRYPTION_KEY", () => {
  it("refuses to store provider keys unencrypted in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENCRYPTION_KEY", "");
    const { setAIConfig } = await import("@/lib/ai/config");
    await expect(setAIConfig({ text: slot } as never)).rejects.toThrow(/ENCRYPTION_KEY/);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("encrypts provider keys when ENCRYPTION_KEY is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENCRYPTION_KEY", "a".repeat(64));
    upsert.mockResolvedValue({});
    const { setAIConfig } = await import("@/lib/ai/config");
    await setAIConfig({ text: slot } as never);
    const row = upsert.mock.calls[0][0].create;
    expect(row.textApiKey).not.toBe("secret-key");
    expect(row.textApiKey.split(":")).toHaveLength(3);
  });
});
