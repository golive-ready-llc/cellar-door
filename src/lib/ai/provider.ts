// Abstract AI provider interface — allows swapping between Gemini, OpenAI, etc.

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

export interface AIProvider {
  /** Identify/search a wine from a text query */
  searchWine(query: string): Promise<WineIdentification>;

  /** Autocomplete / search: return up to `limit` candidate wines matching a
   * partial name or winery string. Used by the name-autocomplete (default
   * limit 8) and the AI Search results dialog (limit up to 20). Cheap/fast
   * compared to searchWine (which returns one fully-populated identification). */
  searchWineSuggestions(query: string, limit?: number): Promise<WineSuggestionsResult>;

  /** Identify a wine from a label image */
  scanLabel(imageBase64: string, mimeType: string): Promise<WineIdentification>;

  /** Generate tasting notes for a wine */
  generateTastingNotes(wine: WineDataInput): Promise<AiTastingNotesResult>;

  /** Generate food pairing suggestions */
  generateFoodPairings(wine: WineDataInput): Promise<AiFoodPairingsResult>;

  /** Estimate market price */
  estimatePrice(wine: WineDataInput): Promise<AiPriceEstimation>;

  /** Suggest drink window and disposition */
  suggestDrinkWindow(wine: WineDataInput): Promise<AiDrinkWindowResult>;

  /** Estimate critic scores */
  estimateCriticScores(wine: WineDataInput): Promise<AiCriticScoresResult>;

  /** Unified enrichment — description, pairings, price, drink window, scores in one call */
  enrichWine(wine: WineDataInput): Promise<AiWineEnrichmentResult>;

  /** Extract wines from a wine list/receipt image */
  extractWineList(
    imageBase64: string,
    mimeType: string
  ): Promise<WineListExtractionResult>;

  /** Get a recommendation from the user's cellar */
  recommend(
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
  ): Promise<AiRecommendationResult>;

  /** Find a wine label image for a wine */
  fetchWineImage(wine: WineDataInput): Promise<AiWineImageResult>;

  /** Generate decant recommendation for a wine */
  decantRecommendation(wine: WineDataInput): Promise<AiDecantRecommendationResult>;

  /** Batch analyze dispositions for multiple wines */
  batchDisposition(
    wines: Array<{
      id: string;
      name: string;
      winery: string;
      vintage: number | null;
      type: string;
      region: string;
      drinkBy: string;
    }>
  ): Promise<BatchDispositionResult>;

  /** Find wine pairings for a meal from user's cellar */
  mealPairing(
    meal: string,
    wines: MealPairingWineInput[]
  ): Promise<AiMealPairingResult>;

  /** Find wines from different regions with similar terroir */
  terroirTwins(
    wine: WineDataInput,
    userWines: Array<{
      id: string;
      name: string;
      winery: string;
      region: string;
      country: string;
      grapeVariety: string;
    }>
  ): Promise<AiTerroirTwinResult>;

  /** Calculate pour costs for an event */
  pourCostCalculation(
    params: {
      guestCount: number;
      duration: number;
      budget?: number;
      courseCount: number;
      style: "casual" | "formal" | "mixed";
    },
    wines: PourCostWineInput[]
  ): Promise<AiPourCostResult>;

  /** Generate a vintage story for a wine region + year */
  vintageStory(
    region: string,
    country: string,
    vintage: number
  ): Promise<VintageStoryResult>;

  /**
   * Free-text chat (not JSON). Used by CellarChat for conversational
   * sommelier advice. Returns natural language response text.
   */
  chat(systemPrompt: string, messages: Array<{ role: string; content: string }>): Promise<string>;

  /**
   * Streaming variant of chat(): yields the reply in chunks as it's written.
   * Optional; callers fall back to chat() when a provider doesn't have it.
   */
  chatStream?(systemPrompt: string, messages: Array<{ role: string; content: string }>): AsyncIterable<string>;
}
