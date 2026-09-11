"use server";

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { mockStore } from "@/lib/mock-store";
import { resolveServerUserId } from "@/server/auth-guard";
import { communityWineKey, effectiveCdScore } from "@/lib/cd-score";
import { canonKey } from "@/server/community-baseline-store";
import type { CommunityRating } from "@/types/wine";

const isDev = !process.env.DATABASE_URL || process.env.DATABASE_URL === "";

interface CommunityScoreResult {
  cdScore: number | null;
  cdRatingCount: number;
}

/**
 * Get the community (CD) score for a wine. Effective score = Bayesian
 * blend of AI baseline (prior) + accumulated user ratings.
 */
export async function getCommunityScore(
  name: string,
  winery: string,
  vintage: number | null
): Promise<CommunityScoreResult | null> {
  if (isDev) {
    return mockStore.getCommunityScore(name, winery, vintage);
  }

  const key = canonKey(name, winery, vintage);
  // Use findFirst with explicit equality — Prisma's compound-unique
  // findUnique rejects null components, but non-vintage wines (NV
  // champagne, sherry, madeira) legitimately have vintage=null.
  const cw = await prisma.communityWine.findFirst({
    where: { winery: key.winery, name: key.name, vintage: key.vintage },
    select: {
      aiBaselineScore: true,
      aiBaselineWeight: true,
      cdScoreSum: true,
      cdRatingCount: true,
    },
  });
  if (!cw) return null;

  const score = effectiveCdScore({
    aiBaselineScore: cw.aiBaselineScore,
    aiBaselineWeight: cw.aiBaselineWeight,
    cdScoreSum: cw.cdScoreSum,
    cdRatingCount: cw.cdRatingCount,
  });
  return { cdScore: score, cdRatingCount: cw.cdRatingCount };
}

/**
 * Submit a community rating. Upserts the user's rating, recomputes
 * aggregates from scratch (cheap — bounded by per-wine rating count)
 * and persists the new effective cdScore back to the row so cheap
 * fetches stay accurate.
 */
