// Centralized prompt templates for AI operations
// All prompts return JSON — structured output

const CURRENT_YEAR = new Date().getFullYear();

// ─── Shared rules ──────────────────────────────────────────────
const WINE_TYPE_RULE = `Type (the COLOR) must be exactly one of: red, white, rosé, dessert, orange, green, fortified.
"sparkling" is a SEPARATE boolean field, orthogonal to color — e.g. rosé Champagne has type="rosé" AND sparkling=true. Blanc de Blancs Champagne is type="white" + sparkling=true. Prosecco is type="white" + sparkling=true.
DO NOT default to "red". Determine type from (in priority order):

1. Explicit text on the label — these ALWAYS override grape variety and bottle color:
   - "rosé"/"rosado"/"rosato"/"rosato" anywhere on label → type="rosé" (EVEN if the bottle is dark/black and EVEN if grapes include Pinot Noir)
   - "blanc"/"white"/"blanc de blancs"/"blanc de noirs" → type="white"
   - "rouge"/"red" → type="red"
   - "rosé brut"/"brut rosé"/"rosé sparkling"/"sparkling rosé"/"rosé wine" → type="rosé", sparkling=true
   - "brut"/"extra brut"/"demi-sec"/"champagne"/"prosecco"/"cava"/"crémant"/"sekt"/"cap classique"/"sparkling wine"/"mousseux"/"espumante" → sparkling=true (determine color separately; default to white if no color word present)
   CRITICAL: Dark bottle color NEVER implies red wine. "Rosé" text on a dark bottle is still rosé. A wine named "X Rosé Sparkling Wine" is ALWAYS type="rosé" + sparkling=true.

2. Grape variety — only when no explicit style word is present:
   WHITE grapes: Chardonnay, Sauvignon Blanc, Riesling, Pinot Grigio/Gris, Garganega (Soave), Trebbiano, Viognier, Chenin Blanc, Albariño, Gewürztraminer, Semillon, Grüner Veltliner.
   RED grapes (→ type="red" ONLY when not in a rosé/sparkling rosé context): Cabernet, Merlot, Sangiovese, Syrah/Shiraz, Malbec, Tempranillo, Nebbiolo, Grenache, Zinfandel, Barbera.
   IMPORTANT: Pinot Noir does NOT imply red — it is the primary grape in rosé Champagne, sparkling rosé, and Blanc de Noirs. When "rosé" or sparkling context is present alongside Pinot Noir, the type is NOT "red".

3. Region (only when neither text nor grape variety resolves type):
   Soave/Sancerre/Chablis/Mosel/Marlborough Sauvignon=white; Champagne/Franciacorta/Cava region=sparkling; Bordeaux/Rioja/Napa Cab/Barolo=red.

4. Fortified: Port, Sherry, Madeira, Marsala, Banyuls. Dessert: Sauternes, Tokaji, ice wine, late-harvest.

If none of the above are clear, return the best inference — never blindly pick "red".`;
const DISPOSITION_RULE = `Disposition must be exactly "D" (Drink Now — within or past its ideal drinking window), "H" (Hold — not yet in its drinking window), or "P" (Past Peak — well past its prime, declining quality).
IMPORTANT: Base disposition on the CURRENT YEAR (${CURRENT_YEAR}) vs the wine's drink window:
- If ${CURRENT_YEAR} is within or past the drink window start → "D" (Drink Now)
- If ${CURRENT_YEAR} is before the drink window start → "H" (Hold)
- If ${CURRENT_YEAR} is well past the drink window end → "P" (Past Peak)
General guidelines for setting the drink window:
- Everyday wines (under $20): drink within 1-3 years of vintage → usually "D"
- Quality reds (Bordeaux, Barolo, Napa Cab $20-80): drink 5-10 years after vintage
- Premium/iconic (1er Cru, top Napa, $80+): drink 10-20+ years after vintage
- White/rosé: drink within 1-3 years unless premium Burgundy/Riesling
- Sparkling: Drink Now unless vintage Champagne
- NV wines: always "D"
CRITICAL: Most wines (~70%) should be "D" (Drink Now). Only set "H" for wines that genuinely need more aging. When in doubt, prefer "D" over "H". Everyday wines, grocery store wines, wines 3+ years old, and most whites/rosés should almost always be "D".`;
const RATING_RULE = `Critic ratings use the 50-100 scale. Only estimate if the wine is well-known enough.
- WS = Wine Spectator, RP = Robert Parker / Wine Advocate
- JD = Jeb Dunnuck, AG = Antonio Galloni / Vinous
- Use null for any score you cannot reasonably estimate.`;
const JSON_ONLY = `Return ONLY valid JSON. No markdown, no explanation, no code fences.`;

