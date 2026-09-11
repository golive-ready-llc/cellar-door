"use server";

import { requireAdmin } from "@/server/auth-guard";
import { getAIConfig, setAIConfig } from "@/lib/ai/config";
import type { AIConfigData, ProviderSlot } from "@/lib/ai/config";

/** Sentinels used in the admin UI for API keys that are already set and should be preserved. */
const API_KEY_PLACEHOLDER = "••••••••••••••••";

/**
 * Mask API keys for client-side display so plaintext keys never leave the server.
 * Replaces a non-empty key with a placeholder sentinel.
 */
function maskApiKey(val: string): string {
  return val ? API_KEY_PLACEHOLDER : "";
}

function maskConfig(config: AIConfigData): AIConfigData {
  return {
    ...config,
    text: { ...config.text, apiKey: maskApiKey(config.text.apiKey) },
    textFailover: { ...config.textFailover, apiKey: maskApiKey(config.textFailover.apiKey) },
    vision: { ...config.vision, apiKey: maskApiKey(config.vision.apiKey) },
    visionFailover: { ...config.visionFailover, apiKey: maskApiKey(config.visionFailover.apiKey) },
  };
}

/**
 * Get the current AI provider configuration.
 * Admin-only. API keys are masked for client-side display.
 */
export async function getAdminAIConfig(
  idToken: string
): Promise<{ error?: string; data?: AIConfigData }> {
  try {
    const admin = await requireAdmin(idToken);
    if (!admin.ok) return { error: admin.error };
    const config = await getAIConfig();
    return { data: maskConfig(config) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to read AI config" };
  }
}

/**
 * Resolve the key the admin UI sent for a test/model-fetch call. The UI shows
 * stored keys as the masked placeholder, so when the sentinel arrives here the
 * real key must be pulled from the stored config (first slot using this
 * provider that has a key) — otherwise the literal "••••" went straight into
 * an Authorization header, which crashes fetch with a cryptic ByteString
 * error (bullets aren't Latin-1).
 */
async function resolveTestApiKey(
  apiKey: string | undefined,
  provider: string
): Promise<{ key?: string; error?: string }> {
  if (apiKey && apiKey !== API_KEY_PLACEHOLDER) {
    // HTTP header values must be Latin-1; real provider keys are printable
    // ASCII. Reject anything else with a readable message instead of letting
    // fetch throw "Cannot convert argument to a ByteString…".
    if (/[^\x21-\x7e]/.test(apiKey)) {
      return { error: "API key contains invalid characters — re-paste the key" };
    }
    return { key: apiKey };
  }
  if (apiKey === API_KEY_PLACEHOLDER) {
    const config = await getAIConfig();
    const slots = [config.text, config.textFailover, config.vision, config.visionFailover];
    const match = slots.find((s) => s.provider === provider && s.apiKey);
    if (match) return { key: match.apiKey };
    return { error: "No stored API key found for this provider — re-enter the key" };
  }
  return {};
}

/**
 * If an incoming apiKey is still the placeholder sentinel, replace it with the
 * existing decrypted key from the current config so the key is preserved on write.
 */
function preserveUnchangedKeys(
  incoming: Partial<AIConfigData>,
  existing: AIConfigData
): void {
  const slotNames: Array<"text" | "textFailover" | "vision" | "visionFailover"> = ["text", "textFailover", "vision", "visionFailover"];
  for (const slot of slotNames) {
    const slotData = incoming[slot] as ProviderSlot | undefined;
    if (slotData && slotData.apiKey === API_KEY_PLACEHOLDER) {
      slotData.apiKey = (existing[slot] as ProviderSlot).apiKey;
    }
  }
}

/**
 * Update the AI provider configuration.
 * API key placeholders from the admin form are resolved to the existing decrypted
 * key before saving, so stored encrypted keys are never accidentally overwritten with
 * the placeholder sentinel.
 */
export async function updateAdminAIConfig(
  idToken: string,
  updates: Partial<AIConfigData> & { updatedBy?: string }
): Promise<{ error?: string; data?: AIConfigData }> {
  try {
    const admin = await requireAdmin(idToken);
    if (!admin.ok) return { error: admin.error };

    // Resolve placeholder values to existing decrypted keys before saving
    const existing = await getAIConfig();
    preserveUnchangedKeys(updates, existing);

    const config = await setAIConfig({ ...updates, updatedBy: admin.uid });
    return { data: maskConfig(config) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update AI config" };
  }
}

// ─── Model Info ─────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  displayName: string;
  supportsVision: boolean;
  /** True for "thinking"/reasoning models (deepseek-reasoner, *-thinking,
   *  *-r1, qwq, …). They return their answer in a separate `reasoning_content`
   *  field and leave `content` empty/slow, which breaks the app's text
   *  extraction — flagged so admins steer clear. */
  isReasoning: boolean;
}

/** Detect reasoning / "thinking" models by id — incompatible with the app's
 *  content-based text path (they leave `content` empty). */
function isReasoningModel(id: string): boolean {
  return /(thinking|reasoner|reasoning|[-_]r1\b|qwq)/i.test(id);
}

/** Surface appropriate (non-reasoning) models first in the picker. */
function sortModels(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort((a, b) =>
    a.isReasoning === b.isReasoning ? a.id.localeCompare(b.id) : a.isReasoning ? 1 : -1
  );
}

/**
 * Fetch available models from a given provider's API.
 */
export async function fetchAvailableModels(
  idToken: string,
  provider: "gemini" | "deepseek" | "alibaba",
  apiKey?: string,
  baseUrl?: string
): Promise<{ error?: string; data?: ModelInfo[] }> {
  try {
    const admin = await requireAdmin(idToken);
    if (!admin.ok) return { error: admin.error };

    const resolved = await resolveTestApiKey(apiKey, provider);
    if (resolved.error) return { error: resolved.error };
    apiKey = resolved.key;

    if (provider === "deepseek" || provider === "alibaba") {
      if (!apiKey) return { error: "API key is required" };
      const defaultUrl = provider === "alibaba" ? "https://dashscope.aliyuncs.com/compatible-mode" : "https://api.deepseek.com";
      const url = ((baseUrl || defaultUrl).replace(/\/+$/, "").replace(/\/v1$/, "")) + "/v1/models";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "no body");
        return { error: `API returned ${res.status}: ${body.substring(0, 300)}` };
      }
      const json = await res.json();
      // Alibaba models like qwen-vl-* support vision; flag them
      const models: ModelInfo[] = (json.data || []).map((m: { id: string }) => ({
        id: m.id,
        displayName: m.id,
        supportsVision: provider === "alibaba" && /vl|vision|multimodal/i.test(m.id),
        isReasoning: isReasoningModel(m.id),
      }));
      return { data: sortModels(models) };
    }

    if (provider === "gemini") {
      const key = apiKey || process.env.GEMINI_API_KEY;
      if (!key) return { error: "Gemini API key is not configured" };
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) return { error: `Gemini API returned status ${res.status}` };
      const json = await res.json();
      const models: ModelInfo[] = (json.models || [])
        .filter((m: { name: string }) => m.name.startsWith("models/gemini-"))
        .map((m: { name: string; displayName: string; supportedGenerationMethods?: string[] }) => ({
          id: m.name.replace("models/", ""),
          displayName: m.displayName || m.name.replace("models/", ""),
          supportsVision: (m.supportedGenerationMethods || []).includes("generateContent"),
          isReasoning: isReasoningModel(m.name),
        }));
      return { data: sortModels(models) };
    }

    return { error: `Unsupported provider: ${provider}` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to fetch models" };
  }
}

