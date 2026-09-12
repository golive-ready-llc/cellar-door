import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  authenticateApiKey,
  apiSuccess,
  apiError,
  corsHeaders,
} from "@/lib/api-auth";
import { serializeWine, SHARED_WINE_FIELDS } from "@/lib/api-serialize";

/** Handle CORS preflight */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * GET /api/v1/wines/:id
 * Get a single wine by ID (must belong to user).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request);
  if (!authResult.ok) return authResult.response;
  const user = authResult.user;
  const { id } = await params;

  const wine = await prisma.wine.findFirst({
    where: { id, userId: user.id },
  });

  if (!wine) {
    return apiError("Wine not found.", 404);
  }

  return apiSuccess(serializeWine(wine));
}

/**
 * PUT /api/v1/wines/:id
 * Update a wine (must belong to user).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request);
  if (!authResult.ok) return authResult.response;
  const user = authResult.user;
  const { id } = await params;

  // Verify ownership
  const existing = await prisma.wine.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return apiError("Wine not found.", 404);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  try {
    // Validate cabinetId ownership if changing it
    if (body.cabinetId !== undefined && body.cabinetId !== null) {
      const cabinet = await prisma.cabinet.findFirst({
        where: { id: body.cabinetId as string, userId: user.id },
      });
      if (!cabinet) {
        return apiError("Cabinet not found or not owned by you.", 403);
      }
    }

    // AI enrichment fields: coerced once here so the addressed bottle and its
    // duplicates always receive the same values.
    const aiUpdates: Record<string, unknown> = {};
    if (body.aiRatings !== undefined) aiUpdates.aiRatings = body.aiRatings ?? null;
    if (body.tastingNotes !== undefined) aiUpdates.tastingNotes = body.tastingNotes || null;
    if (body.aiEnrichedAt !== undefined) {
      const v = body.aiEnrichedAt;
      if (v === null) aiUpdates.aiEnrichedAt = null;
      else if (typeof v === "string") aiUpdates.aiEnrichedAt = new Date(v);
      else if (v instanceof Date) aiUpdates.aiEnrichedAt = v;
    }

    const wine = await prisma.wine.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name as string }),
        ...(body.cabinetId !== undefined && { cabinetId: body.cabinetId as string | null }),
        ...(body.barcode !== undefined && { barcode: body.barcode as string }),
        ...(body.winery !== undefined && { winery: body.winery as string }),
        ...(body.region !== undefined && { region: body.region as string }),
        ...(body.country !== undefined && { country: body.country as string }),
        ...(body.vintage !== undefined && {
          vintage: body.vintage != null ? Number(body.vintage) : null,
        }),
        ...(body.type !== undefined && body.type !== null && typeof body.type === "string" && {
          type: body.type.toLowerCase(),
        }),
        ...(body.sparkling !== undefined && { sparkling: !!body.sparkling }),
        ...(body.grapeVariety !== undefined && { grapeVariety: body.grapeVariety as string }),
        ...(body.userRating !== undefined && {
          userRating: body.userRating != null ? Number(body.userRating) : null,
        }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl as string }),
        ...(body.price !== undefined && {
          price: body.price != null ? Number(body.price) : null,
        }),
        ...(body.retailPrice !== undefined && {
          retailPrice: body.retailPrice != null ? Number(body.retailPrice) : null,
        }),
        ...(body.purchaseDate !== undefined && { purchaseDate: body.purchaseDate as string }),
        ...(body.drinkBy !== undefined && { drinkBy: body.drinkBy as string }),
        ...(body.notes !== undefined && { notes: body.notes as string }),
        ...(body.description !== undefined && { description: body.description as string }),
        ...(body.foodPairings !== undefined && { foodPairings: body.foodPairings as string }),
        ...(body.alcohol !== undefined && { alcohol: body.alcohol as string }),
        ...(body.row !== undefined && { row: body.row != null ? Number(body.row) : null }),
        ...(body.col !== undefined && { col: body.col != null ? Number(body.col) : null }),
        ...(body.depth !== undefined && { depth: Number(body.depth) }),
        ...(body.zone !== undefined && { zone: body.zone as string }),
        ...(body.disposition !== undefined && { disposition: body.disposition as string }),
        ...(body.drinkWindow !== undefined && { drinkWindow: body.drinkWindow as string }),
        ...(body.tags !== undefined && { tags: body.tags as string[] }),
        ...aiUpdates,
      } as import("@/generated/prisma/client").Prisma.WineUpdateInput,
    });

    // Propagate shared wine-level metadata to duplicates (same name+winery+vintage).
    // Mirrors server action updateWine SHARED_FIELDS propagation.
    // Skip entirely if no shared fields are being changed (e.g. only location/notes updated).
    const hasSharedChanges = SHARED_WINE_FIELDS.some((f) => body[f] !== undefined) ||
      body.aiRatings !== undefined || body.tastingNotes !== undefined || body.aiEnrichedAt !== undefined;

    if (hasSharedChanges && existing.name && existing.winery) {
      const sharedUpdates: Record<string, unknown> = {};
      for (const field of SHARED_WINE_FIELDS) {
        if (body[field] !== undefined) {
          sharedUpdates[field] = field === "type" && body.type ? (body.type as string).toLowerCase() : body[field];
        }
      }
      Object.assign(sharedUpdates, aiUpdates);

      if (Object.keys(sharedUpdates).length > 0) {
        void prisma.wine.updateMany({
          where: {
            userId: user.id,
            id: { not: id },
            name: { equals: existing.name, mode: "insensitive" },
            winery: { equals: existing.winery, mode: "insensitive" },
            vintage: existing.vintage,
          },
          data: sharedUpdates,
        }).catch(() => { /* best-effort */ });
      }
    }

    return apiSuccess(serializeWine(wine));
  } catch (err) {
    console.error("[API v1/wines PUT]", err);
    return apiError("Failed to update wine.", 500);
  }
}

/**
 * DELETE /api/v1/wines/:id
 * Delete a wine (must belong to user).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request);
  if (!authResult.ok) return authResult.response;
  const user = authResult.user;
  const { id } = await params;

  const wine = await prisma.wine.findFirst({
    where: { id, userId: user.id },
  });

  if (!wine) {
    return apiError("Wine not found.", 404);
  }

  // Move to history before deleting — single transaction
  await prisma.$transaction([
    prisma.wineHistory.create({
      data: {
        userId: user.id,
        originalId: wine.id,
        name: wine.name,
        winery: wine.winery,
        vintage: wine.vintage,
        type: wine.type,
        region: wine.region,
        country: wine.country,
        grapeVariety: wine.grapeVariety,
        rating: wine.userRating,
        price: wine.price,
        retailPrice: wine.retailPrice,
        imageUrl: wine.imageUrl,
        description: wine.description,
        foodPairings: wine.foodPairings,
        alcohol: wine.alcohol,
        disposition: wine.disposition,
        drinkWindow: wine.drinkWindow,
        aiRatings: wine.aiRatings ?? undefined,
        addedAt: wine.addedAt,
        reason: "api_delete",
      },
    }),
    prisma.wine.delete({ where: { id } }),
  ]);

  return apiSuccess({ deleted: true });
}
