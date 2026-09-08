"use server";

import { prisma } from "@/lib/db";
import { resolveServerUserId } from "@/server/auth-guard";

// ============================================================
// Guest Session (Sommelier Mode) Server Actions
// ============================================================

/** Generate a random 6-character alphanumeric code */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid ambiguous: 0/O, 1/I
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createGuestSession(
  userId: string,
  name: string,
  hoursValid: number
) {
  try {
    const uid = await resolveServerUserId(userId);
    const expiresAt = new Date(Date.now() + hoursValid * 60 * 60 * 1000);

    // Retry loop handles TOCTOU race: if two requests generate the same code
    // concurrently, the unique constraint will reject one. We catch that and
    // retry with a fresh code instead of checking existence first.
    let attempts = 0;
    while (attempts < 5) {
      const code = generateCode();
      try {
        const session = await prisma.guestSession.create({
          data: {
            userId: uid,
            code,
            name,
            expiresAt,
          },
        });
        return session;
      } catch (error: unknown) {
        // Prisma P2002 = unique constraint violation
        const prismaError = error as { code?: string };
        if (prismaError.code === "P2002") {
          attempts++;
          continue;
        }
        throw error;
      }
    }

    throw new Error("Failed to generate a unique session code after 5 attempts");
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to create guest session");
  }
}

export async function getGuestSession(code: string) {
  const session = await prisma.guestSession.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      user: {
        select: { displayName: true },
      },
    },
  });

  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) return null;

  // Fetch wines for the host (public fields only — NO price, notes, userRating)
  // Only show wines that are ready to drink (disposition D, or no disposition set)
  const wines = await prisma.wine.findMany({
    where: {
      userId: session.userId,
      OR: [
        { disposition: "D" },
        { disposition: "" },
      ],
    },
    select: {
      id: true,
      name: true,
      winery: true,
      type: true,
      vintage: true,
      region: true,
      country: true,
      grapeVariety: true,
      description: true,
      disposition: true,
      imageUrl: true,
      drinkWindow: true,
      foodPairings: true,
    },
    orderBy: { name: "asc" },
  });

  return {
    id: session.id,
    name: session.name,
    hostName: session.user.displayName || "A Wine Lover",
    expiresAt: session.expiresAt.toISOString(),
    votes: (session.votes ?? {}) as Record<string, number>,
    wines,
  };
}

export async function voteForWine(code: string, wineId: string) {
  const upperCode = code.toUpperCase();

  // Audit fix #20: confirm the wine belongs to this guest session's host
  // before recording a vote. Otherwise a guest could enumerate wine IDs and
  // vote on arbitrary other-user wines.
  const session = await prisma.guestSession.findUnique({
    where: { code: upperCode },
    select: { userId: true, expiresAt: true },
  });
  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) return null;

  const wine = await prisma.wine.findFirst({
    where: { id: wineId, userId: session.userId },
    select: { id: true },
  });
  if (!wine) {
    throw new Error("Wine not in this guest session");
  }

  // Atomic increment using raw SQL to prevent read-modify-write race conditions.
  // Two concurrent votes on the same wine will both be counted.
  const result = await prisma.$executeRaw`
    UPDATE "GuestSession"
    SET votes = jsonb_set(
      COALESCE(votes, '{}'::jsonb),
      ARRAY[${wineId}],
      (COALESCE(votes->${wineId}::text, '0')::int + 1)::text::jsonb
    )
    WHERE code = ${upperCode}
      AND "expiresAt" > NOW()
  `;

  if (result === 0) return null;

  const updated = await prisma.guestSession.findUnique({
    where: { code: upperCode },
    select: { votes: true },
  });

  return (updated?.votes ?? {}) as Record<string, number>;
}

export async function getSessionVotes(userId: string, sessionId: string) {
  try {
    const uid = await resolveServerUserId(userId);
    const session = await prisma.guestSession.findFirst({
      where: { id: sessionId, userId: uid },
    });

    if (!session) return null;
    return (session.votes ?? {}) as Record<string, number>;
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to get session votes");
  }
}

export async function getUserGuestSessions(userId?: string) {
  try {
    const uid = await resolveServerUserId(userId);
    return await prisma.guestSession.findMany({
      where: { userId: uid },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to get guest sessions");
  }
}

export async function deleteGuestSession(userId: string, sessionId: string) {
  try {
    const uid = await resolveServerUserId(userId);
    return await prisma.guestSession.deleteMany({
      where: { id: sessionId, userId: uid },
    });
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to delete guest session");
  }
}
