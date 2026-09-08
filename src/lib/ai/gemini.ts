// Google Gemini AI provider implementation
// Uses @google/genai SDK for all AI operations

import { GoogleGenAI } from "@google/genai";
import type { AIProvider } from "./provider";
import type {
  WineIdentification,
  AiTastingNotesResult,
  AiFoodPairingsResult,
  AiPriceEstimation,
  AiDrinkWindowResult,
  AiCriticScoresResult,
  AiWineEnrichmentResult,
  AiWineImageResult,
  WineListExtractionResult,
  AiRecommendationResult,
  AiDecantRecommendationResult,
  BatchDispositionResult,
  WineDataInput,
  AiMealPairingResult,
  MealPairingWineInput,
  AiTerroirTwinResult,
  AiPourCostResult,
  PourCostWineInput,
  WineSuggestionsResult,
  VintageStoryResult,
} from "./types";
import {
  wineSearchPrompt,
  wineSuggestionsPrompt,
  labelScanPrompt,
  tastingNotesPrompt,
  foodPairingsPrompt,
  priceEstimationPrompt,
  drinkWindowPrompt,
  criticScoresPrompt,
  wineEnrichmentPrompt,
  wineListExtractionPrompt,
  recommendationPrompt,
  batchDispositionPrompt,
  decantRecommendationPrompt,
  mealPairingPrompt,
  terroirTwinPrompt,
  pourCostPrompt,
  vintageStoryPrompt,
} from "./prompts";

// Model selection
const FAST_MODEL = "gemini-2.5-flash"; // Text operations
const VISION_MODEL = "gemini-2.5-flash"; // Vision operations (flash supports vision too)

