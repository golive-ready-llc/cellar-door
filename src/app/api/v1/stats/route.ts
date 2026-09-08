import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  authenticateApiKey,
  apiSuccess,
  corsHeaders,
} from "@/lib/api-auth";

/** Handle CORS preflight */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * GET /api/v1/stats
 * Collection statistics for the authenticated user.
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (!authResult.ok) return authResult.response;
  const user = authResult.user;

  const wines = await prisma.wine.findMany({
    where: { userId: user.id },
    select: {
      type: true,
      price: true,
      retailPrice: true,
      disposition: true,
    },
  });

  const totalWines = wines.length;

  let totalCost = 0;
  let totalEstimatedValue = 0;

  const byType: Record<string, number> = {};
  const byDisposition: Record<string, number> = {};

  for (const wine of wines) {
    // Accumulate value
    if (wine.price != null) totalCost += wine.price;
    if (wine.retailPrice != null) {
      totalEstimatedValue += wine.retailPrice;
    } else if (wine.price != null) {
      totalEstimatedValue += wine.price;
    }

    // Count by type
    const t = wine.type || "unknown";
    byType[t] = (byType[t] || 0) + 1;

    // Count by disposition
    if (wine.disposition) {
      byDisposition[wine.disposition] = (byDisposition[wine.disposition] || 0) + 1;
    }
  }

  return apiSuccess({
    totalWines,
    totalCost: Math.round(totalCost * 100) / 100,
    totalEstimatedValue: Math.round(totalEstimatedValue * 100) / 100,
    byType,
    byDisposition,
  });
}
