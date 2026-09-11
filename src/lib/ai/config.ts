/**
 * AI Provider Configuration — read/write from the AIConfig table.
 *
 * Singleton config (id="default") stored in the database so admins can
 * change the AI provider at runtime via the admin console.
 *
 * Supports separate text and vision providers, each with failover.
 */

import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

// Warn at most once per process when a provider key is persisted unencrypted
// because ENCRYPTION_KEY is missing/invalid. Without this, the plaintext
// fallback is completely silent — which is how prod ended up storing keys in
// the clear. One log line on the write path makes the misconfig visible.
let warnedPlaintextStore = false;

export type AIProviderType = "gemini" | "deepseek" | "alibaba" | "mock" | "";

export interface ProviderSlot {
  provider: AIProviderType;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface AIConfigData {
  text: ProviderSlot;
  textFailover: ProviderSlot;
  vision: ProviderSlot;
  visionFailover: ProviderSlot;
  enabled: boolean;
}

const EMPTY_SLOT: ProviderSlot = { provider: "", apiKey: "", model: "", baseUrl: "" };

const DEFAULT_CONFIG: AIConfigData = {
  text: { ...EMPTY_SLOT },
  textFailover: { ...EMPTY_SLOT },
  vision: { ...EMPTY_SLOT },
  visionFailover: { ...EMPTY_SLOT },
  enabled: true,
};

function tryDecrypt(val: string | null): string {
  if (!val) return "";
  try {
    return decrypt(val);
  } catch {
    // If it fails to decrypt, it may be an unencrypted legacy value or ENCRYPTION_KEY changed
    return val;
  }
}

function rowToConfig(row: {
  textProvider: string | null;
  textApiKey: string | null;
  textModel: string | null;
  textBaseUrl: string | null;
  textFailoverProvider: string | null;
  textFailoverApiKey: string | null;
  textFailoverModel: string | null;
  textFailoverBaseUrl: string | null;
  visionProvider: string | null;
  visionApiKey: string | null;
  visionModel: string | null;
  visionBaseUrl: string | null;
  visionFailoverProvider: string | null;
  visionFailoverApiKey: string | null;
  visionFailoverModel: string | null;
  visionFailoverBaseUrl: string | null;
  enabled: boolean;
}): AIConfigData {
  const orDefault = (val: string | null) =>
    val && val.length > 0 ? val : "";

  return {
    text: {
      provider: (row.textProvider as ProviderSlot["provider"]) || "",
      apiKey: tryDecrypt(row.textApiKey),
      model: orDefault(row.textModel),
      baseUrl: row.textBaseUrl ?? "",
    },
    textFailover: {
      provider: (row.textFailoverProvider as ProviderSlot["provider"]) || "",
      apiKey: tryDecrypt(row.textFailoverApiKey),
      model: row.textFailoverModel ?? "",
      baseUrl: row.textFailoverBaseUrl ?? "",
    },
    vision: {
      provider: (row.visionProvider as ProviderSlot["provider"]) || "",
      apiKey: tryDecrypt(row.visionApiKey),
      model: orDefault(row.visionModel),
      baseUrl: row.visionBaseUrl ?? "",
    },
    visionFailover: {
      provider: (row.visionFailoverProvider as ProviderSlot["provider"]) || "",
      apiKey: tryDecrypt(row.visionFailoverApiKey),
      model: row.visionFailoverModel ?? "",
      baseUrl: row.visionFailoverBaseUrl ?? "",
    },
    enabled: row.enabled,
  };
}

/** Read the AI config from the DB, returning defaults if no row exists. */
export async function getAIConfig(): Promise<AIConfigData> {
  try {
    const row = await prisma.aIConfig.findUnique({
      where: { id: "default" },
    });
    if (!row) return DEFAULT_CONFIG;
    return rowToConfig(row);
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** Build the upsert data from an AIConfigData */
function configToRow(data: AIConfigData, updatedBy?: string) {
  // String fields are NOT nullable in the schema (String @default("")).
  // Only apiKey fields are String? (nullable).
  const s = (v: string) => v || "";        // string → never null
  const encrypted = (v: string) => {
    if (!v) return null;
    try {
      return encrypt(v);
    } catch {
      // ENCRYPTION_KEY missing/invalid → store as-is (legacy mode). Flag it once
      // so this doesn't stay silent in production (where keys are read by every
      // AI request). Never log the key value itself.
      if (!warnedPlaintextStore) {
        warnedPlaintextStore = true;
        console.warn(
          "[ai-config] ENCRYPTION_KEY is not set or not a 64-char hex string — " +
            "AI provider API keys are being stored UNENCRYPTED at rest. Set " +
            "ENCRYPTION_KEY and re-save (or run scripts/reencrypt-ai-keys.ts) to fix."
        );
      }
      return v;
    }
  };

  return {
    textProvider: s(data.text.provider),
    textApiKey: encrypted(data.text.apiKey),
    textModel: s(data.text.model),
    textBaseUrl: s(data.text.baseUrl),
    textFailoverProvider: s(data.textFailover.provider),
    textFailoverApiKey: encrypted(data.textFailover.apiKey),
    textFailoverModel: s(data.textFailover.model),
    textFailoverBaseUrl: s(data.textFailover.baseUrl),
    visionProvider: s(data.vision.provider),
    visionApiKey: encrypted(data.vision.apiKey),
    visionModel: s(data.vision.model),
    visionBaseUrl: s(data.vision.baseUrl),
    visionFailoverProvider: s(data.visionFailover.provider),
    visionFailoverApiKey: encrypted(data.visionFailover.apiKey),
    visionFailoverModel: s(data.visionFailover.model),
    visionFailoverBaseUrl: s(data.visionFailover.baseUrl),
    enabled: data.enabled,
    updatedBy: updatedBy ?? null,
  };
}

/** Upsert the AI config row. */
export async function setAIConfig(
  data: Partial<AIConfigData> & { updatedBy?: string }
): Promise<AIConfigData> {
  const existing = await getAIConfig();

  const merged: AIConfigData = {
    text: { ...existing.text, ...data.text },
    textFailover: { ...existing.textFailover, ...data.textFailover },
    vision: { ...existing.vision, ...data.vision },
    visionFailover: { ...existing.visionFailover, ...data.visionFailover },
    enabled: data.enabled ?? existing.enabled,
  };

  await prisma.aIConfig.upsert({
    where: { id: "default" },
    create: { id: "default", ...configToRow(merged, data.updatedBy) },
    update: configToRow(merged, data.updatedBy),
  });

  return merged;
}
