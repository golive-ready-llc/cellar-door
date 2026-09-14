"use server";

import { after } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { AiRatings, Wine } from "@/types/wine";
import { isSparklingType } from "@/types/wine";
import { logAudit } from "@/server/audit-log";
import { limitWineText } from "@/lib/wine-text-limits";
import { listImageUrl, parseWineImageRef } from "@/lib/wine-image-ref";
import { resolveImageRef } from "@/server/wine-image-refs";
import { resolveServerUserId } from "@/server/auth-guard";
import { assertNotDemo } from "@/lib/demo";
import { getCommunityScoresBatch } from "./community";
import { seedCommunityBaseline } from "@/server/community-baseline-store";
import { requireCanAddWine } from "@/server/tier-check";
import { communityWineKey } from "@/lib/cd-score";
import { findWineMetadata } from "./wine-metadata";
import { fetchAndStoreExpertRatings } from "@/server/expert-score";
import {
  sameWineWhere,
  sharedFieldPatch,
  propagateSharedFields,
} from "@/server/wine-shared";
import { wineHistoryData } from "@/server/wine-history-store";

/** Bottle formats accepted by add/update. Kept in sync with types/wine BOTTLE_SIZE_ORDER
 *  (not imported — "use server" modules should not pull client-shared constants they
 *  only need for validation). */
const VALID_BOTTLE_SIZES = ["half", "standard", "magnum", "large"];

// ============================================================
// Wine CRUD Server Actions
// ============================================================

export interface AddWineInput {
  userId: string;
  cabinetId?: string | null;
  barcode?: string;
  name: string;
  winery?: string;
  region?: string;
  country?: string;
  vintage?: number | null;
  type?: string;
  grapeVariety?: string;
  userRating?: number | null;
  imageUrl?: string;
  price?: number | null;
  retailPrice?: number | null;
  purchaseDate?: string;
  drinkBy?: string;
  notes?: string;
  description?: string;
  foodPairings?: string;
  alcohol?: string;
  row?: number | null;
  col?: number | null;
  depth?: number;
  zone?: string;
  disposition?: string;
  drinkWindow?: string;
  tags?: string[];
  tastingNotes?: unknown;
  bottleSize?: string;
  aiRatings?: unknown;
  sparkling?: boolean;
  skipDuplicateCheck?: boolean;
}

/**
 * Sentinel returned (NOT thrown) when the wine already exists. Thrown
 * errors from server actions are masked in production builds ("An error
 * occurred in the Server Components render…"), so the client could never
 * distinguish "duplicate" from a real crash. Expected outcomes must be
 * returned as data; the client data layer re-throws a typed
 * DuplicateWineError locally where instanceof checks actually work.
 */
export interface DuplicateWineCheck {
  duplicate: true;
  existingWineId: string;
  existingWineName: string;
}

/**
 * Reject a (row, col, depth) placement that falls outside a cabinet's grid.
 * Without this, a malformed/forged client request can persist a wine at, say,
 * row=100 in an 8×8 cabinet — orphaned data that never renders in the grid.
 * Coordinates are 0-indexed; `null`/`undefined` means "not being set" → skip.
 */
function assertSlotInBounds(
  cabinet: { rows: number; cols: number; depth: number },
  row?: number | null,
  col?: number | null,
  depth?: number | null
) {
  if (row != null && (row < 0 || row >= cabinet.rows)) {
    throw new Error(`Row ${row} is outside this section (0–${cabinet.rows - 1})`);
  }
  if (col != null && (col < 0 || col >= cabinet.cols)) {
    throw new Error(`Column ${col} is outside this section (0–${cabinet.cols - 1})`);
  }
  if (depth != null && (depth < 0 || depth >= cabinet.depth)) {
    throw new Error(`Depth ${depth} is outside this section (0–${cabinet.depth - 1})`);
  }
}

