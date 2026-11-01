"use server";

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { isSparklingType, type BuyListItem } from "@/types/wine";
import { resolveServerUserId } from "@/server/auth-guard";
import { resolveImageRef } from "@/server/wine-image-refs";
import { assertNotDemo } from "@/lib/demo";

// ============================================================
// Buy List Server Actions
// ============================================================

function mapPrismaBuyListItem(item: NonNullable<Awaited<ReturnType<typeof prisma.buyListItem.findFirst>>>): BuyListItem {
  return {
    id: item.id,
    userId: item.userId,
    barcode: item.barcode,
    name: item.name,
    winery: item.winery,
    region: item.region,
    country: item.country,
    vintage: item.vintage,
    type: item.type as BuyListItem["type"],
    sparkling: (item as typeof item & { sparkling?: boolean }).sparkling ?? false,
    grapeVariety: item.grapeVariety,
    imageUrl: item.imageUrl,
    retailPrice: item.retailPrice,
    notes: item.notes,
    description: item.description,
    foodPairings: item.foodPairings,
    alcohol: item.alcohol,
    disposition: item.disposition,
    drinkWindow: item.drinkWindow,
    aiRatings: item.aiRatings as BuyListItem["aiRatings"],
    status: (item.status as BuyListItem["status"]) || "wanted",
    orderDate: item.orderDate?.toISOString().split("T")[0] ?? null,
    expectedDelivery: item.expectedDelivery?.toISOString().split("T")[0] ?? null,
    store: item.store,
    addedAt: item.addedAt.toISOString(),
  };
}

export async function getBuyList(userId?: string): Promise<BuyListItem[]> {
  try {
    const uid = await resolveServerUserId(userId);
    const items = await prisma.buyListItem.findMany({
      where: { userId: uid },
      orderBy: { addedAt: "desc" },
    });
    return items.map(mapPrismaBuyListItem);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to fetch buy list");
  }
}

export async function addBuyListItem(
  userId: string,
  data: Omit<BuyListItem, "id" | "addedAt" | "userId">
): Promise<BuyListItem> {
  try {
    await assertNotDemo("add buy-list items");
    const uid = await resolveServerUserId(userId);
    const item = await prisma.buyListItem.create({
      data: {
        userId: uid,
        barcode: data.barcode ?? "",
        name: data.name,
        winery: data.winery ?? "",
        region: data.region ?? "",
        country: data.country ?? "",
        vintage: data.vintage,
        type: (data.type ?? "red").toLowerCase(),
        sparkling: data.sparkling ?? isSparklingType(data.type ?? ""),
        grapeVariety: data.grapeVariety ?? "",
        imageUrl: data.imageUrl ? await resolveImageRef(uid, data.imageUrl) : "",
        retailPrice: data.retailPrice,
        notes: data.notes ?? "",
        description: data.description ?? "",
        foodPairings: data.foodPairings ?? "",
        alcohol: data.alcohol ?? "",
        disposition: data.disposition ?? "",
        drinkWindow: data.drinkWindow ?? "",
        aiRatings: (data.aiRatings ?? undefined) as Prisma.InputJsonValue | undefined,
        status: data.status ?? "wanted",
        orderDate: data.orderDate ? new Date(data.orderDate) : null,
        expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
        store: data.store ?? "",
      },
    });
    return mapPrismaBuyListItem(item);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to add buy list item");
  }
}

export async function removeBuyListItem(
  userId: string,
  itemId: string
): Promise<void> {
  try {
    await assertNotDemo("remove buy-list items");
    const uid = await resolveServerUserId(userId);
    // deleteMany scopes the delete to the owner — authorization and delete are
    // one atomic, scoped operation.
    const deleted = await prisma.buyListItem.deleteMany({ where: { id: itemId, userId: uid } });
    if (deleted.count === 0) throw new Error("Buy list item not found");
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to remove buy list item");
  }
}
