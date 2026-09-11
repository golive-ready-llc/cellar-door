"use server";

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { BuyListItem } from "@/types/wine";
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
        sparkling: data.sparkling ?? (
          ["sparkling", "champagne", "prosecco", "cava", "crémant", "cremant", "franciacorta"].includes(
            (data.type ?? "").toLowerCase()
          )
        ),
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

export async function updateBuyListItem(
  userId: string,
  itemId: string,
  data: Partial<Omit<BuyListItem, "id" | "addedAt" | "userId">>
): Promise<BuyListItem> {
  try {
    await assertNotDemo("edit buy-list items");
    const uid = await resolveServerUserId(userId);
    // Scope the mutation itself to the owner (updateMany allows a non-unique
    // where) so authorization and the write are atomic — not a check-then-act
    // pair where the write could run unscoped.
    const updated = await prisma.buyListItem.updateMany({
      where: { id: itemId, userId: uid },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.winery !== undefined && { winery: data.winery }),
        ...(data.region !== undefined && { region: data.region }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.vintage !== undefined && { vintage: data.vintage }),
        ...(data.type !== undefined && { type: data.type.toLowerCase() }),
        ...(data.sparkling !== undefined && { sparkling: data.sparkling }),
        ...(data.grapeVariety !== undefined && { grapeVariety: data.grapeVariety }),
        ...(data.retailPrice !== undefined && { retailPrice: data.retailPrice }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.orderDate !== undefined && { orderDate: data.orderDate ? new Date(data.orderDate) : null }),
        ...(data.expectedDelivery !== undefined && { expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null }),
        ...(data.store !== undefined && { store: data.store }),
        ...(data.barcode !== undefined && { barcode: data.barcode }),
        ...(data.imageUrl !== undefined && { imageUrl: await resolveImageRef(uid, data.imageUrl) }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.foodPairings !== undefined && { foodPairings: data.foodPairings }),
        ...(data.alcohol !== undefined && { alcohol: data.alcohol }),
        ...(data.disposition !== undefined && { disposition: data.disposition }),
        ...(data.drinkWindow !== undefined && { drinkWindow: data.drinkWindow }),
      },
    });
    if (updated.count === 0) throw new Error("Buy list item not found");
    const item = await prisma.buyListItem.findUnique({ where: { id: itemId } });
    if (!item) throw new Error("Buy list item not found");
    return mapPrismaBuyListItem(item);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to update buy list item");
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
