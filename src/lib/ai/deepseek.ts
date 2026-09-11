/**
 * OpenAI-compatible AI provider (Deepseek, Alibaba Qwen, OpenRouter, etc.).
 * Text-only by default; set supportsVision=true to enable multimodal vision.
 */

import type { AIProvider } from "./provider";
import type { ProviderSlot } from "./config";
import type {
  WineIdentification, AiTastingNotesResult, AiFoodPairingsResult,
  AiPriceEstimation, AiDrinkWindowResult, AiCriticScoresResult,
  AiWineEnrichmentResult, AiWineImageResult, AiRecommendationResult,
  AiDecantRecommendationResult, BatchDispositionResult, WineDataInput,
  AiMealPairingResult, MealPairingWineInput, AiTerroirTwinResult,
  AiPourCostResult, PourCostWineInput, WineSuggestionsResult,
  VintageStoryResult,
} from "./types";
import {
  wineSearchPrompt, tastingNotesPrompt,
  foodPairingsPrompt, priceEstimationPrompt, drinkWindowPrompt,
  criticScoresPrompt, wineEnrichmentPrompt, recommendationPrompt,
  batchDispositionPrompt, decantRecommendationPrompt, mealPairingPrompt,
  terroirTwinPrompt, pourCostPrompt, labelScanPrompt,
  wineListVisionExtractPrompt, wineListEnrichmentPrompt,
  vintageStoryPrompt,
} from "./prompts";

export interface OpenAIProviderOptions {
  config: ProviderSlot;
  /** Label used in error messages */
  label?: string;
  /** Whether this provider supports multimodal image inputs */
  supportsVision?: boolean;
}

export class OpenAICompatibleProvider implements AIProvider {
  private config: ProviderSlot;
  private label: string;
  private supportsVision: boolean;

  constructor(opts: OpenAIProviderOptions) {
    this.config = opts.config;
    this.label = opts.label ?? "OpenAI-compatible";
    this.supportsVision = opts.supportsVision ?? false;
  }

  private get baseUrl() {
    // Normalise: strip trailing slashes and any /v1 suffix so users can paste
    // the full endpoint URL (e.g. Alibaba Cloud provides ".../compatible-mode/v1").
    return (this.config.baseUrl || "https://api.deepseek.com")
      .replace(/\/+$/, "")       // trailing slashes
      .replace(/\/v1$/, "");     // /v1 suffix
  }

  private get model() {
    return this.config.model || "deepseek-chat";
  }

