// AI service layer types for Cellar Door
// Defines request/response shapes for all AI operations

import type { WineType, AiRatings, TastingNotes } from "@/types/wine";

/** Full wine identification result from AI (label scan, text search, auto-fill) */
export interface WineIdentification {
  name: string;
  winery: string;
  vintage: number | null;
  type: WineType;
  /** Whether the wine is sparkling. Orthogonal to color — a rosé Champagne is type="rosé" and sparkling=true. */
  sparkling?: boolean;
  region: string;
  country: string;
  grapeVariety: string;
  description: string;
  estimatedPrice: number | null;
  alcohol: string;
  disposition: string; // "D" | "H" | "P"
  drinkBy: string;
  drinkWindow: string;
  ratings: AiRatings | null;
  /** Optional producer/style notes — populated by mock fixtures and some AI calls. */
  notes?: string;
  /** Bottles of this line item. Only meaningful for receipt/invoice extraction
   *  (a qty column or a "2 x" marker); defaults to 1 everywhere else. */
  quantity?: number;
}

/** AI-generated tasting notes */
export interface AiTastingNotesResult {
  tastingNotes: TastingNotes;
  description: string; // Updated/refined description
}

/** AI-generated food pairings */
export interface AiFoodPairingsResult {
  foodPairings: string; // Comma-separated list
  pairingNotes: string; // Brief explanation of why these pair well
}

/** AI price estimation result */
export interface AiPriceEstimation {
  estimatedPrice: number;
  priceRange: { low: number; high: number };
  confidence: "low" | "medium" | "high";
  notes: string;
}

/** AI drink window / disposition result */
export interface AiDrinkWindowResult {
  disposition: string; // "D" | "H" | "P"
  drinkBy: string;
  drinkWindow: string;
  notes: string;
}

/** AI critic score estimation result */
export interface AiCriticScoresResult {
  ratings: AiRatings;
  confidence: "low" | "medium" | "high";
  notes: string;
}

/** Wine data input for AI analysis (what we send to AI about an existing wine) */
export interface WineDataInput {
  name: string;
  winery: string;
  vintage: number | null;
  type: WineType;
  region: string;
  country: string;
  grapeVariety: string;
  description?: string;
  drinkBy?: string;
  price?: number | null;
}

/** Result from wine list/receipt extraction */
export interface WineListExtractionResult {
  wines: WineIdentification[];
  sourceName: string | null; // restaurant name, store name
  currency: string;
}

/** Batch disposition analysis result */
export interface BatchDispositionResult {
  dispositions: Record<string, string>; // wineId -> "D" | "H" | "P"
}

/** Unified AI wine enrichment result — single call for all AI data */
export interface AiWineEnrichmentResult {
  description: string;
  foodPairings: string;
  pairingNotes: string;
  estimatedPrice: number;
  priceRange: { low: number; high: number };
  disposition: string; // "D" | "H" | "P"
  drinkBy: string;
  drinkWindow: string;
  ratings: AiRatings;
  confidence: "low" | "medium" | "high";
}

/** Lightweight wine suggestion used for name-autocomplete. Intentionally
 * smaller than WineIdentification — only the fields needed to disambiguate
 * a candidate in a dropdown. */
export interface WineSuggestion {
  name: string;
  winery: string;
  vintage: number | null;
  type: WineType;
  region: string;
  country: string;
  grapeVariety: string;
}

/** Result of a wine-name autocomplete search. */
export interface WineSuggestionsResult {
  suggestions: WineSuggestion[];
}

/** AI wine image search result */
export interface AiWineImageResult {
  imageUrl: string;
  source: string; // e.g. "google", "vivino", "mock"
}

/** AI decant recommendation result */
export interface AiDecantRecommendationResult {
  decantMinutes: number; // 0-180
  recommended: boolean;
  explanation: string;
}

/** AI recommendation result */
export interface AiRecommendationResult {
  wineId: string;
  reasoning: string;
  occasion: string;
  pairingsSuggestion: string;
}

/** Taste profile / Flavor Genome result */
export interface TasteProfileResult {
  body: number;
  tannin: number;
  acidity: number;
  sweetness: number;
  fruit: number;
  oak: number;
  summary: string;
}

/** Multi-slice Flavor Genome — one AI call returns all three slices.
 *  `red` / `white` are null when fewer than 3 wines of that type exist. */
export interface TasteProfileBundle {
  all: TasteProfileResult;
  red: TasteProfileResult | null;
  white: TasteProfileResult | null;
}

/** Vintage story result */
export interface VintageStoryResult {
  rating: string;
  narrative: string;
  weather: string;
}

/** Wine input for meal pairing (subset of full wine data) */
export interface MealPairingWineInput {
  id: string;
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  grapeVariety: string;
  region: string;
  country: string;
  description: string;
  foodPairings: string;
  disposition: string;
}

/** Single meal pairing match */
export interface MealPairingMatch {
  wineId: string;
  wineName: string;
  winery: string;
  vintage: number | null;
  pairingExplanation: string;
  confidence: "perfect" | "great" | "worth_trying";
}

/** AI meal pairing result */
export interface AiMealPairingResult {
  matches: MealPairingMatch[];
  /** Suggestions if no good matches exist in cellar */
  buySuggestions: Array<{
    name: string;
    type: string;
    grapeVariety: string;
    region: string;
    reason: string;
  }>;
}

/** Single terroir twin match */
export interface TerroirTwinMatch {
  name: string;
  winery: string;
  region: string;
  country: string;
  grapeVariety: string;
  sharedTerroir: string;
  explanation: string;
  inCellar: boolean;
  cellarWineId?: string;
}

/** AI terroir twin result */
export interface AiTerroirTwinResult {
  twins: TerroirTwinMatch[];
}

/** Wine input for pour cost calculation */
export interface PourCostWineInput {
  id: string;
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  grapeVariety: string;
  region: string;
  country: string;
  price: number | null;
  disposition: string;
}

/** Single wine in a pour cost course */
export interface PourCostWine {
  wineId: string;
  wineName: string;
  winery: string;
  vintage: number | null;
  bottlesNeeded: number;
  poursPerBottle: number;
  reason: string;
}

/** Course in pour cost result */
export interface PourCostCourse {
  courseName: string;
  wines: PourCostWine[];
}

/** Shopping list item for gaps */
export interface PourCostShoppingItem {
  name: string;
  type: string;
  grapeVariety: string;
  quantity: number;
  estimatedPrice: number;
  reason: string;
}

/** AI pour cost calculation result */
export interface AiPourCostResult {
  courses: PourCostCourse[];
  totalBottles: number;
  estimatedCost: number;
  perGuestCost: number;
  shoppingList: PourCostShoppingItem[];
}
