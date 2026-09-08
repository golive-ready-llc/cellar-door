// Background critic-score population for the Expert Score feature.
// Not a server action — internal server module (like tier-check / auth-guard)
// invoked from addWine via next/server's after() so wine creation never
// blocks on an AI call.

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getAIProvider, isAIAvailable } from "@/lib/ai";
import { aiRatingsToBaseline } from "@/lib/cd-score";
import { requireFeature, reserveAiCredits, TierError } from "@/server/tier-check";
import type { AiRatings, WineType } from "@/types/wine";

export interface ExpertRatingsTarget {
  wineId: string;
  userId: string;
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  country: string;
  grapeVariety: string;
}

/**
 * Fetch AI-estimated public critic scores for a freshly added wine and store
 * them on every bottle of that wine (same name+winery+vintage), seed the
 * community baseline, and cache the result in WineMetadata so the next add
 * of the same wine is free.
 *
 * Silently skips (by design, not error suppression) when:
 * - the user's tier has no AI enrichment, or their credits are exhausted —
 *   the wine simply stays without an Expert Score until they enrich manually;
 * - no real AI provider is configured (the mock would fabricate scores).
 *
 * Real AI/DB failures refund the reserved credit and are reported to Sentry.
 */
export async function fetchAndStoreExpertRatings(
  target: ExpertRatingsTarget
): Promise<void> {
  try {
    await requireFeature(target.userId, "wineEnrichment");
  } catch (err) {
    if (err instanceof TierError) return; // FREE tier — expected, skip quietly
    throw err;
  }

  // Never store fabricated mock scores as if they were real critic data.
  if (!(await isAIAvailable())) return;

  const reservation = await reserveAiCredits(target.userId, "enrich_text", 1);
  if (!reservation.ok) return; // credits exhausted — expected, skip quietly

  try {
    const provider = await getAIProvider();
    const result = await provider.estimateCriticScores({
      name: target.name,
      winery: target.winery,
      vintage: target.vintage,
      type: target.type as WineType,
      region: target.region,
      country: target.country,
      grapeVariety: target.grapeVariety,
    });

    const ratings: AiRatings | null = result.ratings ?? null;
    // No critic has scored this wine — nothing to store. Leaving aiRatings
    // null (rather than an all-null object) keeps the wine eligible for a
    // future retry via manual enrichment.
    if (aiRatingsToBaseline(ratings) === null) return;

    // Store on every bottle of this wine the user owns — same identity match
    // the duplicate-propagation path in updateWine uses.
    await prisma.wine.updateMany({
      where: {
        userId: target.userId,
        name: { equals: target.name, mode: "insensitive" },
        winery: { equals: target.winery, mode: "insensitive" },
        vintage: target.vintage,
      },
      data: { aiRatings: ratings as object },
    });

    // Seed the community CD-Score baseline (idempotent, first-scan-wins) and
    // cache in WineMetadata so future adds of this wine skip the AI call.
    const { seedCommunityBaseline } = await import("./actions/community");
    void seedCommunityBaseline({
      name: target.name,
      winery: target.winery,
      vintage: target.vintage,
      type: target.type,
      region: target.region,
      country: target.country,
      aiRatings: ratings as AiRatings,
    }).catch(() => { /* best-effort baseline seeding */ });

    const { saveWineMetadata } = await import("./actions/wine-metadata");
    void saveWineMetadata({
      name: target.name,
      winery: target.winery,
      vintage: target.vintage,
      ratings,
    }).catch(() => { /* best-effort metadata caching */ });
  } catch (err) {
    await reservation.refundOnFailure().catch((refundErr) => {
      Sentry.captureException(refundErr);
    });
    // Background task — nothing upstream to propagate to, but the failure
    // must not be invisible.
    Sentry.captureException(err);
  }
}
