"use server";

import { prisma } from "@/lib/db";
import { metadataWhere } from "@/lib/wine-metadata-key";
import type { WineIdentification } from "@/lib/ai/types";
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

// Cache WRITES live in src/server/wine-metadata-store.ts, not here. Every
// export of a "use server" file is a public endpoint, and open writes would
// let anyone poison the shared cache that feeds other users' wines.
