// AI enrichment cache layer
// Wraps WineMetadata table with TTL checking and normalized key generation

import { metadataKey, metadataWhere } from "@/lib/wine-metadata-key";
import { prisma } from "@/lib/db";
import type { AiWineEnrichmentResult } from "./types";
import type { AiRatings } from "@/types/wine";

/** How many days before a cached enrichment is considered stale */
const CACHE_TTL_DAYS = 30;

/** Cached enrichment data returned on a hit */
export interface CachedEnrichment {
  data: AiWineEnrichmentResult;
  cachedAt: Date;
}

/**
 * Normalize a cache key: lowercase + trim whitespace.
 */
export function generateCacheKey(
  winery: string,
  name: string,
  vintage: number | null
): string {
  const w = winery.toLowerCase().trim();
  const n = name.toLowerCase().trim();
  const v = vintage != null ? String(vintage) : "nv";
  return `${w}::${n}::${v}`;
}

/**
 * Look up a cached enrichment result by winery + name + vintage.
 * Returns null if not found or if the cached data is older than 30 days.
 * Increments hitCount on a valid cache hit.
 */
export async function getEnrichmentCache(
  winery: string,
  name: string,
  vintage: number | null
): Promise<CachedEnrichment | null> {
  if (!winery || !name) return null;

  const row = await prisma.wineMetadata.findFirst({
    where: metadataWhere(winery, name, vintage ?? null),
  });

  if (!row) return null;

  // Check TTL — stale entries are treated as misses
  const ageMs = Date.now() - row.cachedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays > CACHE_TTL_DAYS) return null;

  // Need at least description + one of (drinkWindow, ratings) to be a useful cache hit
  if (!row.description) return null;
  if (!row.drinkWindow && !row.aiRatings) return null;

  // Increment hit count (fire-and-forget — non-critical, never block a cache hit)
  prisma.wineMetadata
    .update({
      where: { id: row.id },
      data: { hitCount: { increment: 1 } },
    })
    .catch((e) => {
      if (process.env.NODE_ENV === "development") {
        console.debug("[cache] hitCount increment failed:", e instanceof Error ? e.message : e);
      }
    });

  return {
    cachedAt: row.cachedAt,
    data: {
      description: row.description,
      foodPairings: row.foodPairings,
      pairingNotes: "",
      estimatedPrice: row.estimatedPrice ?? 0,
      priceRange: { low: 0, high: 0 },
      disposition: row.disposition,
      drinkBy: row.drinkBy,
      drinkWindow: row.drinkWindow,
      ratings: (row.aiRatings as AiRatings) ?? {
        rating_ws: undefined,
        rating_rp: undefined,
        rating_jd: undefined,
        rating_ag: undefined,
      },
      confidence: "high",
    },
  };
}

/**
 * Store an enrichment result in the WineMetadata cache.
 * Upserts by (winery, name, vintage). Only stores successful (non-empty) results.
 */
export async function setEnrichmentCache(
  winery: string,
  name: string,
  vintage: number | null,
  data: AiWineEnrichmentResult
): Promise<void> {
  if (!winery || !name) return;
  // Don't cache empty / failed results
  if (!data.description) return;

  const trimmedWinery = winery.trim();
  const trimmedName = name.trim();
  const v = vintage ?? null;

  try {
    const existing = await prisma.wineMetadata.findFirst({
      where: metadataWhere(trimmedWinery, trimmedName, v),
    });

    const fields = {
      description: data.description,
      foodPairings: data.foodPairings || "",
      estimatedPrice: data.estimatedPrice ?? null,
      disposition: data.disposition || "",
      drinkBy: data.drinkBy || "",
      drinkWindow: data.drinkWindow || "",
      aiRatings: data.ratings
        ? (data.ratings as unknown as import("@/generated/prisma/client").Prisma.InputJsonValue)
        : undefined,
      cachedAt: new Date(),
    };

    if (existing) {
      await prisma.wineMetadata.update({
        where: { id: existing.id },
        data: fields,
      });
    } else {
      await prisma.wineMetadata.create({
        data: {
          winery: trimmedWinery,
          name: trimmedName,
          wineryKey: metadataKey(trimmedWinery),
          nameKey: metadataKey(trimmedName),
          vintage: v,
          ...fields,
        },
      });
    }
  } catch {
    // Ignore duplicate key / race condition errors
  }
}
