/**
 * Writes to the shared CommunityWine table — the AI baseline that anchors
 * every user's CD score.
 *
 * Deliberately NOT a "use server" module. Every export of a "use server" file
 * is a publicly callable endpoint, and the baseline is first-scan-wins shared
 * state: an open seeder would let anyone plant fake critic scores into the
 * community dataset and spam the table. Only server code that produced the
 * ratings itself (wine create / AI enrich / expert-score) may call this.
 */
import { prisma } from "@/lib/db";
import { aiRatingsToBaseline, effectiveCdScore } from "@/lib/cd-score";
import type { AiRatings } from "@/types/wine";

const isDev = !process.env.DATABASE_URL || process.env.DATABASE_URL === "";

/**
 * Normalize a (winery, name, vintage) triple to the form used by the
 * `@@unique([winery, name, vintage])` constraint on CommunityWine.
 * Lowercased + trimmed so capitalization or stray whitespace doesn't
 * fork canonical wines.
 */
export function canonKey(name: string, winery: string, vintage: number | null) {
  return {
    name: (name || "").trim().toLowerCase(),
    winery: (winery || "").trim().toLowerCase(),
    vintage: vintage ?? null,
  };
}

/**
 * Seed (or refresh) the AI baseline on the canonical CommunityWine row
 * for a wine that has aiRatings. Called from the wine create / AI-enrich
 * paths so that scanned wines get an immediate baseline CD score even
 * before any user has rated them.
 *
 * Behavior:
 *  - Creates the CommunityWine row if missing.
 *  - Sets aiBaselineScore on first sighting (does NOT overwrite an existing
 *    baseline — first scan wins; later scans by other users for the same
 *    wine don't repeatedly re-anchor the prior).
 *  - Recomputes the effective cdScore field.
 */
export async function seedCommunityBaseline(args: {
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  country: string;
  aiRatings: AiRatings | null;
}): Promise<void> {
  if (isDev) return; // mock store handles its own state

  const baseline = aiRatingsToBaseline(args.aiRatings);
  if (baseline === null) return; // nothing to seed

  const key = canonKey(args.name, args.winery, args.vintage);

  // findFirst (not findUnique) so NV wines (vintage=null) match correctly.
  const existing = await prisma.communityWine.findFirst({
    where: { winery: key.winery, name: key.name, vintage: key.vintage },
    select: {
      id: true,
      aiBaselineScore: true,
      aiBaselineWeight: true,
      cdScoreSum: true,
      cdRatingCount: true,
    },
  });

  if (!existing) {
    const score = effectiveCdScore({
      aiBaselineScore: baseline,
      aiBaselineWeight: 5,
      cdScoreSum: 0,
      cdRatingCount: 0,
    });
    await prisma.communityWine.create({
      data: {
        ...key,
        type: (args.type || "red").toLowerCase(),
        region: args.region || "",
        country: args.country || "",
        aiBaselineScore: baseline,
        cdScore: score,
      },
    });
    return;
  }

  // First-scan-wins: don't churn the prior on later sightings.
  if (existing.aiBaselineScore !== null) return;

  const score = effectiveCdScore({
    aiBaselineScore: baseline,
    aiBaselineWeight: existing.aiBaselineWeight,
    cdScoreSum: existing.cdScoreSum,
    cdRatingCount: existing.cdRatingCount,
  });
  await prisma.communityWine.update({
    where: { id: existing.id },
    data: { aiBaselineScore: baseline, cdScore: score },
  });
}
