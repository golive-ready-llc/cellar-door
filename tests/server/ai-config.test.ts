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
