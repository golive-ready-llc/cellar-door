import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.DATABASE_URL = "postgresql://stub";

// Admin auth always passes — these tests exercise the key-resolution logic.
vi.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => ({
    verifyIdToken: vi
      .fn()
      .mockResolvedValue({ email: "admin@test", email_verified: true, uid: "u1" }),
  }),
}));
vi.mock("@/lib/admin", () => ({ isAdmin: () => true }));

const getAIConfig = vi.fn();
vi.mock("@/lib/ai/config", () => ({
  getAIConfig: (...args: unknown[]) => getAIConfig(...args),
  setAIConfig: vi.fn(),
}));

const PLACEHOLDER = "••••••••••••••••";

function storedConfig(overrides: Record<string, unknown> = {}) {
  const emptySlot = { provider: "", apiKey: "", model: "", baseUrl: "" };
  return {
    text: { provider: "deepseek", apiKey: "sk-real-stored-key", model: "deepseek-chat", baseUrl: "" },
    textFailover: emptySlot,
    vision: emptySlot,
    visionFailover: emptySlot,
    enabled: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  getAIConfig.mockResolvedValue(storedConfig());
});

describe("testProviderConnection — masked-key resolution", () => {
  it("resolves the UI placeholder to the stored key before calling the provider", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);
    const { testProviderConnection } = await import("@/server/actions/ai-config");
    const result = await testProviderConnection("token", "deepseek", PLACEHOLDER);
    expect(result.data?.success).toBe(true);
    // The Authorization header must carry the REAL stored key, not bullets
    // (bullets aren't Latin-1 and crash fetch with a ByteString error).
    const headers = fetchSpy.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer sk-real-stored-key");
  });

  it("returns a readable error when no stored key exists for the provider", async () => {
    getAIConfig.mockResolvedValue(storedConfig({
      text: { provider: "gemini", apiKey: "g-key", model: "", baseUrl: "" },
    }));
    vi.stubGlobal("fetch", vi.fn());
    const { testProviderConnection } = await import("@/server/actions/ai-config");
    const result = await testProviderConnection("token", "deepseek", PLACEHOLDER);
    expect(result.error).toMatch(/No stored API key/);
  });

  it("rejects keys with non-ASCII characters instead of crashing fetch", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { testProviderConnection } = await import("@/server/actions/ai-config");
    const result = await testProviderConnection("token", "deepseek", "sk-abc•def");
    expect(result.error).toMatch(/invalid characters/);
  });
});

describe("fetchAvailableModels — masked-key resolution", () => {
  it("resolves the placeholder to the stored key", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "deepseek-chat" }] }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    const { fetchAvailableModels } = await import("@/server/actions/ai-config");
    const result = await fetchAvailableModels("token", "deepseek", PLACEHOLDER);
    expect(result.data?.[0].id).toBe("deepseek-chat");
    expect(fetchSpy.mock.calls[0][1].headers.Authorization).toBe("Bearer sk-real-stored-key");
  });
});

/**
 * A key resolved from storage may only be sent to the endpoint it was stored
 * against. `baseUrl` is caller-controlled, so pairing it with a stored key
 * would make these actions a read-back channel for the decrypted key: point
 * one at any host and it arrives in that host's Authorization header. Keys are
 * encrypted at rest and masked on read so that cannot happen, and in
 * single-user mode there is no admin sign-in in front of this.
 */
describe("stored keys are pinned to their stored endpoint", () => {
  it("refuses to send a stored key to a caller-supplied base URL", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { testProviderConnection } = await import("@/server/actions/ai-config");
    const result = await testProviderConnection(
      "token",
      "deepseek",
      PLACEHOLDER,
      "https://attacker.example"
    );
    expect(result.error).toMatch(/Save the new base URL/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses the same redirect on the model list", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { fetchAvailableModels } = await import("@/server/actions/ai-config");
    const result = await fetchAvailableModels(
      "token",
      "deepseek",
      PLACEHOLDER,
      "https://attacker.example"
    );
    expect(result.error).toMatch(/Save the new base URL/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts a base URL that is the stored one spelled differently", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);
    const { testProviderConnection } = await import("@/server/actions/ai-config");
    // Stored slot has no baseUrl, so the provider default applies; the UI
    // sends that same endpoint with a /v1 suffix and a trailing slash.
    const result = await testProviderConnection(
      "token",
      "deepseek",
      PLACEHOLDER,
      "https://api.deepseek.com/v1/"
    );
    expect(result.data?.success).toBe(true);
    expect(fetchSpy.mock.calls[0][0]).toBe("https://api.deepseek.com/v1/models");
  });

  it("uses the stored base URL for a self-hosted endpoint", async () => {
    getAIConfig.mockResolvedValue(
      storedConfig({
        text: {
          provider: "deepseek",
          apiKey: "sk-real-stored-key",
          model: "local",
          baseUrl: "http://ollama.lan:11434",
        },
      })
    );
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);
    const { testProviderConnection } = await import("@/server/actions/ai-config");
    const result = await testProviderConnection(
      "token",
      "deepseek",
      PLACEHOLDER,
      "http://ollama.lan:11434"
    );
    expect(result.data?.success).toBe(true);
    expect(fetchSpy.mock.calls[0][0]).toBe("http://ollama.lan:11434/v1/models");
    expect(fetchSpy.mock.calls[0][1].headers.Authorization).toBe("Bearer sk-real-stored-key");
  });

  it("still lets an admin test a freshly typed key against a new endpoint", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);
    const { testProviderConnection } = await import("@/server/actions/ai-config");
    // The key came from the caller, not from storage — nothing secret leaks.
    const result = await testProviderConnection(
      "token",
      "deepseek",
      "sk-typed-by-admin",
      "https://openrouter.ai/api"
    );
    expect(result.data?.success).toBe(true);
    expect(fetchSpy.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/models");
    expect(fetchSpy.mock.calls[0][1].headers.Authorization).toBe("Bearer sk-typed-by-admin");
  });

  it("leaves Gemini alone — its key always goes to Google", async () => {
    getAIConfig.mockResolvedValue(
      storedConfig({
        text: { provider: "gemini", apiKey: "g-real-key", model: "", baseUrl: "" },
      })
    );
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);
    const { testProviderConnection } = await import("@/server/actions/ai-config");
    const result = await testProviderConnection(
      "token",
      "gemini",
      PLACEHOLDER,
      "https://attacker.example"
    );
    expect(result.data?.success).toBe(true);
    expect(fetchSpy.mock.calls[0][0]).toContain("generativelanguage.googleapis.com");
  });
});
