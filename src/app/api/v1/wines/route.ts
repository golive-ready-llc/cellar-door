import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  authenticateApiKey,
  apiSuccess,
  apiError,
  corsHeaders,
} from "@/lib/api-auth";
import { serializeWine } from "@/lib/api-serialize";

/** Legacy `type` values that may still exist in pre-schema-split data (before sparkling was a separate boolean). */
const sparklingLegacyTypes = ["sparkling", "champagne", "prosecco", "cava", "crémant", "cremant", "franciacorta"];

/** Handle CORS preflight */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * GET /api/v1/wines
 * List all wines for the authenticated user.
 * Query params: type, disposition, limit (default 100, max 500), offset (default 0)
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (!authResult.ok) return authResult.response;
  const user = authResult.user;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || undefined;
  const disposition = searchParams.get("disposition") || undefined;
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100", 10) || 100, 1), 500);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  const where: Record<string, unknown> = { userId: user.id };
  if (type) {
    if (type.toLowerCase() === "sparkling") {
      // Sparkling is a boolean orthogonal to color. Match the `sparkling: true`
      // flag OR legacy rows where type was set to "sparkling" before the split.
      where.OR = [
        { type: { in: sparklingLegacyTypes } },
        { sparkling: true },
      ];
    } else {
      where.type = type.toLowerCase();
    }
  }
  if (disposition) where.disposition = disposition.toLowerCase();

  const [wines, total] = await Promise.all([
    prisma.wine.findMany({
      where,
      orderBy: { addedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.wine.count({ where }),
  ]);

  return apiSuccess({
    wines: wines.map(serializeWine),
    total,
    limit,
    offset,
  });
}

/**
 * POST /api/v1/wines
 * Add a new wine. `name` is required.
 */
export async function POST(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (!authResult.ok) return authResult.response;
  const user = authResult.user;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
    return apiError("Field 'name' is required.", 400);
  }

  try {
    // Validate cabinetId ownership if provided (non-empty string)
    const resolvedCabinetId =
      typeof body.cabinetId === "string" && body.cabinetId.trim() !== ""
        ? body.cabinetId
        : null;
    if (resolvedCabinetId) {
      const cabinet = await prisma.cabinet.findFirst({
        where: { id: resolvedCabinetId, userId: user.id },
      });
      if (!cabinet) {
        return apiError("Cabinet not found or not owned by you.", 403);
      }
    }

    const wine = await prisma.wine.create({
      data: {
        userId: user.id,
        name: body.name as string,
        cabinetId: resolvedCabinetId,
        barcode: (body.barcode as string) ?? "",
        winery: (body.winery as string) ?? "",
        region: (body.region as string) ?? "",
        country: (body.country as string) ?? "",
        vintage: body.vintage != null ? Number(body.vintage) : null,
        type: ((body.type as string) ?? "red").toLowerCase(),
        sparkling: body.sparkling !== undefined
          ? !!body.sparkling
          : sparklingLegacyTypes.includes(((body.type as string) ?? "").toLowerCase()),
        grapeVariety: (body.grapeVariety as string) ?? "",
        userRating: body.userRating != null ? Number(body.userRating) : null,
        imageUrl: (body.imageUrl as string) ?? "",
        price: body.price != null ? Number(body.price) : null,
        retailPrice: body.retailPrice != null ? Number(body.retailPrice) : null,
        purchaseDate: (body.purchaseDate as string) ?? "",
        drinkBy: (body.drinkBy as string) ?? "",
        notes: (body.notes as string) ?? "",
        description: (body.description as string) ?? "",
        foodPairings: (body.foodPairings as string) ?? "",
        alcohol: (body.alcohol as string) ?? "",
        row: body.row != null ? Number(body.row) : null,
        col: body.col != null ? Number(body.col) : null,
        depth: body.depth != null ? Number(body.depth) : 0,
        zone: (body.zone as string) ?? "",
        disposition: (body.disposition as string) ?? "",
        drinkWindow: (body.drinkWindow as string) ?? "",
        tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string") : [],
        tastingNotes: (body.tastingNotes as string) ?? "",
        aiRatings: (body.aiRatings ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    return apiSuccess(serializeWine(wine), 201);
  } catch (err) {
    console.error("[API v1/wines POST]", err);
    return apiError("Failed to create wine.", 500);
  }
}

