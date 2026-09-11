"use server";
// Server actions wrapping AI provider calls
// API keys stay server-side — client components call these actions

import { getAIProvider, isAIAvailable } from "@/lib/ai";
import { MockAIProvider } from "@/lib/ai/mock";
import type { AIProvider } from "@/lib/ai/provider";
import { isDemoRequest } from "@/lib/demo";
import * as Sentry from "@sentry/nextjs";

// Singleton mock provider reused across demo requests so the same query
// always returns the same (deterministic) mock result.
let _demoMock: MockAIProvider | null = null;
function getDemoMockProvider(): AIProvider {
  if (!_demoMock) _demoMock = new MockAIProvider();
  return _demoMock;
}

/**
 * Returns the real Gemini provider for authenticated users, or a fast
 * deterministic mock provider for demo-mode visitors. Demo users never
 * hit the paid API (zero credit burn).
 */
async function getProviderForRequest(): Promise<AIProvider> {
  if (await isDemoRequest()) return getDemoMockProvider();
  return getAIProvider();
}
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
  BatchDispositionResult,
  WineDataInput,
  WineSuggestionsResult,
} from "@/lib/ai";
import {
  requireFeature,
  reserveAiCredits,
  getAiCreditsRemaining,
  TierError,
} from "@/server/tier-check";
import { getAuthenticatedUserId, resolveServerUserId } from "@/server/auth-guard";
import { metadataWhere } from "@/lib/wine-metadata-key";
import type { TierFeatures, AiOperation } from "@/lib/tier";

/**
 * Build an AI gate for the current request.
 *
 * The caller is identified ONLY by the verified `__session` cookie. The
 * client-supplied id is ignored: exported "use server" functions are public
 * endpoints, so trusting it let anyone spend a paying user's AI credits. That
 * fallback (the audit #1 rollback) was removed 2026-09-10; every signed-in
 * client already gets the session cookie during auth init, and all other
 * server actions rely on it via resolveServerUserId.
 *
 * Returns `null` for demo-mode visitors (mock provider, no gate needed).
 * Throws "Unauthorized" when there is no verified session.
 */
async function buildGate(
  feature: keyof TierFeatures,
  operation?: AiOperation,
  credits?: number,
  clientUserId?: string
): Promise<AIGate | null> {
  if (await isDemoRequest()) return null;
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  if (clientUserId && clientUserId !== userId) {
    console.warn("[ai] client-supplied userId ignored; using the verified session");
  }
  return { userId, feature, operation, credits };
}

/**
 * Scope for the per-user in-memory result caches and the in-flight dedup map.
 * Uses the verified session, never the client-supplied id, so a spoofed id
 * can't read another user's cached (paid) result.
 */
async function cacheScope(): Promise<string> {
  if (await isDemoRequest()) return "demo";
  return (await getAuthenticatedUserId()) ?? "anon";
}

// ─── Helpers ───────────────────────────────────────────────────

/** In-flight request cache: deduplicates concurrent AI calls with the same (operation, query) key. */
const inflightRequests = new Map<string, Promise<unknown>>();
const INFLIGHT_TTL = 10_000; // 10 seconds max

function deduplicate<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflightRequests.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => {
    // Don't remove immediately — keep in map briefly to catch rapid repeats
    setTimeout(() => { inflightRequests.delete(key); }, INFLIGHT_TTL);
  });
  inflightRequests.set(key, promise);
  return promise;
}

export type AIResult<T> =
  | { success: true; data: T; isMock: boolean }
  | { success: false; error: string; code?: "UPGRADE_REQUIRED" | "WINE_LIMIT_REACHED" | "CREDITS_EXHAUSTED" };

interface AIGate {
  userId: string;
  feature: keyof TierFeatures;
  operation?: AiOperation;
  credits?: number;
}

