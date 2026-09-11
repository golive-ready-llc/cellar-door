"use server";

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { encrypt, decrypt } from "@/lib/encryption";
import { hasFeature } from "@/lib/tier";
import type { Wall, HaConfig } from "@/types/wine";
import type { Tier } from "@/lib/tier";
import { resolveServerUserId } from "@/server/auth-guard";
import { assertNotDemo } from "@/lib/demo";
import { createSafeFetch } from "@/lib/ssrf-guard";

// ============================================================
// Wall CRUD Server Actions
// ============================================================

export interface AddWallInput {
  userId: string;
  name?: string;
  location?: string;
  sortOrder?: number;
}

export async function addWall(input: AddWallInput): Promise<Wall> {
  await assertNotDemo("add walls");
  const uid = await resolveServerUserId(input.userId);
  const wall = await prisma.wall.create({
    data: {
      userId: uid,
      name: input.name ?? "New Wall",
      location: input.location ?? "Home",
      sortOrder: input.sortOrder ?? 0,
    },
  });

  return mapPrismaWall(wall);
}

export async function getWalls(userId?: string): Promise<Wall[]> {
  const uid = await resolveServerUserId(userId);
  const walls = await prisma.wall.findMany({
    where: { userId: uid },
    orderBy: { sortOrder: "asc" },
  });

  return walls.map(mapPrismaWall);
}

export async function getWall(
  userId: string,
  wallId: string
): Promise<Wall | null> {
  const uid = await resolveServerUserId(userId);
  const wall = await prisma.wall.findFirst({
    where: { id: wallId, userId: uid },
  });

  return wall ? mapPrismaWall(wall) : null;
}

export async function updateWall(
  userId: string,
  wallId: string,
  data: Partial<Omit<AddWallInput, "userId">>
): Promise<Wall> {
  await assertNotDemo("edit walls");
  const uid = await resolveServerUserId(userId);
  // Verify ownership BEFORE mutating
  const existing = await prisma.wall.findFirst({
    where: { id: wallId, userId: uid },
  });
  if (!existing) {
    throw new Error("Unauthorized");
  }

  const wall = await prisma.wall.update({
    where: { id: wallId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
  });

  return mapPrismaWall(wall);
}

export async function deleteWall(
  userId: string,
  wallId: string
): Promise<void> {
  await assertNotDemo("delete walls");
  const uid = await resolveServerUserId(userId);
  const wall = await prisma.wall.findFirst({
    where: { id: wallId, userId: uid },
  });

  if (!wall) {
    throw new Error("Wall not found");
  }

  // Unassign wines from cabinets in this wall (scoped to user)
  const cabinetIds = await prisma.cabinet.findMany({
    where: { wallId, userId: uid },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.wine.updateMany({
      where: { userId: uid, cabinetId: { in: cabinetIds.map((c) => c.id) } },
      data: { cabinetId: null, row: null, col: null, depth: 0 },
    }),
    prisma.cabinet.deleteMany({ where: { wallId, userId: uid } }),
    prisma.wall.delete({ where: { id: wallId } }),
  ]);
}

// ============================================================
// Helpers
// ============================================================

type PrismaWall = Awaited<ReturnType<typeof prisma.wall.findFirst>> & object;

function mapPrismaWall(wall: PrismaWall): Wall {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (wall as any).haConfig as Record<string, string> | null;
  const haConfig: HaConfig | null = raw?.haUrl
    ? {
        haUrl: raw.haUrl,
        tempEntityId: raw.tempEntityId || "",
        humidityEntityId: raw.humidityEntityId || "",
        hasToken: !!raw.encryptedToken,
      }
    : null;

  return {
    id: wall.id,
    userId: wall.userId,
    name: wall.name,
    location: wall.location,
    sortOrder: wall.sortOrder,
    haConfig,
  };
}

// ============================================================
// Home Assistant Sensor Config
// ============================================================

async function requirePremium(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });
  if (!user || !hasFeature(user.tier as Tier, "haSensors")) {
    throw new Error("Home Assistant sensors require Cellar Pro");
  }
}