// ─── Wine Search / Auto-Fill ───────────────────────────────────
/**
 * Suggestions prompt — returns up to `limit` distinct candidate wines
 * matching a partial name. Used by both the per-keystroke autocomplete
 * dropdown (limit ~8) and the AI Search full-results dialog (limit ~20).
 * Kept intentionally narrow (just enough fields to disambiguate in a
 * dropdown) so we can call it cheaply.
 */
export function wineSuggestionsPrompt(query: string, limit: number = 8): string {
  const max = Math.max(1, Math.min(20, limit));
  return `You are a wine database. Return up to ${max} distinct real wines whose name, winery, or region matches the partial query below. Skip imaginary or unlikely matches. Prefer well-known producers.

Query: "${query}"

${JSON_ONLY}

Return this exact JSON shape:
{
  "suggestions": [
    {
      "name": "string (full wine name)",
      "winery": "string (producer)",
      "vintage": number or null,
      "type": "red|white|rosé|dessert|orange|green|fortified|sparkling",
      "region": "string (may be empty)",
      "country": "string (may be empty)",
      "grapeVariety": "string (may be empty)"
    }
  ]
}

Rules:
- If query is empty or fewer than 2 characters, return {"suggestions": []}.
- No duplicate (name + winery) combinations.
- If the query already looks like a winery, suggest that winery's flagship bottlings.
- If vintage unclear, return null.`;
}

export function wineSearchPrompt(query: string): string {
  return `You are a master sommelier and wine database expert. The current year is ${CURRENT_YEAR}.

A user is searching for a wine. Identify the wine from this query and provide complete details.

Query: "${query}"

${JSON_ONLY}

Return a JSON object with these exact fields:
{
  "name": "string (full wine name, NOT the winery name)",
  "winery": "string (producer/winery/domaine/château)",
  "vintage": number or null (for NV wines),
  "type": "red|white|rosé|dessert|orange|green|fortified",
  "sparkling": true|false,
  "region": "string (specific appellation/sub-region)",
  "country": "string",
  "grapeVariety": "string (primary grape or blend description)",
  "description": "string (2-3 sentence tasting profile)",
  "estimatedPrice": number or null (USD retail estimate),
  "alcohol": "string (e.g. '14.5%')",
  "disposition": "D|H|P",
  "drinkBy": "string (year, e.g. '2028')",
  "drinkWindow": "string (e.g. '2025-2030')",
  "ratings": {
    "rating_ws": number or null,
    "rating_rp": number or null,
    "rating_jd": number or null,
    "rating_ag": number or null
  },
  "notes": "string (brief additional notes)"
}

${WINE_TYPE_RULE}
${DISPOSITION_RULE}
${RATING_RULE}`;
}

// ─── Label Scanning (Vision) ───────────────────────────────────
export function labelScanPrompt(): string {
  return `You are a master sommelier and wine label recognition expert. The current year is ${CURRENT_YEAR}.

Analyze this wine label image, identify the wine, and provide a full assessment.

${JSON_ONLY}

Return a JSON object with these exact fields:
{
  "name": "string (full wine name including style/cuvée)",
  "winery": "string (producer/winery/domaine/château name)",
  "vintage": number or null (for NV wines),
  "type": "red|white|rosé|dessert|orange|green|fortified",
  "sparkling": true|false,
  "region": "string",
  "country": "string",
  "grapeVariety": "string",
  "description": "string (2-3 sentence tasting profile)",
  "estimatedPrice": number or null (USD retail estimate),
  "alcohol": "string (e.g. '14.5%')",
  "disposition": "D|H|P",
  "drinkBy": "string (year)",
  "drinkWindow": "string (e.g. '2025-2030')",
  "ratings": {
    "rating_ws": number or null,
    "rating_rp": number or null,
    "rating_jd": number or null,
    "rating_ag": number or null
  }
}

${WINE_TYPE_RULE}
${DISPOSITION_RULE}
${RATING_RULE}

If the image is NOT a wine label, return: {"error": "not_a_wine_label"}`;
}

// ─── Tasting Notes Generation ──────────────────────────────────
export function tastingNotesPrompt(wine: {
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  country: string;
  grapeVariety: string;
}): string {
  return `You are a master sommelier. Generate professional tasting notes for this wine.

Wine: ${wine.name}
Winery: ${wine.winery}
Vintage: ${wine.vintage ?? "NV"}
Type: ${wine.type}
Region: ${wine.region}
Country: ${wine.country}
Grape: ${wine.grapeVariety}

${JSON_ONLY}

Return a JSON object:
{
  "tastingNotes": {
    "aroma": "string (2-3 sentences describing nose/bouquet)",
    "taste": "string (2-3 sentences describing palate/flavors)",
    "finish": "string (1-2 sentences describing the finish/aftertaste)",
    "overall": "string (1-2 sentence overall assessment)"
  },
  "description": "string (concise 2-3 sentence overall tasting profile)"
}

Be specific and vivid. Reference typical characteristics of the grape, region, and vintage.`;
}

