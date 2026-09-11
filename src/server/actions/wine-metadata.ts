"use server";

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
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
    where: {
      winery: { equals: winery, mode: "insensitive" },
      name: { equals: name, mode: "insensitive" },
      vintage: vintage ?? null,
    },
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
    where: {
      winery: { equals: winery, mode: "insensitive" },
      name: { equals: name, mode: "insensitive" },
      vintage: vintage ?? null,
    },
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

/**
 * Save or update wine metadata from AI results.
 * Upserts by (winery, name, vintage). Only saves if name+winery are non-empty.
 * Merges new data with existing — never overwrites non-empty fields with empty ones.
 */
export async function saveWineMetadata(
  data: Partial<WineIdentification> & { name: string; winery: string; foodPairings?: string }
): Promise<void> {
  if (!data.name || !data.winery) return;

  const key = {
    winery: data.winery,
    name: data.name,
    vintage: data.vintage ?? null,
  };

  try {
    const existing = await prisma.wineMetadata.findFirst({
      where: {
        winery: { equals: key.winery, mode: "insensitive" },
        name: { equals: key.name, mode: "insensitive" },
        vintage: key.vintage,
      },
    });

    // Merge: only update fields that are non-empty in the new data and empty in existing
    const merged = {
      type: data.type || existing?.type || "",
      region: data.region || existing?.region || "",
      country: data.country || existing?.country || "",
      grapeVariety: data.grapeVariety || existing?.grapeVariety || "",
      alcohol: data.alcohol || existing?.alcohol || "",
      description: data.description || existing?.description || "",
      foodPairings: data.foodPairings || existing?.foodPairings || "",
      estimatedPrice: data.estimatedPrice ?? existing?.estimatedPrice ?? null,
      disposition: data.disposition || existing?.disposition || "",
      drinkBy: data.drinkBy || existing?.drinkBy || "",
      drinkWindow: data.drinkWindow || existing?.drinkWindow || "",
      aiRatings: data.ratings ?? existing?.aiRatings ?? undefined,
    };

    if (existing) {
      await prisma.wineMetadata.update({
        where: { id: existing.id },
        data: merged as Prisma.WineMetadataUpdateInput,
      });
    } else {
      await prisma.wineMetadata.create({
        data: { ...key, ...merged } as Prisma.WineMetadataCreateInput,
      });
    }
  } catch {
    // Ignore duplicate key / race condition errors
  }
}

/**
 * Save image URL to existing wine metadata.
 */
export async function saveWineMetadataImage(
  winery: string,
  name: string,
  vintage: number | null,
  imageUrl: string
): Promise<void> {
  if (!winery || !name || !imageUrl) return;

  try {
    await prisma.wineMetadata.updateMany({
      where: {
        winery: { equals: winery, mode: "insensitive" },
        name: { equals: name, mode: "insensitive" },
        vintage: vintage ?? null,
      },
      data: { imageUrl },
    });
  } catch {
    // Ignore errors
  }
}