async function wrapAI<T>(
  fn: () => Promise<T>,
  gateBuilder?: () => Promise<AIGate | null>
): Promise<AIResult<T>> {
  // Reservation is held outside the try so a thrown AI call can refund.
  let reservation: Awaited<ReturnType<typeof reserveAiCredits>> | null = null;
  try {
    // Resolve the gate INSIDE the try so an "Unauthorized" throw from
    // server-side auth resolution becomes a clean error response.
    const gate = gateBuilder ? await gateBuilder() : null;

    if (gate) {
      // 1. Tier feature gate (still throws TierError on UPGRADE_REQUIRED).
      await requireFeature(gate.userId, gate.feature);
      // 2. ATOMICALLY reserve credits BEFORE the AI call. This closes the
      //    TOCTOU race that existed between the old check + consume pair —
      //    two concurrent requests can no longer both pass the check and
      //    overspend the cap.
      if (gate.operation && gate.credits) {
        reservation = await reserveAiCredits(gate.userId, gate.operation, gate.credits);
        if (!reservation.ok) {
          throw new TierError("CREDITS_EXHAUSTED", reservation.tier, reservation.message);
        }
      }
    }

    const data = await fn();
    // Success — reservation stays consumed. No further DB write needed.
    return { success: true, data, isMock: !(await isAIAvailable()) };
  } catch (err) {
    // Refund the reservation if the AI call (or anything after the reserve)
    // threw. We don't refund on the gate-builder / requireFeature path since
    // no credits were charged in those failure modes.
    if (reservation?.ok) {
      await reservation.refundOnFailure().catch((e) =>
        console.error("[AI credit refund failed]", e)
      );
    }
    if (err instanceof TierError) {
      return { success: false, error: err.message, code: err.code };
    }
    const raw = String(err instanceof Error ? err.message : err);
    if (raw === "Unauthorized") {
      return { success: false, error: "Unauthorized" };
    }
    console.error("[AI Error]", raw);
    Sentry.captureMessage("[AI Error] " + raw, { level: "error", extra: { raw } });
    let msg = raw;
    if (raw.includes("401") || raw.includes("API_KEY_INVALID") || raw.includes("API key not valid")) {
      msg = "AI provider authentication failed (401). Check your API key is valid.";
    } else if (raw.includes("RESOURCE_EXHAUSTED") || raw.includes("quota") || raw.includes("429")) {
      msg = "AI service is busy or rate-limited. Please wait a moment and try again.";
    } else if (raw.includes("not_a_wine_label")) {
      msg = "not_a_wine_label";
    } else if (raw.includes("not_a_wine_list")) {
      msg = "not_a_wine_list";
    } else if (raw.includes("PERMISSION_DENIED") || raw.includes("403")) {
      msg = "AI service configuration error. Check your provider settings.";
    } else {
      msg = raw.slice(0, 300);
    }
    return { success: false, error: msg };
  }
}

// ─── Public Server Actions ─────────────────────────────────────

/** Search/identify a wine from a text query and auto-fill fields */
export async function aiSearchWine(
  query: string,
  _userId?: string
): Promise<AIResult<WineIdentification>> {
  // Check in-memory cache first. Key is scoped by userId: a cache HIT returns
  // before buildGate()/reserveAiCredits(), so a shared key let one user's paid
  // lookup be served free to every other user (credit-metering bypass).
  const cacheKey = `search::${await cacheScope()}::${query.toLowerCase().trim()}`;
  const cached = wineIdCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < WINE_ID_CACHE_TTL) {
    return { success: true, data: cached.data, isMock: false };
  }

  const result = await wrapAI(
    async () => (await getProviderForRequest()).searchWine(query),
    () => buildGate("barcodeAiLookup", "auto_fill", 1, _userId)
  );

  // Cache successful results in-memory
  if (result.success) {
    wineIdCache.set(cacheKey, { data: result.data, cachedAt: Date.now() }); capCache(wineIdCache);
  }

  // Post-save: cache metadata for future lookups
  if (result.success && result.data.name && result.data.winery) {
    const { saveWineMetadata } = await import("@/server/wine-metadata-store");
    saveWineMetadata(result.data).catch(() => {});
  }
  return result;
}