// ─── Food Pairings ─────────────────────────────────────────────
export function foodPairingsPrompt(wine: {
  name: string;
  winery: string;
  type: string;
  grapeVariety: string;
  region: string;
  description?: string;
}): string {
  return `You are a master sommelier specializing in food and wine pairings.

Wine: ${wine.name}
Winery: ${wine.winery}
Type: ${wine.type}
Grape: ${wine.grapeVariety}
Region: ${wine.region}
${wine.description ? `Description: ${wine.description}` : ""}

${JSON_ONLY}

Return a JSON object:
{
  "foodPairings": "string (comma-separated list of 6-8 specific food pairings, from simple to complex)",
  "pairingNotes": "string (2-3 sentences explaining why these pairings work)"
}

Be specific (e.g. "grilled lamb chops with rosemary" not just "lamb"). Include at least one cheese pairing.`;
}

// ─── Price Estimation ──────────────────────────────────────────
export function priceEstimationPrompt(wine: {
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  country: string;
}): string {
  return `You are a wine market expert. Estimate the current US retail price for this wine.

Wine: ${wine.name}
Winery: ${wine.winery}
Vintage: ${wine.vintage ?? "NV"}
Type: ${wine.type}
Region: ${wine.region}
Country: ${wine.country}

${JSON_ONLY}

Return a JSON object:
{
  "estimatedPrice": number (USD, best estimate for current retail),
  "priceRange": { "low": number, "high": number },
  "confidence": "low|medium|high",
  "notes": "string (brief explanation of pricing factors)"
}`;
}

// ─── Drink Window / Disposition ────────────────────────────────
export function drinkWindowPrompt(wine: {
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  country: string;
  grapeVariety: string;
  drinkBy?: string;
}): string {
  return `You are a master sommelier specializing in wine aging and cellaring advice. The current year is ${CURRENT_YEAR}.

Wine: ${wine.name}
Winery: ${wine.winery}
Vintage: ${wine.vintage ?? "NV"}
Type: ${wine.type}
Region: ${wine.region}
Country: ${wine.country}
Grape: ${wine.grapeVariety}
${wine.drinkBy ? `Current drink_by: ${wine.drinkBy}` : ""}

${JSON_ONLY}

Return a JSON object:
{
  "disposition": "D|H|P",
  "drinkBy": "string (last recommended year to drink, e.g. '2030')",
  "drinkWindow": "string (range, e.g. '2025-2030')",
  "notes": "string (brief explanation of aging potential)"
}

${DISPOSITION_RULE}`;
}

// ─── Critic Scores ─────────────────────────────────────────────
export function criticScoresPrompt(wine: {
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  country: string;
}): string {
  return `You are a wine critic score researcher. Estimate or recall actual critic scores for this wine.

Wine: ${wine.name}
Winery: ${wine.winery}
Vintage: ${wine.vintage ?? "NV"}
Type: ${wine.type}
Region: ${wine.region}
Country: ${wine.country}

${JSON_ONLY}

Return a JSON object:
{
  "ratings": {
    "rating_ws": number or null,
    "rating_rp": number or null,
    "rating_jd": number or null,
    "rating_ag": number or null
  },
  "confidence": "low|medium|high",
  "notes": "string (brief explanation — are these recalled scores or estimates?)"
}

${RATING_RULE}
Only return scores you are reasonably confident about. Use null for critics who likely haven't reviewed this wine.`;
}

// ─── Unified Wine Enrichment ──────────────────────────────────
export function wineEnrichmentPrompt(wine: {
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  country: string;
  grapeVariety: string;
  description?: string;
  drinkBy?: string;
  price?: number | null;
}): string {
  return `You are a master sommelier, wine critic researcher, and market expert. The current year is ${CURRENT_YEAR}.

Provide a comprehensive enrichment for this wine in a SINGLE response. Include description, food pairings, price estimate, drink window/disposition, and critic score estimates.

Wine: ${wine.name}
Winery: ${wine.winery}
Vintage: ${wine.vintage ?? "NV"}
Type: ${wine.type}
Region: ${wine.region}
Country: ${wine.country}
Grape: ${wine.grapeVariety}
${wine.description ? `Current description: ${wine.description}` : ""}
${wine.drinkBy ? `Current drink_by: ${wine.drinkBy}` : ""}
${wine.price ? `Purchase price: $${wine.price}` : ""}

${JSON_ONLY}

Return a JSON object with ALL of these fields:
{
  "description": "string (concise 2-3 sentence tasting profile and character of the wine)",
  "foodPairings": "string (comma-separated list of 6-8 specific food pairings)",
  "pairingNotes": "string (2-3 sentences explaining why these pairings work)",
  "estimatedPrice": number (USD current retail estimate),
  "priceRange": { "low": number, "high": number },
  "disposition": "D|H|P",
  "drinkBy": "string (last recommended year to drink, e.g. '2030')",
  "drinkWindow": "string (range, e.g. '2025-2030')",
  "ratings": {
    "rating_ws": number or null,
    "rating_rp": number or null,
    "rating_jd": number or null,
    "rating_ag": number or null
  },
  "confidence": "low|medium|high"
}

${WINE_TYPE_RULE}
${DISPOSITION_RULE}
${RATING_RULE}

Be specific with food pairings (e.g. "grilled lamb chops with rosemary" not just "lamb"). Include at least one cheese pairing.
Only return critic scores you are reasonably confident about. Use null for critics who likely haven't reviewed this wine.`;
}