// ─── Connection Test ────────────────────────────────────────

/**
 * Test a provider's API connection by listing models.
 */
export async function testProviderConnection(
  idToken: string,
  provider: "gemini" | "deepseek" | "alibaba" | "mock",
  apiKey?: string,
  baseUrl?: string
): Promise<{ error?: string; data?: { success: boolean; latency: number } }> {
  try {
    const admin = await requireAdmin(idToken);
    if (!admin.ok) return { error: admin.error };

    if (provider === "mock") return { data: { success: true, latency: 0 } };

    const resolved = await resolveTestApiKey(apiKey, provider);
    if (resolved.error) return { error: resolved.error };
    apiKey = resolved.key;

    if (provider === "deepseek" || provider === "alibaba") {
      if (!apiKey) return { error: "API key is not configured" };
      const defaultUrl = provider === "alibaba" ? "https://dashscope.aliyuncs.com/compatible-mode" : "https://api.deepseek.com";
      const url = ((baseUrl || defaultUrl).replace(/\/+$/, "").replace(/\/v1$/, "")) + "/v1/models";
      const start = Date.now();
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
      const latency = Date.now() - start;
      if (!res.ok) {
        const body = await res.text().catch(() => "no body");
        return { error: `API returned ${res.status}: ${body.substring(0, 300)}` };
      }
      return { data: { success: true, latency } };
    }
    if (provider === "gemini") {
      const key = apiKey || process.env.GEMINI_API_KEY;
      if (!key) return { error: "Gemini API key is not configured" };
      const start = Date.now();
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
        { signal: AbortSignal.timeout(10000) }
      );
      const latency = Date.now() - start;
      if (!res.ok) {
        const body = await res.text().catch(() => "no body");
        return { error: `Gemini API returned ${res.status}: ${body.substring(0, 300)}` };
      }
      return { data: { success: true, latency } };
    }
    return { error: `Unknown provider: ${provider}` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Connection test failed" };
  }
}
