// Wine types and interfaces for Cellar Door
// Based on ha-wine-cellar/frontend-src/src/models.ts, adapted to camelCase
// NOTE: No Vivino integration — ratings come from CD Score (community) + AI estimates

export type WineType = "red" | "white" | "rosé" | "sparkling" | "champagne" | "prosecco" | "cava" | "crémant" | "cremant" | "franciacorta" | "dessert" | "orange" | "green" | "fortified";

/** Types that are sparkling by definition — both the canonical "sparkling" and
 *  specific méthode traditionnelle / tank-method variants that may exist in
 *  legacy data. The `sparkling` boolean column is the canonical source of truth
 *  for new data; this list covers the legacy `type`-only era. */
export const SPARKLING_VARIANTS: WineType[] = [
  "sparkling", "champagne", "prosecco", "cava", "crémant", "cremant", "franciacorta",
];

export function isSparklingType(type: string): boolean {
  return SPARKLING_VARIANTS.includes(type.toLowerCase() as WineType);
}

/** The one "does this wine show up under a Sparkling filter?" rule: the
 *  canonical boolean flag, or a legacy type-only row whose type is a
 *  sparkling variant. Filters and badge counts share this so surfaces
 *  can't drift apart. */
export function matchesSparklingFilter(
  w: { type?: string | null; sparkling?: boolean | null }
): boolean {
  return w.sparkling === true || isSparklingType(w.type ?? "");
}

/** Wine types whose background fill color is light enough to need dark
 *  (#333) foreground text/icons instead of white (#fff). */
export function isLightWineType(type: string): boolean {
  const t = type.toLowerCase();
  return t === "white" || t === "rosé" || isSparklingType(t);
}

/** @deprecated Structured tasting notes — replaced by single free-text field on Wine */
export interface TastingNotes {
  aroma: string;
  taste: string;
  finish: string;
  overall: string;
}

export interface AiRatings {
  rating_ws?: number; // Wine Spectator
  rating_rp?: number; // Robert Parker / Wine Advocate
  rating_jd?: number; // Jeb Dunnuck
  rating_ag?: number; // Antonio Galloni / Vinous
}

export interface Wine {
  id: string;
  userId: string;
  cabinetId: string | null;
  barcode: string;
  name: string;
  winery: string;
  region: string;
  country: string;
  vintage: number | null;
  type: WineType;
  /** Orthogonal to color — a rosé Champagne has type="rosé" and sparkling=true. */
  sparkling: boolean;
  /** Bottle format — drives Sort Assistant fit checks. Absent = "standard".
   *  Optional (not required) so the many NewWineInput construction sites
   *  don't all have to pass it; the server defaults it. */
  bottleSize?: BottleSize;
  grapeVariety: string;
  userRating: number | null; // User's personal 0-5 rating
  imageUrl: string;
  price: number | null; // Purchase price
  retailPrice: number | null; // AI-estimated market value
  purchaseDate: string;
  drinkBy: string;
  notes: string;
  description: string;
  foodPairings: string;
  alcohol: string;
  row: number | null;
  col: number | null;
  depth: number;
  zone: string;
  tastingNotes: string | null; // Free-text tasting notes (user-entered)
  disposition: string; // "D" = Drink, "H" = Hold, "P" = Past Peak
  drinkWindow: string; // e.g. "2025-2030"
  aiRatings: AiRatings | null;
  tags: string[]; // User-defined custom tags
  addedAt: string;
  updatedAt: string;
  /** ISO timestamp set when AI enrichment runs. Used by bulk-enrich to
   * skip already-enriched wines — independent of whether AI returned
   * non-empty foodPairings/ratings (some obscure wines get empty data). */
  aiEnrichedAt?: string | null;
  // Community score (populated from CommunityWine join)
  cdScore?: number | null;
  cdRatingCount?: number;
}

/**
 * Payload for creating a wine. `skipDuplicateCheck` lets intentional
 * multi-bottle flows (Duplicate, Add Bottle, receipt/CSV bulk import)
 * bypass the same-name+winery+vintage duplicate warning that protects
 * the interactive single-add form.
 */
export type NewWineInput = Omit<Wine, "id" | "addedAt" | "updatedAt" | "userId"> & {
  skipDuplicateCheck?: boolean;
};

export type StorageRowType = "bulk" | "box";