/**
 * Name-autocomplete search — returns up to ~8 candidate wines that match a
 * partial query. Tier-gated to `barcodeAiLookup` (PRO+). Cheap operation
 * (0 credits) since it's called with every keystroke from the UI.
 */
export async function aiSearchWineSuggestions(
  query: string,
  _userId?: string,
  limit?: number
): Promise<AIResult<WineSuggestionsResult>> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { success: true, data: { suggestions: [] }, isMock: false };
  }
  const clamped = Math.max(1, Math.min(20, limit ?? 8));
  // Scope the in-flight dedup key by userId — otherwise a concurrent identical
  // query from a different user shares this user's promise (and its gate).
  const key = `suggestions::${await cacheScope()}::${trimmed}::${clamped}`;
  return deduplicate(key, () => wrapAI(
    async () => (await getProviderForRequest()).searchWineSuggestions(trimmed, clamped),
    () => buildGate("barcodeAiLookup", "auto_fill", 0, _userId)
  ));
}

/** Look up a wine by UPC barcode — checks cache, then Open Food Facts, then AI */
export async function aiBarcodeLookup(
  barcode: string,
  _userId?: string
): Promise<AIResult<WineIdentification>> {
  // Reject anything that isn't a plausible UPC/EAN (6–14 digits). This is an
  // exported (publicly reachable) server action and `barcode` is interpolated
  // into the Open Food Facts URL — validating here prevents unauthenticated
  // path-manipulation of that outbound request and junk writes to the shared
  // barcode / wine-metadata caches.
  const code = barcode.trim();
  if (!/^[0-9]{6,14}$/.test(code)) {
    return { success: false, error: "Invalid barcode" };
  }

  // Check in-memory cache first (fastest path). Scoped by userId so the
  // per-user credit gate isn't bypassed by another user's cached lookup.
  // (The shared DB barcodeCache below is intentionally universal — a UPC maps
  // to the same wine for everyone — and is checked separately.)
  const barcodeCacheKey = `barcode::${await cacheScope()}::${code}`;
  const memCached = wineIdCache.get(barcodeCacheKey);
  if (memCached && Date.now() - memCached.cachedAt < WINE_ID_CACHE_TTL) {
    return { success: true, data: memCached.data, isMock: false };
  }

  const prisma = (await import("@/lib/db")).prisma;

  // 1. Check DB cache next
  const cached = await prisma.barcodeCache.findUnique({ where: { barcode: code } });
  if (cached) {
    return { success: true, data: cached.data as unknown as WineIdentification, isMock: false };
  }

  // 2. Try Open Food Facts (free, no API key)
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.status === 1 && json.product) {
        const p = json.product;
        const name = p.product_name || "";
        // Only use if it looks like a wine product
        const cats = (p.categories_tags || []).join(",").toLowerCase();
        const isWine = cats.includes("wine") || cats.includes("vin")
          || (p.categories || "").toLowerCase().includes("wine");
        if (name && isWine) {
          const inferred = inferWineStyle(cats, name);
          const wineData: WineIdentification = {
            name: name,
            winery: p.brands || "",
            vintage: null,
            type: inferred.type as import("@/types/wine").WineType,
            sparkling: inferred.sparkling,
            grapeVariety: p.labels || "",
            region: p.origins || p.manufacturing_places || "",
            country: p.countries || "",
            description: "",
            estimatedPrice: null,
            alcohol: p.nutriments?.alcohol_100g ? `${p.nutriments.alcohol_100g}%` : "",
            drinkBy: "",
            drinkWindow: "",
            disposition: "",
            ratings: null,
          };
          // Cache the result in both barcode cache and wine metadata
          await prisma.barcodeCache.create({
            data: { barcode: code, data: wineData as unknown as import("@/generated/prisma/client").Prisma.InputJsonValue },
          }).catch((err) => {
            // P2002 = unique constraint violation (duplicate barcode) — safe to ignore
            if ((err as { code?: string }).code !== "P2002") {
              console.error("[barcode cache write error]", err);
            }
          });
          // Populate in-memory cache
          wineIdCache.set(barcodeCacheKey, { data: wineData, cachedAt: Date.now() }); capCache(wineIdCache);
          const { saveWineMetadata } = await import("@/server/wine-metadata-store");
          saveWineMetadata(wineData).catch(() => {});
          return { success: true, data: wineData, isMock: false };
        }
      }
    }
  } catch {
    // Open Food Facts failed, continue to AI fallback
  }

  // 3. Fall back to AI search with the barcode
  const aiResult = await wrapAI(
    async () => (await getProviderForRequest()).searchWine(`Wine with UPC/EAN barcode: ${code}. Identify the exact wine.`),
    () => buildGate("barcodeAiLookup", "auto_fill", 1, _userId)
  );

  // Cache successful AI results in both in-memory and DB caches
  if (aiResult.success) {
    wineIdCache.set(barcodeCacheKey, { data: aiResult.data, cachedAt: Date.now() }); capCache(wineIdCache);
    await prisma.barcodeCache.create({
      data: { barcode: code, data: aiResult.data as unknown as import("@/generated/prisma/client").Prisma.InputJsonValue },
    }).catch((err) => {
      if ((err as { code?: string }).code !== "P2002") {
        console.error("[barcode cache write error]", err);
      }
    });
    const { saveWineMetadata } = await import("@/server/wine-metadata-store");
    saveWineMetadata(aiResult.data).catch(() => {});
  }

  return aiResult;
}