export async function addWine(input: AddWineInput): Promise<Wine | DuplicateWineCheck> {
  await assertNotDemo("add wines");
  const uid = await resolveServerUserId(input.userId);
  input = limitWineText(input);
  if (input.imageUrl) input = { ...input, imageUrl: await resolveImageRef(uid, input.imageUrl) };

  // Verify cabinet ownership if cabinetId is provided
  if (input.cabinetId) {
    const cabinet = await prisma.cabinet.findFirst({
      where: { id: input.cabinetId, userId: uid },
    });
    if (!cabinet) {
      throw new Error("Cabinet not found or not owned by you");
    }
    assertSlotInBounds(cabinet, input.row, input.col, input.depth);
  }

  await requireCanAddWine(uid);

  // Duplicate detection: warn if same name+(winery)+vintage already exists.
  if (input.name && !input.skipDuplicateCheck) {
    const dupe = await prisma.wine.findFirst({
      where: sameWineWhere(uid, input),
      select: { id: true, name: true, addedAt: true },
    });
    if (dupe) {
      return { duplicate: true, existingWineId: dupe.id, existingWineName: dupe.name };
    }
  }

  // Expert Score population, step 1: when the caller didn't bring critic
  // scores (manual add, receipt, barcode…), try the shared WineMetadata
  // cache — a prior scan/enrichment of this wine by ANY user makes this a
  // free single-row lookup instead of an AI call.
  let aiRatings = input.aiRatings as AiRatings | null | undefined;
  if (!aiRatings && input.name && input.winery) {
    const cached = await findWineMetadata(
      input.winery,
      input.name,
      input.vintage ?? null
    );
    if (cached?.ratings) aiRatings = cached.ratings;
  }

  const wine = await prisma.wine.create({
    data: wineCreateData(uid, input, aiRatings),
  });

  // Seed the canonical CommunityWine baseline from AI critic scores so
  // scanned wines get an immediate CD score even before any user rates
  // them. Fire-and-forget — never block wine creation on community state.
  if (aiRatings) {
    void seedCommunityBaseline({
      name: wine.name,
      winery: wine.winery,
      vintage: wine.vintage,
      type: wine.type,
      region: wine.region,
      country: wine.country,
      aiRatings: aiRatings as AiRatings,
    }).catch(() => { /* best-effort baseline seeding */ });
  } else if (input.name && input.winery) {
    // Expert Score population, step 2: no critic scores anywhere yet —
    // estimate them from public critic ratings via AI after the response is
    // sent (tier + credit gated inside; skips silently for FREE tier).
    after(() => fetchAndStoreExpertRatings({
      wineId: wine.id,
      userId: uid,
      name: wine.name,
      winery: wine.winery,
      vintage: wine.vintage,
      type: wine.type,
      region: wine.region,
      country: wine.country,
      grapeVariety: wine.grapeVariety,
    }));
  }

  return mapPrismaWine(wine);
}

/** Prisma create data for one wine, shared by addWine and importWines. */
function wineCreateData(
  uid: string,
  input: AddWineInput,
  aiRatings: AiRatings | null | undefined
): Prisma.WineCreateManyInput {
  return {
    userId: uid,
    cabinetId: input.cabinetId ?? null,
    barcode: input.barcode ?? "",
    name: input.name,
    winery: input.winery ?? "",
    region: input.region ?? "",
    country: input.country ?? "",
    vintage: input.vintage ?? null,
    type: (input.type ?? "red").toLowerCase(),
    // Derive sparkling from the explicit flag first, then from the lowercased type
    // so callers passing type="Sparkling" or type="Champagne" etc. get sparkling:true.
    sparkling: input.sparkling ?? isSparklingType(input.type ?? ""),
    // Bottle format: validated against known sizes; unknown falls back to standard.
    bottleSize: VALID_BOTTLE_SIZES.includes(input.bottleSize ?? "")
      ? input.bottleSize
      : "standard",
    grapeVariety: input.grapeVariety ?? "",
    userRating: input.userRating ?? null,
    imageUrl: input.imageUrl ?? "",
    price: input.price ?? null,
    retailPrice: input.retailPrice ?? null,
    purchaseDate: input.purchaseDate ?? "",
    drinkBy: input.drinkBy ?? "",
    notes: input.notes ?? "",
    description: input.description ?? "",
    foodPairings: input.foodPairings ?? "",
    alcohol: input.alcohol ?? "",
    row: input.row ?? null,
    col: input.col ?? null,
    depth: input.depth ?? 0,
    zone: input.zone ?? "",
    disposition: input.disposition ?? "",
    drinkWindow: input.drinkWindow ?? "",
    tags: Array.isArray(input.tags) ? input.tags.filter((t) => typeof t === "string") : [],
    tastingNotes: (input.tastingNotes || Prisma.JsonNull) as Prisma.InputJsonValue,
    aiRatings: (aiRatings ?? Prisma.JsonNull) as Prisma.InputJsonValue,
  };
}

