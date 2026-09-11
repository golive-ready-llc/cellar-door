/**
 * AI Provider Router — delegates to the right provider per operation type.
 *
 * Text operations → textProvider (with textFailover)
 * Vision operations → visionProvider (with visionFailover)
 */

import type { AIProvider } from "./provider";
import type { AIConfigData, ProviderSlot } from "./config";
import { GeminiProvider } from "./gemini";
import { OpenAICompatibleProvider } from "./deepseek";
import { MockAIProvider } from "./mock";
import type {
  WineIdentification, AiTastingNotesResult, AiFoodPairingsResult,
  AiPriceEstimation, AiDrinkWindowResult, AiCriticScoresResult,
  AiWineEnrichmentResult, AiWineImageResult, WineListExtractionResult,
  AiRecommendationResult, AiDecantRecommendationResult, BatchDispositionResult,
  WineDataInput, AiMealPairingResult, MealPairingWineInput, AiTerroirTwinResult,
  AiPourCostResult, PourCostWineInput, WineSuggestionsResult,
  VintageStoryResult,
} from "./types";

function buildProvider(slot: ProviderSlot): AIProvider | null {
  if (!slot.provider || slot.provider === "mock") return null;
  if (slot.provider === "gemini") {
    const key = slot.apiKey || process.env.GEMINI_API_KEY;
    if (!key) return null;
    return new GeminiProvider(key);
  }
  if (slot.provider === "deepseek" || slot.provider === "alibaba") {
    if (!slot.apiKey) return null;
    const supportsVision = slot.provider === "alibaba";
    return new OpenAICompatibleProvider({
      config: slot,
      label: slot.provider,
      supportsVision,
    });
  }
  return null;
}

async function tryWithFailover<T>(
  fn: (provider: AIProvider) => Promise<T>,
  primary: AIProvider | null,
  failover: AIProvider | null
): Promise<T> {
  if (primary) {
    try {
      return await fn(primary);
    } catch (err) {
      // Only fall through to failover if primary threw a network/API error
      const msg = err instanceof Error ? err.message : String(err);
      if (failover && !msg.includes("does not support image")) {
        try { return await fn(failover); } catch { /* both failed */ }
      }
      throw err; // re-throw original if no failover or failover also failed
    }
  }
  if (failover) return fn(failover);
  throw new Error("No AI provider configured for this operation");
}

/** Whether a provider slot's model can handle image (vision) operations.
 *  Gemini is multimodal; Alibaba is configured with supportsVision=true (see
 *  buildProvider). Deepseek and others are text-only. */
function isVisionCapableSlot(slot: ProviderSlot): boolean {
  return slot.provider === "gemini" || slot.provider === "alibaba";
}

/** Wrap a text-only provider's vision methods to throw a clear error */
function textOnlyProxy(provider: AIProvider): AIProvider {
  return new Proxy(provider, {
    get(target, prop) {
      if (prop === "scanLabel" || prop === "extractWineList" || prop === "fetchWineImage") {
        return () => Promise.reject(new Error("This provider does not support image operations"));
      }
      return (target as unknown as Record<string | symbol, unknown>)[prop];
    },
  });
}

export class ProviderRouter implements AIProvider {
  private textPrimary: AIProvider | null;
  private textFailover: AIProvider | null;
  private visionPrimary: AIProvider | null;
  private visionFailover: AIProvider | null;
  /** Gemini instance for label-image search — the one operation that is
   *  Gemini-specific (Google Search grounding), NOT generic vision. Resolved
   *  from the first Gemini slot in any position, else the env key. */
  private imageSearch: AIProvider | null;

  constructor(config: AIConfigData) {
    this.textPrimary = buildProvider(config.text);
    this.textFailover = config.textFailover.provider ? buildProvider(config.textFailover) : null;
    this.visionPrimary = buildProvider(config.vision);
    this.visionFailover = config.visionFailover.provider ? buildProvider(config.visionFailover) : null;

    const geminiSlot = [config.vision, config.visionFailover, config.text, config.textFailover]
      .find((s) => s.provider === "gemini" && (s.apiKey || process.env.GEMINI_API_KEY));
    this.imageSearch = geminiSlot
      ? buildProvider(geminiSlot)
      : process.env.GEMINI_API_KEY
        ? new GeminiProvider(process.env.GEMINI_API_KEY)
        : null;

    // If no vision provider is configured, fall back to the text provider for
    // vision — but only use it directly when it's actually vision-capable
    // (Gemini/Alibaba). A text-only provider (e.g. Deepseek) is wrapped so
    // vision ops fail with a clear message instead of garbage. Previously EVERY
    // text provider was wrapped, so a Gemini-only config couldn't scan labels.
    if (!this.visionPrimary && this.textPrimary) {
      this.visionPrimary = isVisionCapableSlot(config.text)
        ? this.textPrimary
        : textOnlyProxy(this.textPrimary);
    }
    if (!this.visionFailover && this.textFailover) {
      this.visionFailover = isVisionCapableSlot(config.textFailover)
        ? this.textFailover
        : textOnlyProxy(this.textFailover);
    }
  }