/** Infer wine color + sparkling from free-text metadata. Color and sparkling are independent. */
function inferWineStyle(categories: string, name: string): { type: string; sparkling: boolean } {
  const lower = (categories + " " + name).toLowerCase();
  const sparkling =
    lower.includes("sparkling") ||
    lower.includes("champagne") ||
    lower.includes("prosecco") ||
    lower.includes("cava") ||
    lower.includes("crémant") ||
    lower.includes("cremant") ||
    lower.includes("franciacorta") ||
    /\bbrut\b/.test(lower) ||
    /\bspumante\b/.test(lower);

  // Color
  if (lower.includes("rosé") || lower.includes("rosado") || lower.match(/\brose\b/)) {
    return { type: "rosé", sparkling };
  }
  if (
    lower.includes("white") ||
    lower.includes("blanc") ||
    lower.includes("chardonnay") ||
    lower.includes("sauvignon blanc") ||
    lower.includes("riesling") ||
    lower.includes("pinot grigio")
  ) {
    return { type: "white", sparkling };
  }
  if (
    lower.includes("dessert") ||
    lower.includes("sauternes") ||
    lower.includes("tokaji") ||
    lower.includes("ice wine") ||
    lower.includes("late harvest")
  ) {
    return { type: "dessert", sparkling };
  }
  if (lower.includes("port") || lower.includes("sherry") || lower.includes("madeira") || lower.includes("fortified")) {
    return { type: "fortified", sparkling };
  }
  if (lower.includes("orange")) return { type: "orange", sparkling };
  if (lower.includes("green") || lower.includes("vinho verde")) return { type: "green", sparkling };
  // If no color hints but clearly sparkling, default color to white (most sparklers are white)
  if (sparkling) return { type: "white", sparkling: true };
  return { type: "red", sparkling: false };
}


/** Scan a wine label image and identify the wine */
export async function aiScanLabel(
  imageBase64: string,
  mimeType: string,
  _userId?: string
): Promise<AIResult<WineIdentification>> {
  const result = await wrapAI(
    async () => (await getProviderForRequest()).scanLabel(imageBase64, mimeType),
    () => buildGate("labelScanning", "label_scan", 2, _userId)
  );
  // Post-save: cache metadata for future enrichment lookups
  if (result.success && result.data.name && result.data.winery) {
    const { saveWineMetadata } = await import("@/server/wine-metadata-store");
    saveWineMetadata(result.data).catch(() => {});
  }
  return result;
}

/** Generate tasting notes for a wine */
export async function aiGenerateTastingNotes(
  wine: WineDataInput,
  _userId?: string
): Promise<AIResult<AiTastingNotesResult>> {
  return wrapAI(
    async () => (await getProviderForRequest()).generateTastingNotes(wine),
    () => buildGate("wineEnrichment", "enrich_text", 1, _userId)
  );
}

