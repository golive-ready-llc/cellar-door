// AI provider factory
// Returns the appropriate AI provider based on database-stored admin configuration.
//
// Uses ProviderRouter to delegate text vs vision operations to separate providers,
// each with configurable failover.

import { createHash } from "crypto";
import type { AIProvider } from "./provider";
import { ProviderRouter } from "./provider-router";
import { MockAIProvider } from "./mock";
import type { AIConfigData } from "./config";

let _router: ProviderRouter | null = null;
let _configHash: string = "";
let _lastConfig: AIConfigData | null = null;

/** Deterministic hash of the relevant config fields for cache invalidation. */
function hashConfig(config: AIConfigData): string {
  const payload = [
    config.enabled,
    config.text.provider, config.text.apiKey, config.text.model, config.text.baseUrl,
    config.textFailover.provider, config.textFailover.apiKey, config.textFailover.model, config.textFailover.baseUrl,
    config.vision.provider, config.vision.apiKey, config.vision.model, config.vision.baseUrl,
    config.visionFailover.provider, config.visionFailover.apiKey, config.visionFailover.model, config.visionFailover.baseUrl,
  ].join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 12);
}

/** Check if a config has at least one real (non-mock) provider configured. */
function hasAnyProvider(config: AIConfigData): boolean {
  return !!(config.text.provider || config.textFailover.provider || config.vision.provider || config.visionFailover.provider);
}

/** Get the singleton provider router instance */
export async function getAIProvider(): Promise<AIProvider> {
  try {
    const { getAIConfig } = await import("./config");
    const config = await getAIConfig();
    const hash = hashConfig(config);

    // Cache hit — same config as last call
    if (_router && _configHash === hash) {
      return _router;
    }

    if (config.enabled && hasAnyProvider(config)) {
      _router = new ProviderRouter(config);
      _configHash = hash;
      _lastConfig = config;
      return _router;
    }
  } catch {
    // DB unavailable — fall through
  }

  // Fall back to GEMINI_API_KEY env var (only when no DB provider configured)
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.length > 0) {
    const { GeminiProvider } = await import("./gemini");
    return new GeminiProvider(apiKey);
  }

  // No real provider configured — use mock
  return new MockAIProvider();
}

/** Invalidate the cached router so the next call re-reads DB config */
export function resetAIProvider(): void {
  _router = null;
  _configHash = "";
  _lastConfig = null;
}

/**
 * Check if a real AI provider is available.
 * Checks BOTH the GEMINI_API_KEY env var AND any DB-configured provider.
 * Returns true if either a DB provider is configured or the env var is set.
 */
export async function isAIAvailable(): Promise<boolean> {
  // Fast path: env var is set
  if (process.env.GEMINI_API_KEY) return true;

  // Check DB config
  try {
    const { getAIConfig } = await import("./config");
    const config = await getAIConfig();
    return config.enabled && hasAnyProvider(config);
  } catch {
    return false;
  }
}

// Re-export types
export type { AIProvider } from "./provider";
export type {
  WineIdentification, AiTastingNotesResult, AiFoodPairingsResult,
  AiPriceEstimation, AiDrinkWindowResult, AiCriticScoresResult,
  AiWineEnrichmentResult, AiWineImageResult, WineListExtractionResult,
  AiRecommendationResult, AiDecantRecommendationResult, BatchDispositionResult,
  WineDataInput, TasteProfileResult, TasteProfileBundle, VintageStoryResult,
  AiMealPairingResult, MealPairingWineInput, MealPairingMatch,
  AiTerroirTwinResult, TerroirTwinMatch, AiPourCostResult, PourCostWine,
  PourCostWineInput, PourCostCourse, PourCostShoppingItem, WineSuggestion,
  WineSuggestionsResult,
} from "./types";
