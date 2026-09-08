"use server";

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { Cabinet, StorageRow, RowSize } from "@/types/wine";
import { resolveServerUserId } from "@/server/auth-guard";
import { assertNotDemo } from "@/lib/demo";

// ============================================================
// Cabinet CRUD Server Actions
// ============================================================

export interface AddCabinetInput {
  userId: string;
  wallId: string;
  name?: string;
  rows?: number;
  cols?: number;
  depth?: number;
  storageRows?: StorageRow[];
  rowSizes?: RowSize[];
  sortOrder?: number;
}

export async function addCabinet(input: AddCabinetInput): Promise<Cabinet> {
  try {
    await assertNotDemo("add sections");
    const uid = await resolveServerUserId(input.userId);

    // Verify wall ownership
    const wall = await prisma.wall.findFirst({
      where: { id: input.wallId, userId: uid },
    });
    if (!wall) throw new Error("Wall not found or not owned by you");

    const cabinet = await prisma.cabinet.create({
      data: {
        userId: uid,
        wallId: input.wallId,
        name: input.name ?? "New Section",
        rows: input.rows ?? 8,
        cols: input.cols ?? 8,
        depth: input.depth ?? 1,
        storageRows: (input.storageRows ?? []) as unknown as Prisma.InputJsonValue,
        rowSizes: (input.rowSizes ?? []) as unknown as Prisma.InputJsonValue,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    return mapPrismaCabinet(cabinet);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to add cabinet");
  }
}

export async function getCabinets(userId?: string): Promise<Cabinet[]> {
  const uid = await resolveServerUserId(userId);
  const cabinets = await prisma.cabinet.findMany({
    where: { userId: uid },
    orderBy: { sortOrder: "asc" },
  });

  return cabinets.map(mapPrismaCabinet);
}

export async function getCabinet(
  userId: string,
  cabinetId: string
): Promise<Cabinet | null> {
  const uid = await resolveServerUserId(userId);
  const cabinet = await prisma.cabinet.findFirst({
    where: { id: cabinetId, userId: uid },
  });

  return cabinet ? mapPrismaCabinet(cabinet) : null;
}

export async function updateCabinet(
  userId: string,
  cabinetId: string,
  data: Partial<Omit<AddCabinetInput, "userId">>
): Promise<Cabinet> {
  try {
    await assertNotDemo("edit sections");
    const uid = await resolveServerUserId(userId);
    // Verify ownership first
    const existing = await prisma.cabinet.findFirst({
      where: { id: cabinetId, userId: uid },
    });
    if (!existing) {
      throw new Error("Cabinet not found or unauthorized");
    }

    // If dimensions are shrinking, unassign wines that fall outside the new bounds
    const newRows = data.rows ?? existing.rows;
    const newCols = data.cols ?? existing.cols;
    const newDepth = data.depth ?? existing.depth;

    const cabinet = await prisma.$transaction(async (tx) => {
      if (newRows < existing.rows || newCols < existing.cols || newDepth < existing.depth) {
        const orConditions = [];
        if (newRows < existing.rows) {
          orConditions.push({ row: { gte: newRows } });
        }
        if (newCols < existing.cols) {
          orConditions.push({ col: { gte: newCols } });
        }
        if (newDepth < existing.depth) {
          orConditions.push({ depth: { gte: newDepth } });
        }
        await tx.wine.updateMany({
          where: {
            cabinetId,
            OR: orConditions,
          },
          data: { cabinetId: null, row: null, col: null, depth: 0 },
        });
      }

      return tx.cabinet.update({
        where: { id: cabinetId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.rows !== undefined && { rows: data.rows }),
          ...(data.cols !== undefined && { cols: data.cols }),
          ...(data.depth !== undefined && { depth: data.depth }),
          ...(data.storageRows !== undefined && { storageRows: data.storageRows as unknown as Prisma.InputJsonValue }),
          ...(data.rowSizes !== undefined && { rowSizes: data.rowSizes as unknown as Prisma.InputJsonValue }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        },
      });
    });

    return mapPrismaCabinet(cabinet);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to update cabinet");
  }
}

export async function deleteCabinet(
  userId: string,
  cabinetId: string
): Promise<void> {
  try {
    await assertNotDemo("delete sections");
    const uid = await resolveServerUserId(userId);
    const cabinet = await prisma.cabinet.findFirst({
      where: { id: cabinetId, userId: uid },
    });

    if (!cabinet) {
      throw new Error("Cabinet not found");
    }

    await prisma.$transaction([
      prisma.wine.updateMany({
        where: { cabinetId, userId: uid },
        data: { cabinetId: null, row: null, col: null, depth: 0 },
      }),
      prisma.cabinet.delete({
        where: { id: cabinetId },
      }),
    ]);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to delete cabinet");
  }
}

export async function reorderCabinets(
  userId: string,
  cabinetIds: string[]
): Promise<void> {
  try {
    const uid = await resolveServerUserId(userId);
    // Verify ALL cabinets belong to this user before reordering
    const owned = await prisma.cabinet.findMany({
      where: { id: { in: cabinetIds }, userId: uid },
      select: { id: true },
    });
    if (owned.length !== cabinetIds.length) {
      throw new Error("Unauthorized");
    }

    // Update sort order for each cabinet inside a transaction so
    // a partial failure doesn't leave sort orders in an inconsistent state.
    await prisma.$transaction(
      cabinetIds.map((id, index) =>
        prisma.cabinet.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to reorder cabinets");
  }
}

// ============================================================
// Helpers
// ============================================================

type PrismaCabinet = Awaited<ReturnType<typeof prisma.cabinet.findFirst>> &
  object;

function mapPrismaCabinet(cabinet: PrismaCabinet): Cabinet {
  return {
    id: cabinet.id,
    userId: cabinet.userId,
    wallId: cabinet.wallId,
    name: cabinet.name,
    rows: cabinet.rows,
    cols: cabinet.cols,
    depth: cabinet.depth,
    storageRows: (cabinet.storageRows as unknown as StorageRow[]) ?? [],
    rowSizes:
      ((cabinet as PrismaCabinet & { rowSizes?: unknown }).rowSizes as unknown as
        | RowSize[]
        | undefined) ?? [],
    sortOrder: cabinet.sortOrder,
  };
}