// ─── Wine List / Receipt Extraction (Vision) ───────────────────
export function wineListExtractionPrompt(): string {
  return `You are a master sommelier. The current year is ${CURRENT_YEAR}.

Analyze this photograph of a restaurant wine list, wine menu, store receipt, or purchase receipt.
Extract EVERY wine listed on the page and provide expert analysis for each.

${JSON_ONLY}

Return a JSON object with this structure:
{
  "wines": [
    {
      "name": "string (wine name, NOT winery)",
      "winery": "string",
      "vintage": number or null,
      "type": "red|white|rosé|dessert|orange|green|fortified",
  "sparkling": true|false,
      "region": "string",
      "country": "string",
      "grapeVariety": "string",
      "description": "string (2-3 sentence tasting profile)",
      "estimatedPrice": number or null (US retail estimate),
      "alcohol": "string",
      "disposition": "D|H|P",
      "drinkBy": "string",
      "drinkWindow": "string",
      "ratings": {
        "rating_ws": null,
        "rating_rp": null,
        "rating_jd": null,
        "rating_ag": null
      },
      "notes": "string"
    }
  ],
  "sourceName": "string or null (restaurant/store name if visible)",
  "currency": "string (e.g. 'USD')"
}

${WINE_TYPE_RULE}
${DISPOSITION_RULE}

Extract ALL wines visible. For receipts, include only wine items (skip food, tax, tips).
Preserve the order wines appear on the document. If no wines are visible, return an empty wines array.

IMPORTANT: Never return an error. Always return the JSON structure above, even if the wines array is empty.
`;
}

/**
 * Stage 1 of the two-stage wine-list/receipt extraction: a deliberately
 * MINIMAL document-grounded schema.
 *
 * Why two stages: Qwen3-VL (the configured Alibaba vision model) refuses
 * multi-item extraction whenever the schema demands fields that are not
 * printed on the document (description, region, disposition, ratings...) —
 * its anti-hallucination tuning makes it return an empty wines array
 * instead of inferring. Verified empirically: the rich single-call prompt
 * above returns 0 wines on a crystal-clear 6-wine invoice, while this
 * minimal schema extracts all 6. Rich analysis fields are added by a
 * follow-up TEXT call (wineListEnrichmentPrompt) which has no image to
 * ground against and therefore no refusal.
 */
export function wineListVisionExtractPrompt(): string {
  return `You are a wine-document reader. The current year is ${CURRENT_YEAR}.

The photo is a restaurant wine list, wine menu, store receipt, or purchase invoice.
List EVERY wine line-item you can read on the document. Do not skip any. Skip non-wine items (food, tax, tip, deposit).

${JSON_ONLY}

Return a JSON object:
{
  "wines": [
    {
      "name": "string (the wine's name as printed, NOT the producer alone)",
      "winery": "string (producer, if identifiable from the printed text)",
      "vintage": number or null (year printed with the wine),
      "type": "red|white|rosé|dessert|orange|green|fortified",
      "sparkling": true|false,
      "quantity": number (how many bottles of this line item — read the qty/count column or a leading "2 x" / "x2" marker; use 1 when no quantity is printed),
      "estimatedPrice": number or null (the UNIT price PRINTED next to this wine, omit currency symbol)
    }
  ],
  "sourceName": "string or null (restaurant/store name if visible)",
  "currency": "string (e.g. 'USD')"
}

Preserve document order. If no wines are visible, return an empty wines array.`;
}

/**
 * Stage 2: text-only expert enrichment of the wines extracted by stage 1.
 * No image involved — pure wine-knowledge lookup, so vision-grounding
 * refusals don't apply.
 */
export function wineListEnrichmentPrompt(
  wines: Array<{ name: string; winery?: string; vintage?: number | null }>
): string {
  const list = wines
    .map((w, i) => `${i + 1}. ${w.name}${w.winery ? ` — ${w.winery}` : ""}${w.vintage ? ` (${w.vintage})` : ""}`)
    .join("\n");
  return `You are a master sommelier. The current year is ${CURRENT_YEAR}.
For each wine below, provide expert analysis from your own wine knowledge.

${JSON_ONLY}

Return a JSON object:
{
  "wines": [
    {
      "name": "string (echo the wine's name from the list EXACTLY)",
      "winery": "string",
      "type": "red|white|rosé|dessert|orange|green|fortified",
      "sparkling": true|false,
      "region": "string",
      "country": "string",
      "grapeVariety": "string",
      "description": "string (2-3 sentence tasting profile)",
      "estimatedPrice": number or null (typical US retail price),
      "alcohol": "string (e.g. '13.5%')",
      "disposition": "D|H|P",
      "drinkBy": "string",
      "drinkWindow": "string (e.g. '2024-2028')",
      "ratings": { "rating_ws": number|null, "rating_rp": number|null, "rating_jd": number|null, "rating_ag": number|null }
    }
  ]
}

${WINE_TYPE_RULE}
${DISPOSITION_RULE}

Return the wines in the SAME ORDER as the input list, one output entry per input wine. Use "" or null for fields you genuinely don't know.

WINES:
${list}`;
}