/** Generate food pairing suggestions */
export async function aiGenerateFoodPairings(
  wine: WineDataInput,
  _userId?: string
): Promise<AIResult<AiFoodPairingsResult>> {
  return wrapAI(
    async () => (await getProviderForRequest()).generateFoodPairings(wine),
    () => buildGate("wineEnrichment", "enrich_text", 1, _userId)
  );
}

/** Estimate current market price */
export async function aiEstimatePrice(
  wine: WineDataInput,
  _userId?: string
): Promise<AIResult<AiPriceEstimation>> {
  return wrapAI(
    async () => (await getProviderForRequest()).estimatePrice(wine),
    () => buildGate("wineEnrichment", "enrich_text", 1, _userId)
  );
}

/** Suggest drink window and disposition */
export async function aiSuggestDrinkWindow(
  wine: WineDataInput,
  _userId?: string
): Promise<AIResult<AiDrinkWindowResult>> {
  return wrapAI(
    async () => (await getProviderForRequest()).suggestDrinkWindow(wine),
    () => buildGate("wineEnrichment", "enrich_text", 1, _userId)
  );
}

/** Estimate critic scores */
export async function aiEstimateCriticScores(
  wine: WineDataInput,
  _userId?: string
): Promise<AIResult<AiCriticScoresResult>> {
  const result = await wrapAI(
    async () => (await getProviderForRequest()).estimateCriticScores(wine),
    () => buildGate("wineEnrichment", "enrich_text", 1, _userId)
  );
  // Post-save: cache the scores in WineMetadata so future adds of this wine
  // resolve their Expert Score from the cache instead of a paid AI call.
  // Never cache demo/mock results — fabricated scores must not pollute the
  // shared cache.
  if (result.success && !result.isMock && result.data.ratings &&
      wine.name && wine.winery && !(await isDemoRequest())) {
    const { saveWineMetadata } = await import("@/server/wine-metadata-store");
    saveWineMetadata({
      name: wine.name,
      winery: wine.winery,
      vintage: wine.vintage ?? null,
      ratings: result.data.ratings,
    }).catch(() => {});
  }
  return result;
}

/** Unified wine enrichment — description, pairings, price, drink window, scores in one call */
export async function aiEnrichWine(
  wine: WineDataInput,
  _userId?: string
): Promise<AIResult<AiWineEnrichmentResult>> {
  // Pre-lookup: check enrichment cache (30-day TTL) before calling AI
  if (wine.winery && wine.name) {
    const { getEnrichmentCache } = await import("@/lib/ai/cache");
    const cached = await getEnrichmentCache(wine.winery, wine.name, wine.vintage ?? null);
    if (cached) {
      return { success: true, data: cached.data, isMock: false };
    }
  }

  const result = await wrapAI(
    async () => (await getProviderForRequest()).enrichWine(wine),
    () => buildGate("wineEnrichment", "enrich_text", 1, _userId)
  );

  // Post-save: store in enrichment cache for future lookups
  if (result.success && wine.name && wine.winery) {
    const { setEnrichmentCache } = await import("@/lib/ai/cache");
    setEnrichmentCache(wine.winery, wine.name, wine.vintage ?? null, result.data).catch(() => {});
  }

  return result;
}

/** Fetch a wine label image using AI (uses expensive Google Search grounding) */
export async function aiFetchWineImage(
  wine: WineDataInput,
  _userId?: string
): Promise<AIResult<AiWineImageResult>> {
  // Pre-lookup: check if we already have an image URL cached (saves 5 credits)
  if (wine.winery && wine.name) {
    const db = (await import("@/lib/db")).prisma;
    const cached = await db.wineMetadata.findFirst({
      where: {
        ...metadataWhere(wine.winery, wine.name, wine.vintage ?? null),
        imageUrl: { not: "" },
      },
      select: { imageUrl: true },
    });
    if (cached?.imageUrl) {
      return { success: true, data: { imageUrl: cached.imageUrl, source: "google" as const }, isMock: false };
    }
  }

  const result = await wrapAI(
    async () => (await getProviderForRequest()).fetchWineImage(wine),
    () => buildGate("aiFindImage", "find_image", 5, _userId)
  );

  // Post-save: cache the image URL
  if (result.success && result.data.imageUrl && wine.winery && wine.name) {
    const { saveWineMetadataImage } = await import("@/server/wine-metadata-store");
    saveWineMetadataImage(wine.winery, wine.name, wine.vintage, result.data.imageUrl).catch(() => {});
  }

  return result;
}