export async function updateWallHaConfig(
  userId: string,
  wallId: string,
  haUrl: string,
  token: string,
  tempEntityId: string,
  humidityEntityId: string
): Promise<{ success: true; wall: Wall } | { success: false; error: string }> {
  try {
    const uid = await resolveServerUserId(userId);

    const existing = await prisma.wall.findFirst({
      where: { id: wallId, userId: uid },
    });
    if (!existing) return { success: false, error: "Wall not found" };

    await requirePremium(uid);

    // Preserve existing token when caller passes empty string (sentinel for "keep current")
    const tokenToStore = token
      ? encrypt(token)
      : (existing.haConfig as Record<string, unknown> | null)?.encryptedToken as string || "";

    const wall = await prisma.wall.update({
      where: { id: wallId },
      data: {
        haConfig: {
          haUrl: haUrl.replace(/\/+$/, ""), // strip trailing slash
          encryptedToken: tokenToStore,
          tempEntityId,
          humidityEntityId,
        },
      },
    });

    return { success: true, wall: mapPrismaWall(wall) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save sensor config",
    };
  }
}

export async function removeWallHaConfig(
  userId: string,
  wallId: string
): Promise<{ success: true; wall: Wall } | { success: false; error: string }> {
  try {
    const uid = await resolveServerUserId(userId);
    const existing = await prisma.wall.findFirst({
      where: { id: wallId, userId: uid },
    });
    if (!existing) return { success: false, error: "Wall not found" };

    // Prisma requires JsonNull for setting Json? to null — `undefined` is
    // silently dropped, leaving the encrypted token in place (data leak).
    const wall = await prisma.wall.update({
      where: { id: wallId },
      data: { haConfig: Prisma.JsonNull },
    });

    return { success: true, wall: mapPrismaWall(wall) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to remove sensor config",
    };
  }
}

export async function testHaConnection(
  haUrl: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  // This makes an outbound request to a caller-chosen URL, so only signed-in
  // Cellar Pro owners may use it. Exported "use server" functions are public
  // endpoints; without this check it was an open SSRF probe.
  try {
    const uid = await resolveServerUserId();
    await requirePremium(uid);
  } catch {
    return {
      success: false,
      error: "Sign in with a Cellar Pro account to connect Home Assistant.",
    };
  }

  try {
    const url = haUrl.trim().replace(/\/+$/, "");
    // Same SSRF guard as the sensor proxy: https only (unless HA_ALLOW_HTTP),
    // no private, loopback or cloud-metadata addresses, DNS re-checked right
    // before the request, and redirects are not followed.
    const res = await createSafeFetch(`${url}/api/`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status >= 300 && res.status < 400) {
      return {
        success: false,
        error: "Home Assistant redirected the request. Use its direct URL.",
      };
    }
    if (!res.ok) {
      if (res.status === 401) return { success: false, error: "Invalid access token" };
      return { success: false, error: `HA returned ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("timeout") || msg.includes("abort")) {
      return { success: false, error: "Connection timed out — is the URL reachable?" };
    }
    return { success: false, error: msg };
  }
}

/** Server-only: get decrypted HA config for proxy use */
export async function getWallHaConfigDecrypted(
  userId: string,
  wallId: string
): Promise<{
  haUrl: string;
  token: string;
  tempEntityId: string;
  humidityEntityId: string;
} | null> {
  const uid = await resolveServerUserId(userId);

  const wall = await prisma.wall.findFirst({
    where: { id: wallId, userId: uid },
  });
  if (!wall) return null;

  await requirePremium(uid);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (wall as any).haConfig as Record<string, string> | null;
  if (!raw?.encryptedToken) return null;

  return {
    haUrl: raw.haUrl,
    token: decrypt(raw.encryptedToken),
    tempEntityId: raw.tempEntityId,
    humidityEntityId: raw.humidityEntityId,
  };
}
