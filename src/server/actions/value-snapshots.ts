"use server";

import { prisma } from "@/lib/db";
import { resolveServerUserId } from "@/server/auth-guard";

/**
 * Take a monthly snapshot of the user's cellar value.
 * Called lazily when the stats page loads — idempotent per month.
 */
export async function snapshotCellarValue(userId?: string) {
  try {
    const uid = await resolveServerUserId(userId);
    const yearMonth = new Date().toISOString().slice(0, 7);

    // Check if snapshot already exists for this month
    const existing = await prisma.valueSnapshot.findUnique({
      where: { userId_yearMonth: { userId: uid, yearMonth } },
    });
    if (existing) return existing;

    // Calculate current totals via aggregate query (avoids fetching all rows)
    const agg = await prisma.wine.aggregate({
      where: { userId: uid },
      _sum: { price: true, retailPrice: true },
    });

    const totalCost = agg._sum.price ?? 0;
    const totalMarket = agg._sum.retailPrice ?? totalCost;
    const wineCount = await prisma.wine.count({ where: { userId: uid } });

    return prisma.valueSnapshot.create({
      data: {
        userId: uid,
        yearMonth,
        totalCost,
        totalMarket,
        wineCount,
      },
    });
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to snapshot cellar value");
  }
}

export async function getValueHistory(userId?: string) {
  try {
    const uid = await resolveServerUserId(userId);
    return prisma.valueSnapshot.findMany({
      where: { userId: uid },
      orderBy: { yearMonth: "asc" },
    });
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to get value history");
  }
}