export async function submitCommunityRating(
  name: string,
  winery: string,
  vintage: number | null,
  type: string,
  region: string,
  country: string,
  rating: number,
  review: string = "",
  clientUserId?: string | null
): Promise<CommunityScoreResult> {
  // Validate before touching the shared community dataset: ratings are 0-5
  // stars and every text field is bounded.
  if (typeof rating !== "number" || !Number.isFinite(rating) || rating <= 0 || rating > 5) {
    throw new Error("Rating must be greater than 0 and at most 5");
  }
  if (typeof review !== "string" || review.length > 2000) {
    throw new Error("Review is too long (2,000 characters max)");
  }
  if (
    !name?.trim() ||
    [name, winery, type, region, country].some((v) => typeof v === "string" && v.length > 300)
  ) {
    throw new Error("Invalid wine details");
  }
  if (isDev) {
    const userId = mockStore.getDevUserId();
    return mockStore.submitCommunityRating(
      userId,
      name,
      winery,
      vintage,
      rating,
      review
    );
  }

  const userId = await resolveServerUserId(clientUserId);
  const key = canonKey(name, winery, vintage);

  // Ensure the CommunityWine row exists. We can't use upsert here because
  // Prisma's compound-unique upsert rejects null components, and NV wines
  // legitimately have vintage=null. Manual find-or-create keeps it safe.
  // Wrapped in try/catch for P2002 (unique constraint) to handle concurrent
  // creation races: two requests both see findFirst returning null, then one
  // succeeds while the other hits the unique constraint.
  let cw = await prisma.communityWine.findFirst({
    where: { winery: key.winery, name: key.name, vintage: key.vintage },
    select: { id: true, aiBaselineScore: true, aiBaselineWeight: true },
  });
  if (!cw) {
    try {
      cw = await prisma.communityWine.create({
        data: {
          ...key,
          type: (type || "red").toLowerCase(),
          region: region || "",
          country: country || "",
        },
        select: { id: true, aiBaselineScore: true, aiBaselineWeight: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // Race: another request created it first — fetch the existing row
        cw = await prisma.communityWine.findFirst({
          where: { winery: key.winery, name: key.name, vintage: key.vintage },
          select: { id: true, aiBaselineScore: true, aiBaselineWeight: true },
        });
        if (!cw) throw new Error("Failed to find or create community wine after unique constraint violation");
      } else {
        throw err;
      }
    }
  }

  await prisma.communityRating.upsert({
    where: {
      userId_communityWineId: { userId, communityWineId: cw.id },
    },
    create: {
      userId,
      communityWineId: cw.id,
      rating,
      review,
    },
    update: { rating, review },
  });

  // Recompute aggregates from the canonical ratings table — keeps
  // cdScoreSum + cdRatingCount accurate even after edits/deletes.
  const agg = await prisma.communityRating.aggregate({
    where: { communityWineId: cw.id },
    _sum: { rating: true },
    _count: { _all: true },
  });
  const cdScoreSum = agg._sum.rating ?? 0;
  const cdRatingCount = agg._count._all;
  const score = effectiveCdScore({
    aiBaselineScore: cw.aiBaselineScore,
    aiBaselineWeight: cw.aiBaselineWeight,
    cdScoreSum,
    cdRatingCount,
  });

  await prisma.communityWine.update({
    where: { id: cw.id },
    data: { cdScoreSum, cdRatingCount, cdScore: score },
  });

  return { cdScore: score, cdRatingCount };
}

/**
 * Get individual community ratings for a wine.
 */
export async function getCommunityRatings(
  name: string,
  winery: string,
  vintage: number | null
): Promise<CommunityRating[]> {
  if (isDev) {
    return mockStore.getCommunityRatings(name, winery, vintage);
  }

  const key = canonKey(name, winery, vintage);
  // findFirst (not findUnique) — handles null vintage for NV wines.
  const cw = await prisma.communityWine.findFirst({
    where: { winery: key.winery, name: key.name, vintage: key.vintage },
    select: { id: true },
  });
  if (!cw) return [];

  const rows = await prisma.communityRating.findMany({
    where: { communityWineId: cw.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    // Public read: select only the reviewer's chosen display name. Never return
    // internal user ids or anything derived from an email address.
    include: {
      user: { select: { displayName: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    username: r.user.displayName?.trim() || "Anonymous",
    rating: r.rating,
    review: r.review,
    tastingNotes: null,
    createdAt: r.createdAt.toISOString(),
  }));
}

// Baseline WRITES live in src/server/community-baseline-store.ts, not here.
// Every export of a "use server" file is a public endpoint, and an open
// seeder would let anyone plant fake critic scores in the shared CD
// dataset — same reasoning as the wine-metadata store split.

/**
 * Batch-fetch CD scores for a set of wines (by canonical key). Used by
 * inventory/cellar reads to populate `wine.cdScore` without N+1 queries.
 */
export async function getCommunityScoresBatch(
  wines: Array<{ name: string; winery: string; vintage: number | null }>
): Promise<Map<string, CommunityScoreResult>> {
  const result = new Map<string, CommunityScoreResult>();
  if (isDev || wines.length === 0) return result;

  const keys = wines.map((w) => canonKey(w.name, w.winery, w.vintage));

  // For small collections, use a single OR query (efficient with the correct index).
  // For large collections, chunk into individual findFirst queries that leverage
  // the @@unique index on (winery, name, vintage) more efficiently than a massive OR.
  const CHUNK_SIZE = 50;
  if (keys.length <= CHUNK_SIZE) {
    const rows = await prisma.communityWine.findMany({
      where: { OR: keys },
      select: {
        name: true,
        winery: true,
        vintage: true,
        aiBaselineScore: true,
        aiBaselineWeight: true,
        cdScoreSum: true,
        cdRatingCount: true,
      },
    });

    for (const row of rows) {
      const k = communityWineKey(row.name, row.winery, row.vintage);
      const score = effectiveCdScore({
        aiBaselineScore: row.aiBaselineScore,
        aiBaselineWeight: row.aiBaselineWeight,
        cdScoreSum: row.cdScoreSum,
        cdRatingCount: row.cdRatingCount,
      });
      result.set(k, { cdScore: score, cdRatingCount: row.cdRatingCount });
    }
  } else {
    // Chunk into groups of CHUNK_SIZE and query in parallel
    const chunks: typeof keys[] = [];
    for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
      chunks.push(keys.slice(i, i + CHUNK_SIZE));
    }

    const chunkResults = await Promise.all(
      chunks.map((chunk) =>
        prisma.communityWine.findMany({
          where: { OR: chunk },
          select: {
            name: true,
            winery: true,
            vintage: true,
            aiBaselineScore: true,
            aiBaselineWeight: true,
            cdScoreSum: true,
            cdRatingCount: true,
          },
        })
      )
    );

    for (const rows of chunkResults) {
      for (const row of rows) {
        const k = communityWineKey(row.name, row.winery, row.vintage);
        const score = effectiveCdScore({
          aiBaselineScore: row.aiBaselineScore,
          aiBaselineWeight: row.aiBaselineWeight,
          cdScoreSum: row.cdScoreSum,
          cdRatingCount: row.cdRatingCount,
        });
        result.set(k, { cdScore: score, cdRatingCount: row.cdRatingCount });
      }
    }
  }

  return result;
}