  /** Resolve which provider to use for a text operation */
  private textProvider(): AIProvider {
    if (!this.textPrimary && !this.textFailover) {
      // Fall back to Gemini env var
      const key = process.env.GEMINI_API_KEY;
      if (key) return new GeminiProvider(key);
      return new MockAIProvider();
    }
    // Return a proxy that tries primary then failover
    const primary = this.textPrimary;
    const failover = this.textFailover;
    return new Proxy({} as AIProvider, {
      get(_, prop) {
        return (...args: unknown[]) => {
          const fn = (p: AIProvider) => {
            const method = (p as unknown as Record<string | symbol, (...a: unknown[]) => unknown>)[prop];
            if (typeof method !== "function") throw new Error(`Method ${String(prop)} not found`);
            return method.call(p, ...args) as Promise<unknown>;
          };
          return tryWithFailover(fn, primary, failover);
        };
      },
    });
  }

  /** Resolve which provider to use for a vision operation */
  private visionProvider(): AIProvider {
    const primary = this.visionPrimary;
    const failover = this.visionFailover;
    return new Proxy({} as AIProvider, {
      get(_, prop) {
        return (...args: unknown[]) => {
          const fn = (p: AIProvider) => {
            const method = (p as unknown as Record<string | symbol, (...a: unknown[]) => unknown>)[prop];
            if (typeof method !== "function") throw new Error(`Method ${String(prop)} not found`);
            return method.call(p, ...args) as Promise<unknown>;
          };
          return tryWithFailover(fn, primary, failover);
        };
      },
    });
  }

  // ─── Text operations → textProvider ──────────────────────
  searchWine(query: string): Promise<WineIdentification> { return this.textProvider().searchWine(query); }
  searchWineSuggestions(query: string, limit?: number): Promise<WineSuggestionsResult> { return this.textProvider().searchWineSuggestions(query, limit); }
  generateTastingNotes(wine: WineDataInput): Promise<AiTastingNotesResult> { return this.textProvider().generateTastingNotes(wine); }
  generateFoodPairings(wine: WineDataInput): Promise<AiFoodPairingsResult> { return this.textProvider().generateFoodPairings(wine); }
  estimatePrice(wine: WineDataInput): Promise<AiPriceEstimation> { return this.textProvider().estimatePrice(wine); }
  suggestDrinkWindow(wine: WineDataInput): Promise<AiDrinkWindowResult> { return this.textProvider().suggestDrinkWindow(wine); }
  estimateCriticScores(wine: WineDataInput): Promise<AiCriticScoresResult> { return this.textProvider().estimateCriticScores(wine); }
  enrichWine(wine: WineDataInput): Promise<AiWineEnrichmentResult> { return this.textProvider().enrichWine(wine); }
  recommend(occasion: string, wines: Array<{ id: string; name: string; winery: string; vintage: number | null; type: string; disposition: string; drinkWindow: string }>): Promise<AiRecommendationResult> { return this.textProvider().recommend(occasion, wines); }
  decantRecommendation(wine: WineDataInput): Promise<AiDecantRecommendationResult> { return this.textProvider().decantRecommendation(wine); }
  batchDisposition(wines: Array<{ id: string; name: string; winery: string; vintage: number | null; type: string; region: string; drinkBy: string }>): Promise<BatchDispositionResult> { return this.textProvider().batchDisposition(wines); }
  mealPairing(meal: string, wines: MealPairingWineInput[]): Promise<AiMealPairingResult> { return this.textProvider().mealPairing(meal, wines); }
  terroirTwins(wine: WineDataInput, userWines: Array<{ id: string; name: string; winery: string; region: string; country: string; grapeVariety: string }>): Promise<AiTerroirTwinResult> { return this.textProvider().terroirTwins(wine, userWines); }
  pourCostCalculation(params: { guestCount: number; duration: number; budget?: number; courseCount: number; style: "casual" | "formal" | "mixed" }, wines: PourCostWineInput[]): Promise<AiPourCostResult> { return this.textProvider().pourCostCalculation(params, wines); }
  vintageStory(region: string, country: string, vintage: number): Promise<VintageStoryResult> { return this.textProvider().vintageStory(region, country, vintage); }
  chat(systemPrompt: string, messages: Array<{ role: string; content: string }>): Promise<string> { return this.textProvider().chat(systemPrompt, messages); }

  /** Streamed chat with failover: the failover provider is tried only if the
   *  primary fails before producing any text (a half-sent reply can't be retried). */
  async *chatStream(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>
  ): AsyncGenerator<string> {
    const providers = [this.textPrimary, this.textFailover].filter((p): p is AIProvider => !!p);
    if (providers.length === 0) throw new Error("No AI provider configured for this operation");
    let lastError: unknown;
    for (const provider of providers) {
      let yielded = false;
      try {
        if (provider.chatStream) {
          for await (const chunk of provider.chatStream(systemPrompt, messages)) {
            yielded = true;
            yield chunk;
          }
        } else {
          const reply = await provider.chat(systemPrompt, messages);
          yielded = true;
          yield reply;
        }
        return;
      } catch (err) {
        if (yielded) throw err;
        lastError = err;
      }
    }
    throw lastError;
  }

  // ─── Vision operations → visionProvider ──────────────────
  scanLabel(imageBase64: string, mimeType: string): Promise<WineIdentification> { return this.visionProvider().scanLabel(imageBase64, mimeType); }
  fetchWineImage(wine: WineDataInput): Promise<AiWineImageResult> {
    // Gemini-only op: prefer the resolved Gemini instance; the vision chain
    // is only a last resort (its non-Gemini providers now throw clearly).
    if (this.imageSearch) return this.imageSearch.fetchWineImage(wine);
    return this.visionProvider().fetchWineImage(wine);
  }
  extractWineList(imageBase64: string, mimeType: string): Promise<WineListExtractionResult> { return this.visionProvider().extractWineList(imageBase64, mimeType); }
}