const MAX_IMPORT_ROWS = 2000;
const IMPORT_BATCH = 200;

/**
 * Import many wines in one call (CSV import, "duplicate" with a count). One
 * auth check and one transaction of batched inserts, instead of a server
 * action plus several queries per bottle. Imported bottles land unfiled.
 * Deliberately skips addWine's per-bottle side effects: the duplicate check
 * (imports legitimately repeat wines) and the background AI critic-score
 * estimate, which would silently spend one AI credit per imported row.
 */
export async function importWines(
  userId: string | undefined,
  inputs: AddWineInput[]
): Promise<Wine[]> {
  await assertNotDemo("import wines");
  const uid = await resolveServerUserId(userId);
  if (!Array.isArray(inputs) || inputs.length === 0) return [];
  if (inputs.length > MAX_IMPORT_ROWS) {
    throw new Error(`Import at most ${MAX_IMPORT_ROWS} bottles at a time`);
  }
  await requireCanAddWine(uid);

  // "Duplicate" sends list image URLs back; resolve each distinct one once.
  const resolvedImages = new Map<string, string>();
  for (const raw of inputs) {
    if (raw.imageUrl && parseWineImageRef(raw.imageUrl) && !resolvedImages.has(raw.imageUrl)) {
      resolvedImages.set(raw.imageUrl, await resolveImageRef(uid, raw.imageUrl));
    }
  }

  const rows = inputs.map((raw) =>
    wineCreateData(
      uid,
      {
        ...limitWineText(raw),
        imageUrl: resolvedImages.get(raw.imageUrl ?? "") ?? raw.imageUrl,
        cabinetId: null,
        row: null,
        col: null,
        depth: 0,
        zone: "",
      },
      (raw.aiRatings as AiRatings | null | undefined) ?? null
    )
  );

  const created = await prisma.$transaction(
    async (tx) => {
      const out: Awaited<ReturnType<typeof tx.wine.createManyAndReturn>> = [];
      for (let i = 0; i < rows.length; i += IMPORT_BATCH) {
        out.push(...(await tx.wine.createManyAndReturn({ data: rows.slice(i, i + IMPORT_BATCH) })));
      }
      return out;
    },
    { timeout: 30_000 }
  );
  return created.map(mapPrismaWine);
}

export async function getWines(
  userId?: string,
  options?: { fullImages?: boolean }
): Promise<Wine[]> {
  const uid = await resolveServerUserId(userId);
  const wines = await prisma.wine.findMany({
    where: { userId: uid },
    orderBy: { addedAt: "desc" },
  });

  // Lists reference images by URL; backups ask for the image data itself.
  return populateCdScores(wines.map(options?.fullImages ? mapPrismaWine : mapListWine));
}

export async function getWinesByCabinet(
  userId: string,
  cabinetId: string
): Promise<Wine[]> {
  const uid = await resolveServerUserId(userId);
  const wines = await prisma.wine.findMany({
    where: { userId: uid, cabinetId },
    orderBy: { addedAt: "desc" },
  });

  return populateCdScores(wines.map(mapListWine));
}

export async function getWine(
  userId: string,
  wineId: string
): Promise<Wine | null> {
  const uid = await resolveServerUserId(userId);
  const wine = await prisma.wine.findFirst({
    where: { id: wineId, userId: uid },
  });

  if (!wine) return null;
  const [withScore] = await populateCdScores([mapPrismaWine(wine)]);
  return withScore;
}