// ─── Recommendation ────────────────────────────────────────────
export function recommendationPrompt(
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
): string {
  const wineList = wines
    .map(
      (w) =>
        `ID:${w.id}|${w.name}|${w.winery}|${w.vintage ?? "NV"}|${w.type}|${w.disposition}|${w.drinkWindow}`
    )
    .join("\n");

  return `You are a personal sommelier. The current year is ${CURRENT_YEAR}.

The user wants a wine recommendation for: "${occasion}"

Here are the wines in their cellar:
${wineList}

${JSON_ONLY}

Return a JSON object:
{
  "wineId": "string (the ID of the recommended wine)",
  "reasoning": "string (2-3 sentences explaining why this wine is perfect for the occasion)",
  "occasion": "string (the occasion restated)",
  "pairingsSuggestion": "string (1-2 food pairing ideas for this occasion)"
}

Prefer wines with disposition "D" (Drink Now). Consider the occasion context carefully.`;
}

// ─── Batch Disposition Analysis ────────────────────────────────
export function batchDispositionPrompt(
  wines: Array<{
    id: string;
    name: string;
    winery: string;
    vintage: number | null;
    type: string;
    region: string;
    drinkBy: string;
  }>
): string {
  const wineList = wines
    .map(
      (w) =>
        `ID:${w.id}|${w.name}|${w.winery}|${w.vintage ?? "NV"}|${w.type}|${w.region}|drink_by:${w.drinkBy}`
    )
    .join("\n");

  return `You are a master sommelier. The current year is ${CURRENT_YEAR}.

Analyze each wine and assign a disposition. Return ONLY a JSON object mapping wine IDs to dispositions.

${wineList}

${JSON_ONLY}

Return:
{
  "wine_id_1": "D",
  "wine_id_2": "H",
  "wine_id_3": "P"
}

${DISPOSITION_RULE}`;
}

// ─── Decant Recommendation ────────────────────────────────────
export function decantRecommendationPrompt(wine: {
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  country: string;
  grapeVariety: string;
}): string {
  const age = wine.vintage ? CURRENT_YEAR - wine.vintage : null;
  return `You are a master sommelier specializing in wine service and decanting. The current year is ${CURRENT_YEAR}.

A user is about to open this wine and wants to know if and how long they should decant it.

Wine: ${wine.name}
Winery: ${wine.winery}
Vintage: ${wine.vintage ?? "NV"}${age !== null ? ` (${age} years old)` : ""}
Type: ${wine.type}
Region: ${wine.region}
Country: ${wine.country}
Grape: ${wine.grapeVariety}

${JSON_ONLY}

Return a JSON object:
{
  "decantMinutes": number (0-180, how many minutes to decant. 0 means no decanting needed),
  "recommended": boolean (true if decanting is recommended, false if the wine should NOT be decanted),
  "explanation": "string (2-3 sentences explaining why this wine should or should not be decanted, mentioning specifics about the varietal, age, and what to expect)"
}

Guidelines:
- Young tannic reds (Cabernet, Nebbiolo, Syrah, Malbec under 5 years): 30-60 minutes
- Medium-aged reds (5-15 years): 15-45 minutes
- Old reds (15+ years): 0-15 minutes or not at all (fragile wines can fall apart)
- Full-bodied whites (oaked Chardonnay, Viognier): 15-30 minutes
- Light whites, rosé, sparkling: do NOT decant (recommended: false, decantMinutes: 0)
- Dessert wines: generally do not decant unless young Port
- Natural/orange wines: may benefit from 15-30 minutes
- If the wine should not be decanted, set recommended to false and decantMinutes to 0
- Be specific in your explanation — mention tannin structure, fruit development, etc.`;
}

