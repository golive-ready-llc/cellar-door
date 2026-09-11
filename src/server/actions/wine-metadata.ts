"use server";

import { prisma } from "@/lib/db";
import { metadataWhere } from "@/lib/wine-metadata-key";
import type { WineIdentification, AiWineEnrichmentResult } from "@/lib/ai/types";
import type { AiRatings } from "@/types/wine";

/**
 * Look up cached wine metadata by winery + name + vintage.
 * Case-insensitive match. Increments hitCount on match.
 */
export async function findWineMetadata(
  winery: string,
  name: string,
  vintage: number | null
): Promise<WineIdentification | null> {
  if (!winery || !name) return null;

  const row = await prisma.wineMetadata.findFirst({
    where: metadataWhere(winery, name, vintage ?? null),
  });

  if (!row) return null;

  // Increment hit count (fire-and-forget)
  prisma.wineMetadata.update({
    where: { id: row.id },
    data: { hitCount: { increment: 1 } },
  }).catch(() => {});

  return {
    name: row.name,
    winery: row.winery,
    vintage: row.vintage,
    type: row.type as WineIdentification["type"],
    region: row.region,
    country: row.country,
    grapeVariety: row.grapeVariety,
    description: row.description,
    estimatedPrice: row.estimatedPrice,
    alcohol: row.alcohol,
    disposition: row.disposition,
    drinkBy: row.drinkBy,
    drinkWindow: row.drinkWindow,
    ratings: (row.aiRatings as AiRatings) ?? null,
  };
}

/**
 * Check if cached metadata has enough enrichment data to skip an AI call.
 * Returns an AiWineEnrichmentResult if the cached data is "complete enough".
 */
export async function findEnrichmentMetadata(
  winery: string,
  name: string,
  vintage: number | null
): Promise<AiWineEnrichmentResult | null> {
  if (!winery || !name) return null;

  const row = await prisma.wineMetadata.findFirst({
    where: metadataWhere(winery, name, vintage ?? null),
  });

  if (!row) return null;

  // Need at least description + one of (foodPairings, drinkWindow, ratings) to be useful
  if (!row.description) return null;
  if (!row.drinkWindow && !row.aiRatings) return null;

  // Increment hit count (fire-and-forget)
  prisma.wineMetadata.update({
    where: { id: row.id },
    data: { hitCount: { increment: 1 } },
  }).catch(() => {});

  return {
    description: row.description,
    foodPairings: row.foodPairings,
    pairingNotes: "",
    estimatedPrice: row.estimatedPrice ?? 0,
    priceRange: { low: 0, high: 0 },
    disposition: row.disposition,
    drinkBy: row.drinkBy,
    drinkWindow: row.drinkWindow,
    ratings: (row.aiRatings as AiRatings) ?? { rating_ws: undefined, rating_rp: undefined, rating_jd: undefined, rating_ag: undefined },
    confidence: "high",
  };
}

// Cache WRITES live in src/server/wine-metadata-store.ts, not here. Every
// export of a "use server" file is a public endpoint, and open writes would
// let anyone poison the shared cache that feeds other users' wines.