export async function updateWine(
  userId: string,
  wineId: string,
  data: Partial<AddWineInput>
): Promise<Wine> {
  await assertNotDemo("edit wines");
  const uid = await resolveServerUserId(userId);
  // Verify ownership BEFORE mutating
  const existing = await prisma.wine.findFirst({
    where: { id: wineId, userId: uid },
  });
  if (!existing) {
    throw new Error("Unauthorized");
  }
  data = limitWineText(data);
  // Lists reference images by URL, so an edit form sends that URL back. Our
  // own image URL means "unchanged"; another record's is resolved to its
  // stored image (only if the caller owns it).
  if (typeof data.imageUrl === "string" && parseWineImageRef(data.imageUrl)) {
    const ref = parseWineImageRef(data.imageUrl);
    data =
      ref?.kind === "wine" && ref.id === wineId
        ? { ...data, imageUrl: undefined }
        : { ...data, imageUrl: await resolveImageRef(uid, data.imageUrl) };
  }

  // Resolve the cabinet this update targets: the new one if cabinetId is being
  // set, otherwise the wine's current cabinet (for in-place row/col moves).
  const effectiveCabinetId =
    data.cabinetId !== undefined ? data.cabinetId : existing.cabinetId;
  if (effectiveCabinetId) {
    const cabinet = await prisma.cabinet.findFirst({
      where: { id: effectiveCabinetId, userId: uid },
    });
    // Only enforce ownership when the cabinet is actually CHANGING — an
    // existing wine may legitimately sit in a cabinet we don't re-verify here.
    if (data.cabinetId !== undefined && data.cabinetId !== null && !cabinet) {
      throw new Error("Cabinet not found or not owned by you");
    }
    // Reject out-of-bounds placement so we don't persist orphaned slots that
    // never render in the grid (row=100 in an 8×8 cabinet). row/col/depth are
    // 0-indexed; depth 0 = front.
    if (cabinet) {
      assertSlotInBounds(cabinet, data.row, data.col, data.depth);
    }
  }

  const updateData = {
    // Only include fields that were provided
    ...(data.cabinetId !== undefined && { cabinetId: data.cabinetId }),
    ...(data.barcode !== undefined && { barcode: data.barcode }),
    ...(data.name !== undefined && { name: data.name }),
    ...(data.winery !== undefined && { winery: data.winery }),
    ...(data.region !== undefined && { region: data.region }),
    ...(data.country !== undefined && { country: data.country }),
    ...(data.vintage !== undefined && { vintage: data.vintage }),
    ...(data.type !== undefined && data.type !== null && typeof data.type === "string" && { type: data.type.toLowerCase() }),
    ...(data.sparkling !== undefined && { sparkling: data.sparkling }),
    ...(data.bottleSize !== undefined &&
      VALID_BOTTLE_SIZES.includes(data.bottleSize) && { bottleSize: data.bottleSize }),
    ...(data.grapeVariety !== undefined && { grapeVariety: data.grapeVariety }),
    ...(data.userRating !== undefined && { userRating: data.userRating }),
    ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
    ...(data.price !== undefined && { price: data.price }),
    ...(data.retailPrice !== undefined && { retailPrice: data.retailPrice }),
    ...(data.purchaseDate !== undefined && { purchaseDate: data.purchaseDate }),
    ...(data.drinkBy !== undefined && { drinkBy: data.drinkBy }),
    ...(data.notes !== undefined && { notes: data.notes }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.foodPairings !== undefined && { foodPairings: data.foodPairings }),
    ...(data.alcohol !== undefined && { alcohol: data.alcohol }),
    ...(data.row !== undefined && { row: data.row }),
    ...(data.col !== undefined && { col: data.col }),
    ...(data.depth !== undefined && { depth: data.depth }),
    ...(data.zone !== undefined && { zone: data.zone }),
    ...(data.disposition !== undefined && { disposition: data.disposition }),
    ...(data.drinkWindow !== undefined && { drinkWindow: data.drinkWindow }),
    // tastingNotes: stored as Json in Prisma, but we now use plain strings
    ...((data as Record<string, unknown>).tastingNotes !== undefined && {
      tastingNotes: (data as Record<string, unknown>).tastingNotes || null,
    }),
    // aiRatings + tags: also Json fields that can come through partial updates
    ...((data as Record<string, unknown>).aiRatings !== undefined && {
      aiRatings: (data as Record<string, unknown>).aiRatings ?? null,
    }),
    ...((data as Record<string, unknown>).tags !== undefined && {
      tags: (data as Record<string, unknown>).tags ?? [],
    }),
    // aiEnrichedAt: timestamp stamped by the enrichment pipeline — accept
    // ISO strings or Date objects and coerce to Date for Prisma.
    ...((data as Record<string, unknown>).aiEnrichedAt !== undefined && {
      aiEnrichedAt: (() => {
        const v = (data as Record<string, unknown>).aiEnrichedAt;
        if (v === null) return null;
        if (v instanceof Date) return v;
        if (typeof v === "string") return new Date(v);
        return null;
      })(),
    }),
  };

  const wine = await prisma.wine.update({
    where: { id: wineId },
    data: updateData as Prisma.WineUpdateInput,
  });

  // Propagate wine-level metadata to the user's other bottles of the same wine.
  // A patch is empty when only bottle-specific fields changed (location, notes).
  propagateSharedFields(uid, existing, sharedFieldPatch(data as Record<string, unknown>));

  // If aiRatings was just set/updated (e.g. AI enrichment filled them in
  // after the bottle was added manually), seed the community baseline.
  // seedCommunityBaseline is idempotent + first-scan-wins so re-calling
  // for an already-seeded wine is a no-op.
  const newAiRatings = (data as Record<string, unknown>).aiRatings;
  if (newAiRatings) {
    void seedCommunityBaseline({
      name: wine.name,
      winery: wine.winery,
      vintage: wine.vintage,
      type: wine.type,
      region: wine.region,
      country: wine.country,
      aiRatings: newAiRatings as AiRatings,
    }).catch(() => { /* best-effort baseline seeding */ });
  }

  return mapPrismaWine(wine);
}