// ─── Personalized Recommendation ────────────────────────────────
export function personalizedRecommendationPrompt(
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
    region: string;
    grapeVariety: string;
    disposition: string;
    drinkWindow: string;
  }>
): string {
  const ratedList = ratedWines
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 20)
    .map(
      (w) =>
        `${w.name}|${w.winery}|${w.vintage ?? "NV"}|${w.type}|${w.region}|${w.grapeVariety}|rating:${w.rating}`
    )
    .join("\n");

  const cellarList = cellarWines
    .map(
      (w) =>
        `ID:${w.id}|${w.name}|${w.winery}|${w.vintage ?? "NV"}|${w.type}|${w.region}|${w.grapeVariety}|${w.disposition}|${w.drinkWindow}`
    )
    .join("\n");

  return `You are a personal sommelier AI. The current year is ${CURRENT_YEAR}.

Analyze the user's highest-rated wines to understand their taste profile, then recommend the best wine to open tonight from their cellar.

USER'S TOP RATED WINES:
${ratedList}

CURRENT CELLAR:
${cellarList}

${JSON_ONLY}

Return a JSON object:
{
  "tasteProfile": "string (2-3 sentences summarizing their preferences - grape, region, style patterns)",
  "wineId": "string (the ID of the recommended wine from their cellar)",
  "reasoning": "string (2-3 sentences explaining why this wine matches their taste profile)",
  "alternativeId": "string or null (second choice ID)",
  "alternativeReasoning": "string or null (why the alternative is also good)"
}

Strongly prefer wines with disposition "D" (Drink Now). Consider their flavor preferences based on what they've rated highest.`;
}

// ─── Challenge Generation ─────────────────────────────────────
export function challengePrompt(
  wines: Array<{
    name: string;
    type: string;
    country: string;
    region: string;
    vintage: number | null;
    grapeVariety: string;
    userRating: number | null;
  }>,
  history: Array<{
    name: string;
    type: string;
    country: string;
    region: string;
    rating: number | null;
  }>,
  recentChallenges: Array<{ title: string; type: string }>
): string {
  const typeCounts: Record<string, number> = {};
  const countryCounts: Record<string, number> = {};
  const unratedCount = wines.filter((w) => !w.userRating).length;
  const oldestVintage = wines
    .filter((w) => w.vintage)
    .sort((a, b) => (a.vintage ?? 9999) - (b.vintage ?? 9999))[0];

  for (const w of wines) {
    if (w.type) typeCounts[w.type] = (typeCounts[w.type] || 0) + 1;
    if (w.country)
      countryCounts[w.country] = (countryCounts[w.country] || 0) + 1;
  }

  const historyCountries = new Set(
    history.map((h) => h.country).filter(Boolean)
  );

  const recentTitles = recentChallenges.map((c) => c.title).join(", ");

  return `You are a fun, encouraging wine coach. The current year is ${CURRENT_YEAR}.

Generate ONE creative weekly challenge for a wine enthusiast based on their cellar.

CELLAR SUMMARY:
- Total bottles: ${wines.length}
- Types: ${Object.entries(typeCounts)
    .map(([t, c]) => `${c} ${t}`)
    .join(", ")}
- Countries: ${Object.entries(countryCounts)
    .map(([c, n]) => `${c} (${n})`)
    .join(", ")}
- Unrated wines: ${unratedCount} of ${wines.length}
- Oldest bottle: ${oldestVintage ? `${oldestVintage.name} (${oldestVintage.vintage})` : "N/A"}
- Recently consumed countries: ${[...historyCountries].join(", ") || "None"}

${recentTitles ? `AVOID repeating these recent challenges: ${recentTitles}` : ""}

Challenge types: "taste" (tasting/rating), "explore" (try something new), "share" (social), "learn" (education/blind tasting).

${JSON_ONLY}

Return a JSON object:
{
  "title": "string (short, catchy title, max 50 chars)",
  "description": "string (fun, encouraging 1-2 sentences explaining the challenge)",
  "type": "taste|explore|share|learn",
  "criteria": { "action": "string", "filter": {} }
}

Be creative, fun, and personalized. Reference their actual cellar contents when possible.`;
}

// ─── Taste Profile / Flavor Genome ────────────────────────────
type TasteProfileWine = {
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  grapeVariety: string;
  userRating: number | null;
};

function formatWineList(wines: TasteProfileWine[]): string {
  return wines
    .map(
      (w) =>
        `${w.name}|${w.winery}|${w.vintage ?? "NV"}|${w.type}|${w.region}|${w.grapeVariety}${w.userRating ? `|rating:${w.userRating}` : ""}`
    )
    .join("\n");
}

/**
 * Multi-slice taste profile prompt — asks Gemini to compute up to three
 * Flavor Genome profiles (all / reds-only / whites-only) in a SINGLE
 * structured response. Each slice is null when its wine list is empty
 * (caller passes [] when there are fewer than 3 wines of that type).
 */