  private async chatCompletion(
    systemPrompt: string, userPrompt: string,
    temperature = 0.1, jsonMode = true
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature, max_tokens: 4096,
    };
    if (jsonMode) body.response_format = { type: "json_object" };

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "unknown");
      throw new Error(`${this.label} API error ${res.status}: ${text.substring(0, 500)}`);
    }
    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error(`Empty response from ${this.label}`);
    return content;
  }

  /** For vision-capable providers, send image as multimodal message.
   *  `userText` must describe the actual task — it used to be hardcoded to
   *  "Analyze this wine label image" for EVERY vision op, which made the
   *  model report "no wines" when handed a receipt/wine list (it was told
   *  to look for a label). */
  private async visionChatCompletion(
    systemPrompt: string,
    imageBase64: string,
    mimeType: string,
    temperature = 0.1,
    jsonMode = true,
    userText = "Analyze this image. Return the analysis as a JSON object with the fields specified in the system instructions."
  ): Promise<string> {
    if (!this.supportsVision) {
      throw new Error(`${this.label} does not support image operations`);
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            { type: "text", text: userText },
          ],
        },
      ],
      temperature, max_tokens: 4096,
    };
    if (jsonMode) body.response_format = { type: "json_object" };

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "unknown");
      throw new Error(`${this.label} vision API error ${res.status}: ${text.substring(0, 500)}`);
    }
    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error(`Empty vision response from ${this.label}`);
    return content;
  }

  private parseJSON<T>(text: string): T {
    if (!text?.trim()) throw new Error("Empty response");
    try { return JSON.parse(text) as T; } catch { /* */ }
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) { try { return JSON.parse(fence[1].trim()) as T; } catch { /* */ } }
    const obj = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (obj) { try { return JSON.parse(obj[1]) as T; } catch { /* */ } }
    throw new Error(`Could not parse JSON. Preview: ${text.substring(0, 200)}`);
  }

  private async generateJSON<T>(system: string, prompt: string, temp = 0.1): Promise<T> {
    return this.parseJSON<T>(await this.chatCompletion(system, prompt, temp, true));
  }

  private async generateVisionJSON<T>(
    prompt: string, imageBase64: string, mimeType: string, temp = 0.1, userText?: string
  ): Promise<T> {
    const text = await this.visionChatCompletion(prompt, imageBase64, mimeType, temp, true, userText);
    return this.parseJSON<T>(text);
  }

  // ─── Text operations ─────────────────────────────────────
  async searchWine(query: string): Promise<WineIdentification> {
    return this.generateJSON<WineIdentification>(
      "You are a wine identification assistant. Return JSON only.", wineSearchPrompt(query), 0.2);
  }
  async searchWineSuggestions(query: string, limit?: number): Promise<WineSuggestionsResult> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return { suggestions: [] };
    const text = await this.chatCompletion(
      "You are a wine autocomplete assistant. Return ONLY a JSON object with a 'suggestions' array.",
      `Find up to ${limit ?? 8} wines matching "${trimmed}". Each suggestion must have: name, winery, vintage (number or null), type, region, country, grapeVariety.`,
      0.1, true);
    return this.parseJSON<WineSuggestionsResult>(text);
  }
  async scanLabel(imageBase64: string, mimeType: string): Promise<WineIdentification> {
    if (!this.supportsVision) throw new Error(`${this.label} does not support image operations`);
    return this.generateVisionJSON<WineIdentification>(
      labelScanPrompt(), imageBase64, mimeType, 0.1,
      "Analyze this wine label image. Return the analysis as a JSON object with the fields specified in the system instructions.");
  }
  async fetchWineImage(_wine: WineDataInput): Promise<AiWineImageResult> {
    // Label-image SEARCH needs Google Search grounding — a Gemini-only
    // capability, regardless of this provider's vision support. Returning
    // an empty success here (the old behavior) silently consumed 5 credits
    // per call while every bulk image backfill "found nothing". Throwing
    // lets the router fail over to a Gemini slot and wrapAI refund credits.
    throw new Error(
      `${this.label} cannot search for label images (requires Gemini with Google Search grounding)`
    );
  }
  /**
   * Two-stage wine-list / receipt extraction.
   *
   * Stage 1 (vision): minimal document-grounded schema — just the fields
   * printed on the page. Qwen3-VL refuses rich multi-item extraction (it
   * returns an empty wines array when the schema asks for knowledge-based
   * fields like description/region/ratings), so we keep the vision call
   * deliberately small. Verified: rich prompt = 0/6 wines on a clear
   * invoice; minimal prompt = 6/6.
   *
   * Stage 2 (text): enrich the extracted names with sommelier analysis in
   * batches. Text calls have no image to ground against, so no refusal.
   * Enrichment failures degrade gracefully — basic wines still return.
   */
  async extractWineList(imageBase64: string, mimeType: string): Promise<import("./types").WineListExtractionResult> {
    if (!this.supportsVision) throw new Error(`${this.label} does not support image operations`);

    type BasicWine = { name: string; winery?: string; vintage?: number | null; type?: string; sparkling?: boolean; quantity?: number | null; estimatedPrice?: number | null };
    type ExtractStage1 = { wines: BasicWine[]; sourceName: string | null; currency: string } | { error: string };

    const stage1 = await this.generateVisionJSON<ExtractStage1>(
      wineListVisionExtractPrompt(), imageBase64, mimeType, 0.1,
      "Extract every wine line-item from this document (restaurant wine list, menu, store receipt, or purchase invoice). Return the result as a JSON object with the fields specified in the system instructions.");

    if ("error" in stage1) {
      // Surface the model's reason instead of silently reporting "no wines" —
      // wrapAI maps "not_a_wine_list" to a friendly UI message.
      throw new Error(String(stage1.error) || "not_a_wine_list");
    }

    const basic = (stage1.wines ?? []).filter((w) => w?.name);
    const base: import("./types").WineListExtractionResult = {
      wines: basic.map((w) => ({
        name: w.name,
        winery: w.winery || "",
        vintage: w.vintage ?? null,
        type: (w.type || "red") as import("./types").WineIdentification["type"],
        sparkling: w.sparkling ?? false,
        region: "", country: "", grapeVariety: "", description: "",
        // Receipts/invoices carry a qty column; default to a single bottle.
        quantity: Math.max(1, Math.round(Number(w.quantity) || 1)),
        estimatedPrice: w.estimatedPrice ?? null,
        alcohol: "", drinkBy: "", drinkWindow: "", disposition: "",
        ratings: null,
      })),
      sourceName: stage1.sourceName ?? null,
      currency: stage1.currency || "USD",
    };
    if (base.wines.length === 0) return base;

    // Stage 2 — enrich in batches of 8 (bounded output per call so the JSON
    // never truncates). Any batch failure leaves that batch basic.
    const BATCH = 8;
    for (let i = 0; i < base.wines.length; i += BATCH) {
      const slice = base.wines.slice(i, i + BATCH);
      try {
        const enriched = await this.generateJSON<{ wines: Array<Record<string, unknown>> }>(
          "You are a master sommelier. Return JSON only.",
          wineListEnrichmentPrompt(slice.map((w) => ({ name: w.name, winery: w.winery, vintage: w.vintage }))),
          0.2);
        for (let j = 0; j < slice.length; j++) {
          const e = enriched.wines?.[j];
          if (!e) continue;
          const t = base.wines[i + j];
          // Document-grounded fields (name/vintage/printed price) stay from
          // stage 1; knowledge fields come from enrichment.
          t.winery = (e.winery as string) || t.winery;
          t.type = ((e.type as string) || t.type) as typeof t.type;
          t.sparkling = typeof e.sparkling === "boolean" ? e.sparkling : t.sparkling;
          t.region = (e.region as string) || "";
          t.country = (e.country as string) || "";
          t.grapeVariety = (e.grapeVariety as string) || "";
          t.description = (e.description as string) || "";
          t.alcohol = (e.alcohol as string) || "";
          t.disposition = (e.disposition as string) || "";
          t.drinkBy = (e.drinkBy as string) || "";
          t.drinkWindow = (e.drinkWindow as string) || "";
          t.estimatedPrice = t.estimatedPrice ?? ((e.estimatedPrice as number) || null);
          t.ratings = (e.ratings as typeof t.ratings) ?? null;
        }
      } catch (err) {
        // Enrichment is best-effort — log and keep the basic extraction.
        console.error(`[${this.label}] wine-list enrichment batch ${i / BATCH} failed:`, err instanceof Error ? err.message : err);
      }
    }
    return base;
  }
  async generateTastingNotes(wine: WineDataInput): Promise<AiTastingNotesResult> {
    return this.generateJSON<AiTastingNotesResult>(
      "You are a professional sommelier. Return JSON tasting notes.", tastingNotesPrompt(wine), 0.3);
  }
  async generateFoodPairings(wine: WineDataInput): Promise<AiFoodPairingsResult> {
    return this.generateJSON<AiFoodPairingsResult>(
      "You are a sommelier. Suggest food pairings. Return JSON.", foodPairingsPrompt(wine), 0.3);
  }
  async estimatePrice(wine: WineDataInput): Promise<AiPriceEstimation> {
    return this.generateJSON<AiPriceEstimation>(
      "You are a wine pricing expert. Return JSON.", priceEstimationPrompt(wine), 0.1);
  }
  async suggestDrinkWindow(wine: WineDataInput): Promise<AiDrinkWindowResult> {
    return this.generateJSON<AiDrinkWindowResult>(
      "You are a wine aging expert. Return JSON.", drinkWindowPrompt(wine), 0.2);
  }
  async estimateCriticScores(wine: WineDataInput): Promise<AiCriticScoresResult> {
    return this.generateJSON<AiCriticScoresResult>(
      "You are a wine critic. Return JSON.", criticScoresPrompt(wine), 0.1);
  }
  async enrichWine(wine: WineDataInput): Promise<AiWineEnrichmentResult> {
    return this.generateJSON<AiWineEnrichmentResult>(
      "You are a wine expert. Return JSON.", wineEnrichmentPrompt(wine), 0.2);
  }
  async recommend(occasion: string, wines: Array<{ id: string; name: string; winery: string; vintage: number | null; type: string; disposition: string; drinkWindow: string }>): Promise<AiRecommendationResult> {
    return this.generateJSON<AiRecommendationResult>(
      "You are a sommelier recommending wines. Return JSON.", recommendationPrompt(occasion, wines), 0.4);
  }
  async decantRecommendation(wine: WineDataInput): Promise<AiDecantRecommendationResult> {
    return this.generateJSON<AiDecantRecommendationResult>(
      "You are a wine service expert. Return JSON.", decantRecommendationPrompt(wine), 0.2);
  }
  async batchDisposition(wines: Array<{ id: string; name: string; winery: string; vintage: number | null; type: string; region: string; drinkBy: string }>): Promise<BatchDispositionResult> {
    const text = await this.chatCompletion("You analyze wine dispositions. Map each wineId to D/H/P.", batchDispositionPrompt(wines), 0.1, true);
    return { dispositions: this.parseJSON<Record<string, string>>(text) };
  }
  async mealPairing(meal: string, wines: MealPairingWineInput[]): Promise<AiMealPairingResult> {
    return this.generateJSON<AiMealPairingResult>("You are a sommelier. Return JSON.", mealPairingPrompt(meal, wines), 0.4);
  }
  async terroirTwins(wine: WineDataInput, userWines: Array<{ id: string; name: string; winery: string; region: string; country: string; grapeVariety: string }>): Promise<AiTerroirTwinResult> {
    return this.generateJSON<AiTerroirTwinResult>("You are a terroir expert. Return JSON.", terroirTwinPrompt(wine, userWines), 0.5);
  }
  async pourCostCalculation(params: { guestCount: number; duration: number; budget?: number; courseCount: number; style: "casual" | "formal" | "mixed" }, wines: PourCostWineInput[]): Promise<AiPourCostResult> {
    return this.generateJSON<AiPourCostResult>("You are an event planner. Return JSON.", pourCostPrompt(params, wines), 0.3);
  }
  async vintageStory(region: string, country: string, vintage: number): Promise<VintageStoryResult> {
    return this.generateJSON<VintageStoryResult>(
      "You are a wine historian and meteorologist. Return JSON.",
      vintageStoryPrompt(region, country, vintage), 0.3);
  }
  async chat(systemPrompt: string, messages: Array<{ role: string; content: string }>): Promise<string> {
    const conversation = messages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");
    const prompt = `${systemPrompt}\n\nCONVERSATION:\n${conversation}\n\nRespond as the Assistant.`;
    return this.chatCompletion("You are a friendly sommelier. Be conversational.", prompt, 0.7, false);
  }

  async *chatStream(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>
  ): AsyncGenerator<string> {
    const conversation = messages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");
    const prompt = `${systemPrompt}\n\nCONVERSATION:\n${conversation}\n\nRespond as the Assistant.`;
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: "You are a friendly sommelier. Be conversational." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        stream: true,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "unknown");
      throw new Error(`${this.label} API error ${res.status}: ${text.substring(0, 500)}`);
    }
    // OpenAI-compatible server-sent events: "data: {json}" lines, then "data: [DONE]".
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) yield delta;
        } catch {
          // A keep-alive comment or a partial line; skip it.
        }
      }
    }
  }
}
