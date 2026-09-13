"use server";

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { resolveServerUserId } from "@/server/auth-guard";
import { assertNotDemo } from "@/lib/demo";
import type { Wine, Wall, Cabinet, WineHistoryItem, BuyListItem } from "@/types/wine";

/**
 * Restore a full backup — replaces ALL user data with the backup contents.
 * Runs in a single Prisma interactive transaction so partial restores are
 * never committed.
 */
export async function restoreBackup(
  data: {
    wines?: Wine[];
    walls?: Wall[];
    cabinets?: Cabinet[];
    history?: WineHistoryItem[];
    buyList?: BuyListItem[];
  },
  userId?: string
) {
  await assertNotDemo("restore a backup");
  const uid = await resolveServerUserId(userId);

  // Basic input validation — ensure each item is an object with required fields
  function validateBackupData() {
    const errors: string[] = [];
    if (data.walls?.length) {
      data.walls.forEach((w, i) => {
        if (!w || typeof w !== "object" || !w.id) errors.push(`walls[${i}]: missing id`);
      });
    }
    if (data.cabinets?.length) {
      data.cabinets.forEach((c, i) => {
        if (!c || typeof c !== "object" || !c.id) errors.push(`cabinets[${i}]: missing id`);
      });
    }
    if (data.wines?.length) {
      data.wines.forEach((w, i) => {
        if (!w || typeof w !== "object" || !w.id || !w.name) errors.push(`wines[${i}]: missing id or name`);
      });
    }
    if (data.history?.length) {
      data.history.forEach((h, i) => {
        if (!h || typeof h !== "object" || !h.id || !h.name) errors.push(`history[${i}]: missing id or name`);
      });
    }
    if (data.buyList?.length) {
      data.buyList.forEach((b, i) => {
        if (!b || typeof b !== "object" || !b.name) errors.push(`buyList[${i}]: missing name`);
      });
    }
    if (errors.length) {
      throw new Error(`Backup validation failed:\n  - ${errors.join("\n  - ")}`);
    }
  }
  validateBackupData();

  await prisma.$transaction(async (tx) => {
    // 1. Delete all existing user data (order: dependents first)
    await tx.wine.deleteMany({ where: { userId: uid } });
    await tx.cabinet.deleteMany({ where: { userId: uid } });
    await tx.wall.deleteMany({ where: { userId: uid } });
    await tx.wineHistory.deleteMany({ where: { userId: uid } });
    await tx.buyListItem.deleteMany({ where: { userId: uid } });

    // 2. Re-insert: walls → cabinets → wines, history, buy list

    if (data.walls?.length) {
      await tx.wall.createMany({
        data: data.walls.map((w) => ({
          id: w.id,
          userId: uid,
          name: w.name ?? "Restored Wall",
          location: w.location ?? "",
          sortOrder: w.sortOrder ?? 0,
        })),
        skipDuplicates: true,
      });
    }

    if (data.cabinets?.length) {
      await tx.cabinet.createMany({
        data: data.cabinets.map((c) => ({
          id: c.id,
          userId: uid,
          wallId: c.wallId,
          name: c.name ?? "Restored Section",
          rows: c.rows ?? 8,
          cols: c.cols ?? 8,
          depth: c.depth ?? 1,
          storageRows: (c.storageRows ?? []) as unknown as Prisma.InputJsonValue,
          rowSizes: (c.rowSizes ?? []) as unknown as Prisma.InputJsonValue,
          sortOrder: c.sortOrder ?? 0,
        })),
        skipDuplicates: true,
      });
    }

    if (data.wines?.length) {
      for (const wine of data.wines) {
        await tx.wine.create({
          data: {
            id: wine.id,
            userId: uid,
            cabinetId: wine.cabinetId ?? null,
            barcode: wine.barcode ?? "",
            name: wine.name,
            winery: wine.winery ?? "",
            region: wine.region ?? "",
            country: wine.country ?? "",
            vintage: wine.vintage ?? null,
            type: wine.type ?? "red",
            sparkling: wine.sparkling ?? false,
            bottleSize: wine.bottleSize ?? "standard",
            grapeVariety: wine.grapeVariety ?? "",
            userRating: wine.userRating ?? null,
            imageUrl: wine.imageUrl ?? "",
            price: wine.price ?? null,
            retailPrice: wine.retailPrice ?? null,
            purchaseDate: wine.purchaseDate ?? "",
            drinkBy: wine.drinkBy ?? "",
            notes: wine.notes ?? "",
            description: wine.description ?? "",
            foodPairings: wine.foodPairings ?? "",
            alcohol: wine.alcohol ?? "",
            row: wine.row ?? null,
            col: wine.col ?? null,
            depth: wine.depth ?? 0,
            zone: wine.zone ?? "",
            tags: wine.tags ?? [],
            tastingNotes: (wine.tastingNotes ?? undefined) as
              | Prisma.InputJsonValue
              | undefined,
            disposition: wine.disposition ?? "",
            drinkWindow: wine.drinkWindow ?? "",
            aiRatings: (wine.aiRatings ?? undefined) as
              | Prisma.InputJsonValue
              | undefined,
            aiEnrichedAt: wine.aiEnrichedAt ? new Date(wine.aiEnrichedAt) : null,
            addedAt: wine.addedAt ? new Date(wine.addedAt) : new Date(),
          },
        });
      }
    }

    if (data.history?.length) {
      for (const item of data.history) {
        await tx.wineHistory.create({
          data: {
            id: item.id,
            userId: uid,
            originalId: item.originalId,
            name: item.name,
            winery: item.winery ?? "",
            vintage: item.vintage ?? null,
            type: item.type ?? "red",
            region: item.region ?? "",
            country: item.country ?? "",
            grapeVariety: item.grapeVariety ?? "",
            rating: item.rating ?? null,
            consumeRating: item.consumeRating ?? null,
            consumeNotes: item.consumeNotes ?? "",
            price: item.price ?? null,
            retailPrice: item.retailPrice ?? null,
            imageUrl: item.imageUrl ?? "",
            description: item.description ?? "",
            foodPairings: item.foodPairings ?? "",
            alcohol: item.alcohol ?? "",
            disposition: item.disposition ?? "",
            drinkWindow: item.drinkWindow ?? "",
            aiRatings: (item.aiRatings ?? undefined) as
              | Prisma.InputJsonValue
              | undefined,
            addedAt: item.addedAt ? new Date(item.addedAt) : new Date(),
            removedAt: item.removedAt ? new Date(item.removedAt) : new Date(),
            reason: item.reason ?? "restored",
          },
        });
      }
    }

    if (data.buyList?.length) {
      for (const item of data.buyList) {
        await tx.buyListItem.create({
          data: {
            id: item.id,
            userId: uid,
            name: item.name,
            barcode: item.barcode ?? "",
            winery: item.winery ?? "",
            region: item.region ?? "",
            country: item.country ?? "",
            vintage: item.vintage ?? null,
            type: item.type ?? "red",
            sparkling: item.sparkling ?? false,
            grapeVariety: item.grapeVariety ?? "",
            imageUrl: item.imageUrl ?? "",
            retailPrice: item.retailPrice ?? null,
            notes: item.notes ?? "",
            description: item.description ?? "",
            foodPairings: item.foodPairings ?? "",
            alcohol: item.alcohol ?? "",
            disposition: item.disposition ?? "",
            drinkWindow: item.drinkWindow ?? "",
            aiRatings: (item.aiRatings ?? undefined) as
              | Prisma.InputJsonValue
              | undefined,
            status: item.status ?? "wanted",
            addedAt: item.addedAt ? new Date(item.addedAt) : new Date(),
          },
        });
      }
    }
  });
}