export function tasteProfilePrompt(
  allWines: TasteProfileWine[],
  redWines: TasteProfileWine[],
  whiteWines: TasteProfileWine[]
): string {
  const allList = formatWineList(allWines);
  const redSection = redWines.length >= 3
    ? `RED WINES (for "red" slice):\n${formatWineList(redWines)}`
    : `RED WINES: (insufficient — return null for "red")`;
  const whiteSection = whiteWines.length >= 3
    ? `WHITE WINES (for "white" slice):\n${formatWineList(whiteWines)}`
    : `WHITE WINES: (insufficient — return null for "white")`;

  return `You are a master sommelier analyzing a wine collection to build personal taste profiles.

Examine the wines below and determine the owner's taste preferences across 6 axes (each scored 1-10) for THREE separate slices of the collection in ONE response:
- "all": the entire collection
- "red": red-style wines only (red, fortified, orange) — return null if insufficient data
- "white": white-style wines only (white, rosé, sparkling, dessert, green) — return null if insufficient data

ALL WINES (for "all" slice):
${allList}

${redSection}

${whiteSection}

${JSON_ONLY}

Return a JSON object with this exact shape:
{
  "all": {
    "body": number (1=light, 10=full-bodied),
    "tannin": number (1=low tannin, 10=high tannin),
    "acidity": number (1=low acidity, 10=high acidity),
    "sweetness": number (1=bone dry, 10=very sweet),
    "fruit": number (1=subtle fruit, 10=bold fruit-forward),
    "oak": number (1=no oak, 10=heavy oak influence),
    "summary": "string (one sentence describing the taste profile, e.g. 'You prefer bold, tannic reds with moderate oak')"
  },
  "red": { same shape as "all" } | null,
  "white": { same shape as "all" } | null
}

Base scores on each slice's character. Weight highly-rated wines more. Consider grape varieties, regions, and wine types to infer preferences. The "summary" sentence should be tailored to that slice (e.g. red summary describes only their red preferences).`;
}

// ─── Vintage Time Machine ──────────────────────────────────────
export function vintageStoryPrompt(
  region: string,
  country: string,
  vintage: number
): string {
  return `You are a wine historian and meteorologist specializing in viticulture.

Tell the story of the ${vintage} vintage in ${region}, ${country}.

${JSON_ONLY}

Return a JSON object:
{
  "rating": "string (one of: 'Exceptional', 'Excellent', 'Very Good', 'Good', 'Average', 'Challenging', 'Difficult')",
  "narrative": "string (2-3 sentences about the growing season — what made this vintage special or challenging, harvest conditions, and how the wines turned out)",
  "weather": "string (1 sentence summarizing key weather events during the growing season)"
}

Be specific about the region. Reference actual climate patterns, rainfall, heat waves, frost events, or other weather that affected the vintage. If the vintage is too recent or obscure, provide your best assessment based on general regional patterns.`;
}

// ─── Meal Pairing (Cork & Fork) ──────────────────────────────
export function mealPairingPrompt(
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
  }>
): string {
  const wineList = wines
    .map(
      (w) =>
        `ID:${w.id}|${w.name}|${w.winery}|${w.vintage ?? "NV"}|${w.type}|grape:${w.grapeVariety}|region:${w.region}|country:${w.country}|pairings:${w.foodPairings}|disposition:${w.disposition}`
    )
    .join("\n");

  return `You are an expert sommelier and food-pairing specialist. The current year is ${CURRENT_YEAR}.

The user is having this meal: "${meal}"

Here are ALL the wines in their cellar:
${wineList}

Select the top 3 wines that would pair best with this meal. Consider:
- Classic food+wine pairing principles (acidity, weight, flavor bridges)
- CRITICAL: ONLY recommend wines with disposition "D" (Drink Now) or empty disposition. NEVER recommend wines with disposition "H" (Hold) — they are not ready to drink yet. If no "D" wines match, recommend fewer than 3 or suggest wines to buy instead.
- Grape variety and regional pairing traditions
- The existing foodPairings data if available

For each match, assign a confidence level:
- "perfect": A textbook pairing, the wine and meal are ideal together
- "great": An excellent match, will enhance the dining experience
- "worth_trying": A solid option that could surprise and delight

If fewer than 3 wines from the cellar are suitable, include only those that genuinely work.

If NO wines in the cellar are good matches, return an empty matches array and provide buySuggestions instead (3-5 wines they should consider buying).

${JSON_ONLY}

Return a JSON object:
{
  "matches": [
    {
      "wineId": "string (ID of the matched wine)",
      "wineName": "string (name of the wine)",
      "winery": "string",
      "vintage": number | null,
      "pairingExplanation": "string (1-2 sentences explaining why this wine pairs well with the meal)",
      "confidence": "perfect" | "great" | "worth_trying"
    }
  ],
  "buySuggestions": [
    {
      "name": "string (wine name or grape variety)",
      "type": "string (red, white, rosé, sparkling, etc.)",
      "grapeVariety": "string",
      "region": "string",
      "reason": "string (1 sentence explaining why this would pair well)"
    }
  ]
}`;
}

