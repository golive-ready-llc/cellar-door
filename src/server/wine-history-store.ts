/**
 * WineHistory rows. Removing a bottle archives a snapshot of it; restoring
 * reads the row back. The snapshot shape lives here so the removal paths
 * (single bottle, bulk, REST API) cannot drift apart.
 */

import type { Prisma } from "@/generated/prisma/client";

interface RemovedWine {
  id: string;
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  country: string;
  grapeVariety: string;
  userRating: number | null;
  price: number | null;
  retailPrice: number | null;
  imageUrl: string;
  description: string;
  foodPairings: string;
  alcohol: string;
  disposition: string;
  drinkWindow: string;
  aiRatings: unknown;
  addedAt: Date;
}

export interface RemovalContext {
  reason: string;
  /** Rating the user gave as they drank it, when removal was a tasting. */
  consumeRating?: number | null;
  consumeNotes?: string;
}

/** Snapshot one bottle for the history table. */
export function wineHistoryData(
  userId: string,
  wine: RemovedWine,
  removal: RemovalContext
): Prisma.WineHistoryCreateManyInput {
  return {
    userId,
    originalId: wine.id,
    name: wine.name,
    winery: wine.winery,
    vintage: wine.vintage,
    type: wine.type,
    region: wine.region,
    country: wine.country,
    grapeVariety: wine.grapeVariety,
    rating: wine.userRating,
    consumeRating: removal.consumeRating ?? null,
    consumeNotes: removal.consumeNotes ?? "",
    price: wine.price,
    retailPrice: wine.retailPrice,
    imageUrl: wine.imageUrl,
    description: wine.description,
    foodPairings: wine.foodPairings,
    alcohol: wine.alcohol,
    disposition: wine.disposition,
    drinkWindow: wine.drinkWindow,
    aiRatings: (wine.aiRatings ?? undefined) as Prisma.InputJsonValue | undefined,
    addedAt: wine.addedAt,
    reason: removal.reason,
  };
}