export class GeminiProvider implements AIProvider {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  /**
   * Extract JSON from a model response that may include markdown code fences,
   * thinking tags, or extra prose around the JSON object/array.
   */
  private parseJSON<T>(text: string): T {
    if (!text || text.trim() === "") {
      throw new Error("Empty response from AI model");
    }
    // 1. Try direct parse first (fast path — works when responseMimeType:"application/json" is honoured)
    try {
      return JSON.parse(text) as T;
    } catch {
      // fall through to extraction
    }
    // 2. Strip markdown code fences: ```json ... ``` or ``` ... ```
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      try { return JSON.parse(fenceMatch[1].trim()) as T; } catch { /* continue */ }
    }
    // 3. Strip thinking tags (gemini-2.5 thinking model output)
    const noThinking = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
    try { return JSON.parse(noThinking) as T; } catch { /* continue */ }
    // 4. Extract the first {...} or [...] block
    const objMatch = noThinking.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (objMatch) {
      try { return JSON.parse(objMatch[1]) as T; } catch { /* continue */ }
    }
    throw new Error(`Could not parse JSON from model response. Preview: ${text.substring(0, 200)}`);
  }

  private async generateJSON<T>(
    prompt: string,
    model: string = FAST_MODEL,
    temperature: number = 0.1
  ): Promise<T> {
    const response = await this.client.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature,
      },
    });
    const text = response.text ?? "";
    return this.parseJSON<T>(text);
  }

  private async generateVisionJSON<T>(
    prompt: string,
    imageBase64: string,
    mimeType: string,
    temperature: number = 0.1
  ): Promise<T> {
    // Validate image size (max 20MB)
    const decodedSize = Math.ceil((imageBase64.length * 3) / 4);
    const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB
    if (decodedSize > MAX_IMAGE_BYTES) {
      throw new Error(`Image exceeds maximum size of 20MB (got ~${Math.round(decodedSize / (1024 * 1024))}MB)`);
    }
    // Validate MIME type
    const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Unsupported image type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`);
    }

    try {
      const response = await this.client.models.generateContent({
        model: VISION_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: imageBase64,
                  mimeType,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          temperature,
        },
      });
      const text = response.text ?? "";
      return this.parseJSON<T>(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Gemini Vision] FAILED: ${msg.substring(0, 500)}`);
      throw err;
    }
  }

  async searchWine(query: string): Promise<WineIdentification> {
    return this.generateJSON<WineIdentification>(
      wineSearchPrompt(query),
      FAST_MODEL,
      0.2
    );
  }

  async searchWineSuggestions(query: string, limit?: number): Promise<WineSuggestionsResult> {
    // Short query → empty result; avoid burning an AI call on 0-2 chars
    const trimmed = query.trim();
    if (trimmed.length < 2) return { suggestions: [] };
    return this.generateJSON<WineSuggestionsResult>(
      wineSuggestionsPrompt(trimmed, limit),
      FAST_MODEL,
      0.1
    );
  }

  async scanLabel(
    imageBase64: string,
    mimeType: string
  ): Promise<WineIdentification> {
    const result = await this.generateVisionJSON<
      WineIdentification | { error: string }
    >(labelScanPrompt(), imageBase64, mimeType, 0.1);

    if ("error" in result) {
      throw new Error(result.error);
    }
    return result;
  }

  async generateTastingNotes(
    wine: WineDataInput
  ): Promise<AiTastingNotesResult> {
    return this.generateJSON<AiTastingNotesResult>(
      tastingNotesPrompt(wine),
      FAST_MODEL,
      0.3 // Slightly more creative for tasting notes
    );
  }

  async generateFoodPairings(
    wine: WineDataInput
  ): Promise<AiFoodPairingsResult> {
    return this.generateJSON<AiFoodPairingsResult>(
      foodPairingsPrompt(wine),
      FAST_MODEL,
      0.3
    );
  }

  async estimatePrice(wine: WineDataInput): Promise<AiPriceEstimation> {
    return this.generateJSON<AiPriceEstimation>(
      priceEstimationPrompt(wine),
      FAST_MODEL,
      0.1
    );
  }

  async suggestDrinkWindow(wine: WineDataInput): Promise<AiDrinkWindowResult> {
    return this.generateJSON<AiDrinkWindowResult>(
      drinkWindowPrompt(wine),
      FAST_MODEL,
      0.2
    );
  }

  async estimateCriticScores(
    wine: WineDataInput
  ): Promise<AiCriticScoresResult> {
    return this.generateJSON<AiCriticScoresResult>(
      criticScoresPrompt(wine),
      FAST_MODEL,
      0.1
    );
  }

  async enrichWine(wine: WineDataInput): Promise<AiWineEnrichmentResult> {
    return this.generateJSON<AiWineEnrichmentResult>(
      wineEnrichmentPrompt(wine),
      FAST_MODEL,
      0.2
    );
  }

  async fetchWineImage(wine: WineDataInput): Promise<AiWineImageResult> {
    // Strategy: Gemini with Google Search grounding can't return direct image
    // URLs, but it CAN find wine product pages. The grounding metadata contains
    // redirect URIs to actual source pages. We follow those redirects, fetch
    // the page HTML, and extract the og:image meta tag — which wine retailers
    // reliably set to their bottle/label photo.
    const query = `${wine.name} ${wine.winery}${wine.vintage ? ` ${wine.vintage}` : ""}`;

    try {
      const response = await this.client.models.generateContent({
        model: FAST_MODEL,
        contents: `Find the product page for this wine: "${query}". Describe the wine briefly.`,
        config: { tools: [{ googleSearch: {} }], temperature: 0.1 },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const candidate = (response as any).candidates?.[0];
      const chunks: Array<{ web?: { uri?: string } }> =
        candidate?.groundingMetadata?.groundingChunks || [];


      for (const chunk of chunks.slice(0, 6)) {
        const redirectUrl = chunk?.web?.uri;
        if (!redirectUrl) continue;

        try {
          const redirectRes = await fetch(redirectUrl, {
            headers: { "User-Agent": "Mozilla/5.0" },
            redirect: "manual",
            signal: AbortSignal.timeout(5000),
          });
          const pageUrl = redirectRes.headers.get("location");
          if (!pageUrl) continue;

          // Validate pageUrl: must be an https URL pointing to a public host
          let parsedPageUrl: URL;
          try {
            parsedPageUrl = new URL(pageUrl);
            if (parsedPageUrl.protocol !== "https:") continue;
            // Skip common private/reserved hostnames
            const hostname = parsedPageUrl.hostname.toLowerCase();
            if (
              hostname === "localhost" ||
              hostname === "127.0.0.1" ||
              hostname === "0.0.0.0" ||
              hostname.startsWith("10.") ||
              hostname.startsWith("192.168.") ||
              hostname.startsWith("169.254.") ||
              hostname.startsWith("172.16.") ||
              hostname.endsWith(".local") ||
              hostname.endsWith(".internal")
            ) continue;
          } catch {
            continue; // Invalid URL
          }


          const pageRes = await fetch(pageUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
              Accept: "text/html,*/*",
            },
            signal: AbortSignal.timeout(10000),
          });

          if (!pageRes.ok) continue;
          const html = await pageRes.text();

          const ogMatch =
            html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

          if (!ogMatch) continue;

          let imageUrl = ogMatch[1];
          if (imageUrl.startsWith("//")) imageUrl = "https:" + imageUrl;


          const dataUrl = await this.downloadImageAsDataUrl(imageUrl, pageUrl);
          if (dataUrl) {
            return { imageUrl: dataUrl, source: "google" };
          }
        } catch {
          // Skip this chunk, try next
        }
      }
    } catch (e) {
      console.error("[fetchWineImage] error:", e);
    }

    return { imageUrl: "", source: "google" };
  }

  /** Download an image from a URL and convert to a data URL (base64) */
  private async downloadImageAsDataUrl(url: string, referer?: string): Promise<string | null> {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "image/*,*/*;q=0.8",
          Referer: referer || "https://www.google.com/",
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) return null;

      const contentType = res.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) return null;

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > 3_145_728 || buffer.length < 2048) return null;

      return `data:${contentType};base64,${buffer.toString("base64")}`;
    } catch {
      return null;
    }
  }

  async extractWineList(
    imageBase64: string,
    mimeType: string
  ): Promise<WineListExtractionResult> {
    const result = await this.generateVisionJSON<
      WineListExtractionResult | { error: string }
    >(wineListExtractionPrompt(), imageBase64, mimeType, 0.1);

    if ("error" in result) {
      console.warn("[Gemini] extractWineList rejected:", result.error);
      return { wines: [], sourceName: null, currency: "USD" };
    }
    return result;
  }

  async recommend(
    occasion: string,
    wines: Array<{
      id: string;
      name: string;
      winery: string;
      vintage: number | null;
      type: string;
      disposition: string;
      drinkWindow: string;
    }>
  ): Promise<AiRecommendationResult> {
    return this.generateJSON<AiRecommendationResult>(
      recommendationPrompt(occasion, wines),
      FAST_MODEL,
      0.4 // More creative for recommendations
    );
  }

  async decantRecommendation(wine: WineDataInput): Promise<AiDecantRecommendationResult> {
    return this.generateJSON<AiDecantRecommendationResult>(
      decantRecommendationPrompt(wine),
      FAST_MODEL,
      0.2
    );
  }

  async batchDisposition(
    wines: Array<{
      id: string;
      name: string;
      winery: string;
      vintage: number | null;
      type: string;
      region: string;
      drinkBy: string;
    }>
  ): Promise<BatchDispositionResult> {
    const dispositions = await this.generateJSON<Record<string, string>>(
      batchDispositionPrompt(wines),
      FAST_MODEL,
      0.1
    );
    return { dispositions };
  }

  async mealPairing(
    meal: string,
    wines: MealPairingWineInput[]
  ): Promise<AiMealPairingResult> {
    return this.generateJSON<AiMealPairingResult>(
      mealPairingPrompt(meal, wines),
      FAST_MODEL,
      0.4
    );
  }

  async terroirTwins(
    wine: WineDataInput,
    userWines: Array<{
      id: string;
      name: string;
      winery: string;
      region: string;
      country: string;
      grapeVariety: string;
    }>
  ): Promise<AiTerroirTwinResult> {
    return this.generateJSON<AiTerroirTwinResult>(
      terroirTwinPrompt(wine, userWines),
      FAST_MODEL,
      0.5
    );
  }

  async pourCostCalculation(
    params: {
      guestCount: number;
      duration: number;
      budget?: number;
      courseCount: number;
      style: "casual" | "formal" | "mixed";
    },
    wines: PourCostWineInput[]
  ): Promise<AiPourCostResult> {
    return this.generateJSON<AiPourCostResult>(
      pourCostPrompt(params, wines),
      FAST_MODEL,
      0.3
    );
  }

  async vintageStory(region: string, country: string, vintage: number): Promise<VintageStoryResult> {
    return this.generateJSON<VintageStoryResult>(
      vintageStoryPrompt(region, country, vintage),
      FAST_MODEL,
      0.3
    );
  }

  async chat(systemPrompt: string, messages: Array<{ role: string; content: string }>): Promise<string> {
    const conversation = messages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");
    const fullPrompt = `${systemPrompt}\n\nCONVERSATION:\n${conversation}\n\nRespond as the Assistant.`;

    const response = await this.client.models.generateContent({
      model: FAST_MODEL,
      contents: fullPrompt,
      config: { temperature: 0.7 },
    });
    return response.text ?? "I'm not sure how to respond to that.";
  }
}