export async function moveWine(
  userId: string,
  wineId: string,
  cabinetId: string | null,
  row: number | null,
  col: number | null,
  depth: number = 0,
  zone: string = ""
): Promise<Wine> {
  await assertNotDemo("move wines");
  const uid = await resolveServerUserId(userId);
  // Verify ownership BEFORE mutating
  const existing = await prisma.wine.findFirst({
    where: { id: wineId, userId: uid },
  });
  if (!existing) {
    throw new Error("Unauthorized");
  }

  // Verify the destination cabinet is ours and the slot is in-bounds.
  if (cabinetId) {
    const cabinet = await prisma.cabinet.findFirst({
      where: { id: cabinetId, userId: uid },
    });
    if (!cabinet) {
      throw new Error("Cabinet not found or not owned by you");
    }
    assertSlotInBounds(cabinet, row, col, depth);
  }

  const wine = await prisma.wine.update({
    where: { id: wineId },
    data: { cabinetId, row, col, depth, zone },
  });

  return mapPrismaWine(wine);
}

export async function removeWine(
  userId: string,
  wineId: string,
  reason: string = "other",
  consumeRating?: number | null,
  consumeNotes?: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await assertNotDemo("remove wines");
    const uid = await resolveServerUserId(userId);
    // Get the wine first for history
    const wine = await prisma.wine.findFirst({
      where: { id: wineId, userId: uid },
    });

    if (!wine) {
      return { success: false, error: "Wine not found" };
    }

    // Move to history then delete in a transaction
    await prisma.$transaction([
      prisma.wineHistory.create({
        data: wineHistoryData(uid, wine, { reason, consumeRating, consumeNotes }),
      }),
      prisma.wine.delete({
        where: { id: wineId },
      }),
    ]);

    // Propagate wine-level metadata (rating + AI enrichment data) from the
    // just-drunk bottle to any duplicates still in the cellar. Users expect
    // "I rated/enriched this wine" to stick across bottles, not just the one
    // they drank. Fills only empty fields so we never clobber user edits.
    if (wine.name && wine.winery) {
      const dupeWhere = sameWineWhere(uid, wine);
      const propagations: Promise<unknown>[] = [];
      // Consume-time rating fills empty userRating on duplicates
      if (consumeRating != null) {
        propagations.push(
          prisma.wine.updateMany({
            where: { ...dupeWhere, userRating: null },
            data: { userRating: consumeRating },
          })
        );
      }
      // AI enrichment metadata: only fill where the duplicate is empty
      if (wine.description) {
        propagations.push(
          prisma.wine.updateMany({
            where: { ...dupeWhere, description: "" },
            data: { description: wine.description },
          })
        );
      }
      if (wine.foodPairings) {
        propagations.push(
          prisma.wine.updateMany({
            where: { ...dupeWhere, foodPairings: "" },
            data: { foodPairings: wine.foodPairings },
          })
        );
      }
      if (wine.alcohol) {
        propagations.push(
          prisma.wine.updateMany({
            where: { ...dupeWhere, alcohol: "" },
            data: { alcohol: wine.alcohol },
          })
        );
      }
      if (wine.drinkWindow) {
        propagations.push(
          prisma.wine.updateMany({
            where: { ...dupeWhere, drinkWindow: "" },
            data: { drinkWindow: wine.drinkWindow },
          })
        );
      }
      if (wine.retailPrice != null) {
        propagations.push(
          prisma.wine.updateMany({
            where: { ...dupeWhere, retailPrice: null },
            data: { retailPrice: wine.retailPrice },
          })
        );
      }
      if (wine.aiRatings) {
        // aiRatings is a JSON column. Duplicates may have Prisma.DbNull (SQL NULL)
        // or Prisma.JsonNull (JSON `null` value) depending on how they were created.
        // Issue separate updateMany calls since Prisma's JSON nullable filter types
        // don't support `in` for matching both null variants simultaneously.
        const aiRatingData = { aiRatings: wine.aiRatings as Prisma.InputJsonValue };
        propagations.push(
          prisma.wine.updateMany({
            where: { ...dupeWhere, aiRatings: { equals: Prisma.DbNull } } as never,
            data: aiRatingData,
          }),
          prisma.wine.updateMany({
            where: { ...dupeWhere, aiRatings: { equals: Prisma.JsonNull } } as never,
            data: aiRatingData,
          })
        );
      }
      // Also stamp aiEnrichedAt on duplicates that never got enriched,
      // since the drunk wine was. Prevents "re-enrich" loops on the dupes.
      if ((wine as typeof wine & { aiEnrichedAt?: Date | null }).aiEnrichedAt) {
        propagations.push(
          prisma.wine.updateMany({
            where: { ...dupeWhere, aiEnrichedAt: null },
            data: {
              aiEnrichedAt: (wine as typeof wine & { aiEnrichedAt?: Date | null }).aiEnrichedAt,
            },
          })
        );
      }
      // Fire-and-forget — propagation failures shouldn't block the consume
      Promise.all(propagations).catch(() => { /* best-effort */ });
    }

    void logAudit(uid, "wine.consume", wineId, { name: wine.name, reason }).catch(() => {});

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to remove wine" };
  }
}