export interface StorageRow {
  row: number;
  name: string;
  type: StorageRowType;
  capacity: number;
  /** Case sizes stored in this bin, e.g. [12, 6]. Works on both bulk and legacy box rows. */
  boxes?: number[];
}

// ── Bottle formats / slot sizes ─────────────────────────────

/** Bottle format. Ordered — a bottle fits any slot whose max size ranks >= its own. */
export type BottleSize = "half" | "standard" | "magnum" | "large";

export const BOTTLE_SIZE_ORDER: BottleSize[] = ["half", "standard", "magnum", "large"];

export const BOTTLE_SIZE_LABELS: Record<BottleSize, string> = {
  half: "Half (375ml)",
  standard: "Standard (750ml)",
  magnum: "Magnum (1.5L)",
  large: "Large (3L+)",
};

export function bottleSizeRank(size: string | null | undefined): number {
  const i = BOTTLE_SIZE_ORDER.indexOf((size || "standard") as BottleSize);
  return i === -1 ? BOTTLE_SIZE_ORDER.indexOf("standard") : i;
}

/** True when a bottle of `bottleSize` physically fits a slot capped at `slotMaxSize`. */
export function bottleFitsSlot(
  bottleSize: string | null | undefined,
  slotMaxSize: string | null | undefined
): boolean {
  return bottleSizeRank(bottleSize) <= bottleSizeRank(slotMaxSize);
}

/** Per-row slot size override on a cabinet. Rows not listed accept "standard". */
export interface RowSize {
  row: number;
  maxSize: BottleSize;
}

export interface HaConfig {
  haUrl: string;
  tempEntityId: string;
  humidityEntityId: string;
  hasToken: boolean; // true if encrypted token is stored — never expose token to client
}

export interface Wall {
  id: string;
  userId: string;
  name: string;
  location: string;
  sortOrder: number;
  haConfig?: HaConfig | null;
}

export interface Cabinet {
  id: string;
  userId: string;
  wallId: string;
  name: string;
  rows: number;
  cols: number;
  depth: number;
  storageRows: StorageRow[];
  /** Per-row max bottle size; rows not listed (or the whole field absent)
   *  accept "standard" and below. Optional so mock/legacy construction
   *  sites don't all need it. */
  rowSizes?: RowSize[];
  sortOrder: number;
}

export interface CellarStats {
  totalBottles: number;
  totalCapacity: number;
  availableSlots: number;
  totalValue: number;
  totalCost: number;
  byType: Record<string, number>;
  byCabinet: Record<string, number>;
}

export interface BuyListItem {
  id: string;
  userId: string;
  barcode: string;
  name: string;
  winery: string;
  region: string;
  country: string;
  vintage: number | null;
  type: WineType;
  sparkling?: boolean;
  grapeVariety: string;
  imageUrl: string;
  retailPrice: number | null;
  notes: string;
  description: string;
  foodPairings: string;
  alcohol: string;
  disposition: string;
  drinkWindow: string;
  aiRatings: AiRatings | null;
  status: "wanted" | "ordered" | "delivered";
  orderDate: string | null;
  expectedDelivery: string | null;
  store: string;
  addedAt: string;
}

export interface WineHistoryItem {
  id: string;
  originalId: string | null;
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  country: string;
  grapeVariety: string;
  rating: number | null;
  consumeRating: number | null;
  consumeNotes: string;
  price: number | null;
  retailPrice: number | null;
  imageUrl: string;
  description: string;
  foodPairings: string;
  alcohol: string;
  disposition: string;
  drinkWindow: string;
  aiRatings: Record<string, number | null> | null;
  addedAt: string | null;
  removedAt: string;
  reason: string;
}

export interface CommunityRating {
  id: string;
  username: string;
  rating: number;
  review: string;
  tastingNotes?: {
    aroma?: string;
    taste?: string;
    finish?: string;
  } | null;
  createdAt: string;
}

export interface BarcodeLookupResult {
  name: string;
  winery: string;
  region: string;
  country: string;
  vintage: number | null;
  type: WineType;
  sparkling?: boolean;
  grapeVariety: string;
  imageUrl: string;
  price: number | null;
  description: string;
  foodPairings: string;
  alcohol: string;
  source: string; // "upc_itemdb" | "open_food_facts" | "gemini"
}

export interface CommunityWine {
  id: string;
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  country: string;
  cdScore: number | null;
  cdRatingCount: number;
}
