/**
 * Writes to the shared WineMetadata cache.
 *
 * Deliberately NOT a "use server" module. Every export of a "use server" file
 * is a publicly callable endpoint, and this cache feeds other users' newly
 * added wines, so open write access would let anyone poison it. Only server
 * code that produced the data itself (the AI actions, expert-score) may call
 * these. Reads stay in src/server/actions/wine-metadata.ts.
 */
import { prisma } from "@/lib/db";
import { metadataKey, metadataWhere } from "@/lib/wine-metadata-key";
import { Prisma } from "@/generated/prisma/client";
import type { WineIdentification } from "@/lib/ai/types";

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
      where: metadataWhere(key.winery, key.name, key.vintage),
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
        data: {
          ...key,
          wineryKey: metadataKey(key.winery),
          nameKey: metadataKey(key.name),
          ...merged,
        } as Prisma.WineMetadataCreateInput,
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
      where: metadataWhere(winery, name, vintage ?? null),
      data: { imageUrl },
    });
  } catch {
    // Ignore errors
  }
}