// ============================================================
// History queries
// ============================================================

export async function getHistory(
  userId?: string,
  limit?: number,
  options?: { fullImages?: boolean }
): Promise<import("@/types/wine").WineHistoryItem[]> {
  const uid = await resolveServerUserId(userId);
  const rows = await prisma.wineHistory.findMany({
    where: { userId: uid },
    orderBy: { removedAt: "desc" },
    // Optional cap for views that only show recent events (activity feed).
    ...(limit ? { take: Math.min(Math.max(1, Math.floor(limit)), 1000) } : {}),
  });
  return rows.map((r) => ({
    id: r.id,
    originalId: r.originalId,
    name: r.name,
    winery: r.winery,
    vintage: r.vintage,
    type: r.type,
    region: r.region,
    country: r.country,
    grapeVariety: r.grapeVariety,
    rating: r.rating,
    consumeRating: r.consumeRating,
    consumeNotes: r.consumeNotes,
    price: r.price,
    retailPrice: r.retailPrice,
    imageUrl: options?.fullImages ? r.imageUrl : listImageUrl("history", r.id, r.imageUrl),
    description: r.description,
    foodPairings: r.foodPairings,
    alcohol: r.alcohol,
    disposition: r.disposition,
    drinkWindow: r.drinkWindow,
    aiRatings: r.aiRatings as Record<string, number | null> | null,
    addedAt: r.addedAt?.toISOString() ?? null,
    removedAt: r.removedAt.toISOString(),
    reason: r.reason,
  }));
}

/** Entry shape for the taste-profile aggregation: just the bucket labels and
 *  the user's own rating. */
export interface TasteProfileEntryRow {
  id: string;
  source: "cellar" | "history";
  type: string;
  region: string;
  country: string;
  grapeVariety: string;
  rating: number | null;
}

