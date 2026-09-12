/**
 * Wine-level metadata shared by every bottle of the same wine.
 *
 * A wine is identified by user + name + winery + vintage. Fields that describe
 * the wine (rating, region, type…) belong to all of its bottles; fields that
 * describe a bottle (location, notes, purchase date) do not. Editing one bottle
 * copies the shared fields onto its siblings, so the identity filter and the
 * patch have to agree — both live here.
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/** Fields that describe the wine itself (not bottle-specific like location or notes). */
export const SHARED_WINE_FIELDS = [
  "userRating", "imageUrl", "description", "foodPairings", "alcohol",
  "disposition", "drinkWindow", "drinkBy", "retailPrice", "grapeVariety",
  "region", "country", "type", "barcode", "sparkling",
] as const;

export interface WineIdentity {
  name: string;
  winery?: string | null;
  vintage?: number | null;
}

/**
 * One user's bottles of the same wine. Name and winery match case-insensitively,
 * and winery is matched as an empty string when absent — requiring it truthy
 * silently skipped winery-less wines (two "Pinot Noir" with no producer).
 * `excludeWineId` leaves the bottle being edited out of its own propagation.
 */
export function sameWineWhere(
  userId: string,
  wine: WineIdentity,
  excludeWineId?: string
): Prisma.WineWhereInput {
  return {
    userId,
    ...(excludeWineId && { id: { not: excludeWineId } }),
    name: { equals: wine.name, mode: "insensitive" },
    winery: { equals: wine.winery ?? "", mode: "insensitive" },
    vintage: wine.vintage ?? null,
  };
}

/**
 * The shared fields present in a partial update, normalized for storage
 * (type lowercased; the JSON columns nulled exactly as the row update does).
 * Empty when the update only touched bottle-specific fields.
 */
export function sharedFieldPatch(source: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of SHARED_WINE_FIELDS) {
    const value = source[field];
    if (value === undefined) continue;
    patch[field] = field === "type" && value ? (value as string).toLowerCase() : value;
  }
  if (source.aiRatings !== undefined) patch.aiRatings = source.aiRatings ?? null;
  if (source.tastingNotes !== undefined) patch.tastingNotes = source.tastingNotes || null;
  if (source.aiEnrichedAt !== undefined) {
    const v = source.aiEnrichedAt;
    if (v === null) patch.aiEnrichedAt = null;
    else if (v instanceof Date) patch.aiEnrichedAt = v;
    else if (typeof v === "string") patch.aiEnrichedAt = new Date(v);
  }
  return patch;
}

/**
 * Fire-and-forget copy of `patch` onto the user's other bottles of the same
 * wine. A wine with no name or winery has no identity to match on, so there is
 * nothing to propagate. Failures are swallowed by design: propagation is
 * best-effort and must never fail the edit that triggered it.
 */
export function propagateSharedFields(
  userId: string,
  wine: WineIdentity & { id: string },
  patch: Record<string, unknown>
): void {
  if (!wine.name || !wine.winery) return;
  if (Object.keys(patch).length === 0) return;
  void prisma.wine.updateMany({
    where: sameWineWhere(userId, wine, wine.id),
    data: patch,
  }).catch(() => { /* best-effort propagation */ });
}