/** Extract wines from a wine list/receipt photo */
export async function aiExtractWineList(
  imageBase64: string,
  mimeType: string,
  _userId?: string
): Promise<AIResult<WineListExtractionResult>> {
  return wrapAI(
    async () => (await getProviderForRequest()).extractWineList(imageBase64, mimeType),
    () => buildGate("labelScanning", "label_scan", 2, _userId)
  );
}

/** Get a wine recommendation from the cellar */
export async function aiRecommend(
  occasion: string,
  wines: Array<{
    id: string;
    name: string;
    winery: string;
    vintage: number | null;
    type: string;
    disposition: string;
    drinkWindow: string;
  }>,
  _userId?: string
): Promise<AIResult<AiRecommendationResult>> {
  return wrapAI(
    async () => (await getProviderForRequest()).recommend(occasion, wines),
    () => buildGate("recommendations", "chat", 1, _userId)
  );
}

/** Batch analyze dispositions */
export async function aiBatchDisposition(
  wines: Array<{
    id: string;
    name: string;
    winery: string;
    vintage: number | null;
    type: string;
    region: string;
    drinkBy: string;
  }>,
  _userId?: string
): Promise<AIResult<BatchDispositionResult>> {
  return wrapAI(
    async () => (await getProviderForRequest()).batchDisposition(wines),
    () => buildGate("wineEnrichment", "enrich_text", 1, _userId)
  );
}

/** Personalized recommendation based on user's rating history */
export async function aiPersonalizedRecommend(
  ratedWines: Array<{
    name: string;
    winery: string;
    vintage: number | null;
    type: string;
    region: string;
    grapeVariety: string;
    rating: number;
  }>,
  cellarWines: Array<{
    id: string;
    name: string;
    winery: string;
    vintage: number | null;
    type: string;
    disposition: string;
    drinkWindow: string;
  }>,
  _userId?: string
): Promise<AIResult<AiRecommendationResult>> {
  // Build a rich occasion string that includes the user's taste profile
  const topRated = ratedWines
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10);

  const tasteContext = topRated
    .map((w) => `${w.name} (${w.type}, ${w.grapeVariety || "unknown grape"}, ${w.region || "unknown region"}) - rated ${w.rating}/5`)
    .join("; ");

  const occasion = `Based on my taste profile (I highly rated: ${tasteContext}), what should I open tonight?`;

  return wrapAI(
    async () => (await getProviderForRequest()).recommend(occasion, cellarWines),
    () => buildGate("recommendations", "chat", 1, _userId)
  );
}

/** Get a decant recommendation for a wine */
export async function aiDecantRecommendation(
  wine: WineDataInput,
  _userId?: string
): Promise<AIResult<import("@/lib/ai").AiDecantRecommendationResult>> {
  return wrapAI(
    async () => (await getProviderForRequest()).decantRecommendation(wine),
    () => buildGate("wineEnrichment", "enrich_text", 1, _userId)
  );
}

/** Generate a vintage story for a wine region + year */
// In-memory cache for vintage stories (avoids polluting WineMetadata table with synthetic keys)
const vintageStoryCache = new Map<string, { data: import("@/lib/ai").VintageStoryResult; cachedAt: number }>();
const VINTAGE_STORY_CACHE_TTL = 3_600_000; // 1 hour

/** In-memory cache for wine identifications — avoids repeat API calls for popular searches. */
const wineIdCache = new Map<string, { data: WineIdentification; cachedAt: number }>();