/**
 * Slim read for the taste-profile page. It used to fetch full wines + full
 * history, and for a long-lived account that carried ~10 MB of base64 label
 * images over two server-action responses — failing on mobile and leaving
 * the page empty (2026-09-12). Six scalar fields per row is ~100 KB for a
 * 1000-row history.
 */
export async function getTasteProfileEntries(
  userId?: string
): Promise<TasteProfileEntryRow[]> {
  const uid = await resolveServerUserId(userId);
  const [wines, history] = await Promise.all([
    prisma.wine.findMany({
      where: { userId: uid },
      select: {
        id: true,
        type: true,
        region: true,
        country: true,
        grapeVariety: true,
        userRating: true,
      },
    }),
    prisma.wineHistory.findMany({
      where: { userId: uid },
      select: {
        id: true,
        type: true,
        region: true,
        country: true,
        grapeVariety: true,
        rating: true,
        consumeRating: true,
      },
    }),
  ]);
  return [
    ...wines.map((w) => ({
      id: w.id,
      source: "cellar" as const,
      type: w.type,
      region: w.region ?? "",
      country: w.country ?? "",
      grapeVariety: w.grapeVariety ?? "",
      rating: w.userRating ?? null,
    })),
    ...history.map((h) => ({
      id: h.id,
      source: "history" as const,
      type: h.type,
      region: h.region ?? "",
      country: h.country ?? "",
      grapeVariety: h.grapeVariety ?? "",
      // Consume-time rating reflects the final verdict; fall back to the
      // rating captured when the row was written.
      rating: (h.consumeRating ?? h.rating) ?? null,
    })),
  ];
}

export async function deleteHistoryItem(userId: string, id: string): Promise<void> {
  const uid = await resolveServerUserId(userId);
  await prisma.wineHistory.deleteMany({
    where: { id, userId: uid },
  });
}

