/**
 * Shared wine serialization for the REST API v1.
 * Extracted from duplicate implementations in wines/route.ts and wines/[id]/route.ts.
 */

import { isSparklingType } from "@/types/wine";

/**
 * Accepts both the domain Wine type (date fields are already ISO strings)
 * and raw Prisma results (date fields are Date objects). The function
 * handles both via instanceof checks.
 */
interface WineRecord {
  id: string;
  name: string;
  winery: string;
  region: string;
  country: string;
  vintage: number | null;
  type: string;
  sparkling?: boolean | null;
  grapeVariety: string;
  barcode: string;
  userRating: number | null;
  imageUrl: string;
  price: number | null;
  retailPrice: number | null;
  purchaseDate: string;
  drinkBy: string;
  notes: string;
  description: string;
  foodPairings: string;
  alcohol: string;
  disposition: string;
  drinkWindow: string;
  tags: string[];
  tastingNotes: unknown;
  aiRatings: unknown;
  aiEnrichedAt?: unknown;
  cabinetId: string | null;
  row: number | null;
  col: number | null;
  depth: number;
  zone: string;
  addedAt: unknown;
  updatedAt: unknown;
}

function toISODate(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v.length > 0) return v;
  return null;
}

export function serializeWine(wine: WineRecord) {
  return {
    id: wine.id,
    name: wine.name,
    winery: wine.winery,
    region: wine.region,
    country: wine.country,
    vintage: wine.vintage,
    type: wine.type,
    sparkling: wine.sparkling ?? isSparklingType(wine.type ?? ""),
    grapeVariety: wine.grapeVariety,
    barcode: wine.barcode,
    userRating: wine.userRating,
    imageUrl: wine.imageUrl,
    price: wine.price,
    retailPrice: wine.retailPrice,
    purchaseDate: wine.purchaseDate,
    drinkBy: wine.drinkBy,
    notes: wine.notes,
    description: wine.description,
    foodPairings: wine.foodPairings,
    alcohol: wine.alcohol,
    disposition: wine.disposition,
    drinkWindow: wine.drinkWindow,
    tags: wine.tags ?? [],
    tastingNotes: wine.tastingNotes,
    aiRatings: wine.aiRatings,
    aiEnrichedAt: wine.aiEnrichedAt instanceof Date ? wine.aiEnrichedAt.toISOString() : (wine.aiEnrichedAt as string | null | undefined) ?? null,
    cabinetId: wine.cabinetId,
    row: wine.row,
    col: wine.col,
    depth: wine.depth,
    zone: wine.zone,
    addedAt: toISODate(wine.addedAt) ?? "",
    updatedAt: toISODate(wine.updatedAt) ?? "",
  };
}

export const SHARED_WINE_FIELDS = [
  "userRating", "imageUrl", "description", "foodPairings", "alcohol",
  "disposition", "drinkWindow", "drinkBy", "retailPrice", "grapeVariety",
  "region", "country", "type", "barcode", "sparkling",
] as const;