// ─── Pour Cost Calculator ─────────────────────────────────────
export function pourCostPrompt(
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
  }>
): string {
  const wineList = wines
    .map(
      (w) =>
        `ID:${w.id}|${w.name}|${w.winery}|${w.vintage ?? "NV"}|${w.type}|grape:${w.grapeVariety}|region:${w.region}|price:${w.price ?? "unknown"}|disposition:${w.disposition}`
    )
    .join("\n");

  const courseNames = ["aperitif", "starter", "main course", "cheese", "dessert"];
  const coursesForEvent = courseNames.slice(0, params.courseCount).join(", ");

  return `You are an expert sommelier and event planner specializing in wine service logistics. The current year is ${CURRENT_YEAR}.

Plan the wine service for an event with these parameters:
- Guests: ${params.guestCount}
- Duration: ${params.duration} hours
- Style: ${params.style}
- Courses: ${params.courseCount} (${coursesForEvent})
${params.budget ? `- Budget: $${params.budget}` : "- Budget: no limit"}

Standard pour: 5 pours per 750ml bottle.
${params.style === "casual" ? "Casual events: ~2-3 glasses per guest per hour." : params.style === "formal" ? "Formal events: 1 glass per course per guest." : "Mixed events: 1-2 glasses per course, slightly more for main."}

Here are ALL wines available in the cellar:
${wineList}

Select the best wines from the cellar for each course. Prefer wines with disposition "D" (Drink Now).
Consider wine type appropriateness per course (sparkling/white for aperitif, reds for mains, dessert wines for dessert, etc.).
Calculate bottles needed based on guest count and pours per bottle.
${params.budget ? `Stay within the $${params.budget} budget using purchase prices from the cellar.` : ""}

If the cellar doesn't have enough variety or quantity for all courses, include a shoppingList of wines to buy.

${JSON_ONLY}

Return a JSON object:
{
  "courses": [
    {
      "courseName": "string (e.g., 'Aperitif', 'Main Course')",
      "wines": [
        {
          "wineId": "string (ID from cellar)",
          "wineName": "string",
          "winery": "string",
          "vintage": number | null,
          "bottlesNeeded": number,
          "poursPerBottle": 5,
          "reason": "string (1 sentence explaining why this wine suits this course)"
        }
      ]
    }
  ],
  "totalBottles": number (sum of all bottlesNeeded),
  "estimatedCost": number (sum of bottlesNeeded * price for each wine),
  "perGuestCost": number (estimatedCost / guestCount),
  "shoppingList": [
    {
      "name": "string (wine name or style to buy)",
      "type": "string (red, white, sparkling, dessert, etc.)",
      "grapeVariety": "string",
      "quantity": number,
      "estimatedPrice": number (per bottle),
      "reason": "string (why this is needed)"
    }
  ]
}`;
}

// ─── Terroir Twin Finder ─────────────────────────────────────
export function terroirTwinPrompt(
  wine: {
    name: string;
    winery: string;
    vintage: number | null;
    type: string;
    grapeVariety: string;
    region: string;
    country: string;
  },
  userWineFingerprints: Array<{
    id: string;
    name: string;
    winery: string;
    region: string;
    country: string;
    grapeVariety: string;
  }>
): string {
  const cellarList = userWineFingerprints
    .map(
      (w) =>
        `ID:${w.id}|${w.name}|${w.winery}|region:${w.region}|country:${w.country}|grape:${w.grapeVariety}`
    )
    .join("\n");

  return `You are a wine terroir expert with deep knowledge of soil science, viticulture, and global wine regions.

The user loves this wine:
Name: ${wine.name}
Winery: ${wine.winery}
Vintage: ${wine.vintage ?? "NV"}
Type: ${wine.type}
Grape: ${wine.grapeVariety}
Region: ${wine.region}
Country: ${wine.country}

Find 3-5 wines from COMPLETELY DIFFERENT regions/countries that share similar terroir characteristics with this wine. Terroir includes:
- Soil composition (limestone, volcanic, clay, slate, gravel, etc.)
- Elevation
- Climate patterns (maritime, continental, Mediterranean, etc.)
- Microclimate similarities

For each suggestion, cross-reference against the user's cellar:
${cellarList || "(empty cellar)"}

If a suggested wine matches something already in the cellar (same winery/name or very similar wine), mark "inCellar": true and include the "cellarWineId".

Focus on discovery — suggest wines from unexpected regions that share genuine terroir connections. This is educational, so explain the terroir science.

${JSON_ONLY}

Return a JSON object:
{
  "twins": [
    {
      "name": "string (specific wine name or general style like 'Etna Rosso from Tenuta delle Terre Nere')",
      "winery": "string",
      "region": "string (specific region)",
      "country": "string",
      "grapeVariety": "string",
      "sharedTerroir": "string (e.g., 'Both grown on limestone soils at 300m elevation with cool maritime influence')",
      "explanation": "string (2-3 sentences explaining the terroir connection and why a lover of the original wine would enjoy this)",
      "inCellar": false,
      "cellarWineId": "string | undefined"
    }
  ]
}`;
}