/** Bound the in-memory result caches so a long-lived server can't grow them forever. */
const RESULT_CACHE_MAX = 500;
function capCache(cache: Map<string, unknown>): void {
  while (cache.size > RESULT_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}
const WINE_ID_CACHE_TTL = 86_400_000; // 24 hours

export async function aiVintageStory(
  region: string,
  country: string,
  vintage: number,
  _userId?: string
): Promise<AIResult<import("@/lib/ai").VintageStoryResult>> {
  // Scoped by userId so a cache hit doesn't serve one user's paid result to
  // another for free (the hit returns before buildGate/reserveAiCredits).
  const cacheKey = `vintage-story::${await cacheScope()}::${region.toLowerCase()}::${country.toLowerCase()}::${vintage}`;

  // Check in-memory cache first
  const cached = vintageStoryCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < VINTAGE_STORY_CACHE_TTL) {
    return { success: true, data: cached.data, isMock: false };
  }

  const result = await wrapAI(
    async () => (await getProviderForRequest()).vintageStory(region, country, vintage),
    () => buildGate("wineEnrichment", "enrich_text", 1, _userId)
  );

  // Cache successful results in-memory
  if (result.success) {
    vintageStoryCache.set(cacheKey, { data: result.data, cachedAt: Date.now() }); capCache(vintageStoryCache);
  }

  return result;
}

/** Check if real AI is available */
export async function aiCheckAvailability(): Promise<{
  available: boolean;
  provider: string;
}> {
  const available = await isAIAvailable();
  if (!available) return { available: false, provider: "mock" };

  // Determine which provider is actually configured — don't hardcode "gemini".
  try {
    const { getAIConfig } = await import("@/lib/ai/config");
    const config = await getAIConfig();
    const provider = config.text.provider
      || config.textFailover.provider
      || config.vision.provider
      || (process.env.GEMINI_API_KEY ? "gemini" : "unknown");
    return { available: true, provider };
  } catch {
    return { available: true, provider: process.env.GEMINI_API_KEY ? "gemini" : "unknown" };
  }
}

/** Get remaining AI credits for the current user (for UI display) */
/** The signed-in caller's own credit usage. The userId argument is not trusted. */
export async function getCreditsRemaining(userId?: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
}> {
  const uid = await resolveServerUserId(userId);
  const result = await getAiCreditsRemaining(uid);
  return { used: result.used, limit: result.limit, remaining: result.remaining };
}

/** Cork & Fork — find wines from the cellar that pair with a meal */
export async function aiMealPairing(
  meal: string,
  wines: Array<{
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
  }>,
  _userId?: string
): Promise<AIResult<import("@/lib/ai").AiMealPairingResult>> {
  return wrapAI(
    async () => (await getProviderForRequest()).mealPairing(meal, wines),
    () => buildGate("recommendations", "chat", 1, _userId)
  );
}

/** Pour Cost Calculator — plan wine service for an event */
export async function aiPourCostCalculation(
  params: {
    guestCount: number;
    duration: number;
    budget?: number;
    courseCount: number;
    style: "casual" | "formal" | "mixed";
  },
  wines: Array<{
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
  }>,
  _userId?: string
): Promise<AIResult<import("@/lib/ai").AiPourCostResult>> {
  return wrapAI(
    async () => (await getProviderForRequest()).pourCostCalculation(params, wines),
    () => buildGate("recommendations", "chat", 2, _userId)
  );
}

/** Terroir Twin Finder — find wines from different regions with similar terroir */
export async function aiTerroirTwins(
  wine: WineDataInput,
  userWines: Array<{
    id: string;
    name: string;
    winery: string;
    region: string;
    country: string;
    grapeVariety: string;
  }>,
  _userId?: string
): Promise<AIResult<import("@/lib/ai").AiTerroirTwinResult>> {
  return wrapAI(
    async () => (await getProviderForRequest()).terroirTwins(wine, userWines),
    () => buildGate("recommendations", "chat", 1, _userId)
  );
}