export async function updateHistoryItem(
  userId: string,
  id: string,
  updates: {
    name?: string;
    winery?: string;
    vintage?: number | null;
    type?: string;
    region?: string;
    country?: string;
    grapeVariety?: string;
    alcohol?: string;
    price?: number | null;
    retailPrice?: number | null;
    description?: string;
    foodPairings?: string;
    disposition?: string;
    drinkWindow?: string;
    consumeRating?: number | null;
    consumeNotes?: string;
    reason?: string;
  }
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const uid = await resolveServerUserId(userId);
    const existing = await prisma.wineHistory.findFirst({
      where: { id, userId: uid },
    });
    if (!existing) return { success: false, error: "History record not found" };

    await prisma.wineHistory.update({
      where: { id },
      data: updates,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update" };
  }
}

/**
 * Bulk remove wines — moves them all to history and deletes in a single transaction.
 * Much faster than calling removeWine individually for large sets.
 */
export async function bulkRemoveWines(
  userId: string,
  wineIds: string[],
  reason: string = "other"
): Promise<number> {
  const uid = await resolveServerUserId(userId);
  if (wineIds.length === 0) return 0;

  // Get all wines first for history records
  const wines = await prisma.wine.findMany({
    where: { id: { in: wineIds }, userId: uid },
  });

  if (wines.length === 0) return 0;

  // Use a transaction to create history + delete in one go
  await prisma.$transaction([
    // Create history entries for all wines
    prisma.wineHistory.createMany({
      data: wines.map((wine) => wineHistoryData(uid, wine, { reason })),
    }),
    // Delete all wines in one query
    prisma.wine.deleteMany({
      where: { id: { in: wines.map((w) => w.id) }, userId: uid },
    }),
  ]);

  return wines.length;
}

export async function restoreWineFromHistory(
  userId: string,
  historyItemId: string
): Promise<Wine> {
  await assertNotDemo("restore wines");
  const uid = await resolveServerUserId(userId);

  const historyItem = await prisma.wineHistory.findFirst({
    where: { id: historyItemId, userId: uid },
  });
  if (!historyItem) throw new Error("History item not found");

  // Re-create the wine from the history entry. Create + history-delete are
  // one transaction: if they ran separately, a failure in between left the
  // bottle restored AND the history entry alive, so a second tap of Restore
  // created a duplicate bottle.
  const wine = await prisma.$transaction(async (tx) => {
    const created = await tx.wine.create({
      data: {
        userId: uid,
        name: historyItem.name,
        winery: historyItem.winery || "",
        vintage: historyItem.vintage,
        type: historyItem.type || "red",
        region: historyItem.region || "",
        country: historyItem.country || "",
        grapeVariety: historyItem.grapeVariety || "",
        imageUrl: historyItem.imageUrl || "",
        price: historyItem.price,
        retailPrice: historyItem.retailPrice,
        description: historyItem.description || "",
        foodPairings: historyItem.foodPairings || "",
        alcohol: historyItem.alcohol || "",
        disposition: historyItem.disposition || "",
        drinkWindow: historyItem.drinkWindow || "",
        aiRatings: historyItem.aiRatings ?? Prisma.JsonNull,
      },
    });

    // Remove the history entry since it's been restored
    await tx.wineHistory.delete({ where: { id: historyItemId } });

    return created;
  });

  return mapPrismaWine(wine);
}

// ============================================================
// Helpers
// ============================================================

type PrismaWine = Awaited<ReturnType<typeof prisma.wine.findFirst>> & object;

/** Convert old structured {aroma,taste,finish,overall} or plain string → string */
function flattenTastingNotes(notes: unknown): string {
  if (!notes) return "";
  if (typeof notes === "string") return notes;
  if (typeof notes === "object") {
    const n = notes as Record<string, string>;
    const parts: string[] = [];
    if (n.aroma) parts.push(`Aroma: ${n.aroma}`);
    if (n.taste) parts.push(`Taste: ${n.taste}`);
    if (n.finish) parts.push(`Finish: ${n.finish}`);
    if (n.overall) parts.push(`Overall: ${n.overall}`);
    return parts.join("\n");
  }
  return "";
}

/**
 * Batch-populate cdScore + cdRatingCount on a list of wines using a single
 * CommunityWine lookup. Wines without a community entry get cdScore=null,
 * cdRatingCount=0 — same shape the UI already handles for un-scanned wines.
 */
async function populateCdScores(wines: Wine[]): Promise<Wine[]> {
  if (wines.length === 0) return wines;
  const scores = await getCommunityScoresBatch(
    wines.map((w) => ({ name: w.name, winery: w.winery, vintage: w.vintage }))
  );
  return wines.map((w) => {
    const hit = scores.get(communityWineKey(w.name, w.winery, w.vintage));
    return hit
      ? { ...w, cdScore: hit.cdScore, cdRatingCount: hit.cdRatingCount }
      : { ...w, cdScore: null, cdRatingCount: 0 };
  });
}

/** mapPrismaWine for list responses: images are referenced by URL (see wine-image-ref). */
function mapListWine(wine: PrismaWine): Wine {
  const mapped = mapPrismaWine(wine);
  return { ...mapped, imageUrl: listImageUrl("wine", wine.id, wine.imageUrl) };
}

function mapPrismaWine(wine: PrismaWine): Wine {
  return {
    id: wine.id,
    userId: wine.userId,
    cabinetId: wine.cabinetId,
    barcode: wine.barcode,
    name: wine.name,
    winery: wine.winery,
    region: wine.region,
    country: wine.country,
    vintage: wine.vintage,
    type: wine.type as Wine["type"],
    // Use || so legacy wines with a sparkling type (sparkling/champagne/prosecco/etc.)
    // For new wines added through addWine, sparkling is always set explicitly and correctly.
    sparkling: !!(wine as PrismaWine & { sparkling?: boolean }).sparkling || isSparklingType(wine.type ?? ""),
    bottleSize: ((wine as PrismaWine & { bottleSize?: string }).bottleSize ?? "standard") as Wine["bottleSize"],
    grapeVariety: wine.grapeVariety,
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
    row: wine.row,
    col: wine.col,
    depth: wine.depth,
    zone: wine.zone,
    tastingNotes: flattenTastingNotes(wine.tastingNotes),
    disposition: wine.disposition,
    drinkWindow: wine.drinkWindow,
    aiRatings: wine.aiRatings as Wine["aiRatings"],
    tags: wine.tags ?? [],
    addedAt: wine.addedAt.toISOString(),
    updatedAt: wine.updatedAt.toISOString(),
    aiEnrichedAt:
      (wine as PrismaWine & { aiEnrichedAt?: Date | null }).aiEnrichedAt?.toISOString() ?? null,
  };
}
