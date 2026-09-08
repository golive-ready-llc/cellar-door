/**
 * One-shot: walk every Wine row that has aiRatings, derive a baseline
 * CD score, and seed/refresh the canonical CommunityWine row.
 *
 * Run with:
 *   npx tsx --env-file=.env.production.local scripts/backfill-cd-baselines.ts
 *
 * Why --env-file: the Prisma client reads DATABASE_URL at module-init,
 * and ES module imports are hoisted ABOVE any in-script dotenv calls,
 * so loading env from inside this file is too late. tsx's --env-file
 * loads variables before the script's imports run.
 *
 * Idempotent — first-scan-wins logic, safe to re-run.
 */
import { prisma } from "@/lib/db";
import { aiRatingsToBaseline, effectiveCdScore } from "@/lib/cd-score";
import type { AiRatings } from "@/types/wine";

if (!process.env.DATABASE_URL) {
  console.error(
    "[backfill] DATABASE_URL not set. Run with:\n" +
      "  npx tsx --env-file=.env.production.local scripts/backfill-cd-baselines.ts"
  );
  process.exit(1);
}

async function main() {
  // Walk in batches to keep memory bounded on large cellars
  const BATCH = 500;
  let cursor: string | undefined;
  let scanned = 0;
  let seeded = 0;
  let updated = 0;

  // Track unique canonical keys we've already processed in this run
  // (multiple bottles of the same wine map to the same CommunityWine row)
  const seen = new Set<string>();

  while (true) {
    const wines = await prisma.wine.findMany({
      where: { aiRatings: { not: { equals: null } } },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        name: true,
        winery: true,
        vintage: true,
        type: true,
        region: true,
        country: true,
        aiRatings: true,
      },
    });
    if (wines.length === 0) break;
    cursor = wines[wines.length - 1].id;
    scanned += wines.length;

    for (const w of wines) {
      const key = `${w.winery.toLowerCase().trim()}|${w.name
        .toLowerCase()
        .trim()}|${w.vintage ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const baseline = aiRatingsToBaseline(w.aiRatings as AiRatings | null);
      if (baseline === null) continue;

      // findFirst (not findUnique) — Prisma's compound-unique findUnique
      // rejects null components, but NV wines legitimately have vintage=null.
      const existing = await prisma.communityWine.findFirst({
        where: {
          winery: w.winery.toLowerCase().trim(),
          name: w.name.toLowerCase().trim(),
          vintage: w.vintage,
        },
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
            winery: w.winery.toLowerCase().trim(),
            name: w.name.toLowerCase().trim(),
            vintage: w.vintage,
            type: (w.type || "red").toLowerCase(),
            region: w.region || "",
            country: w.country || "",
            aiBaselineScore: baseline,
            cdScore: score,
          },
        });
        seeded++;
      } else if (existing.aiBaselineScore === null) {
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
        updated++;
      }
    }

    process.stdout.write(
      `Scanned ${scanned} wines, seeded ${seeded}, updated ${updated} so far...\n`
    );
  }

  console.log(
    `\nDone. Scanned ${scanned} wines (${seen.size} unique canonical), ` +
      `seeded ${seeded} new CommunityWine rows, ` +
      `refreshed baseline on ${updated} existing rows.`
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
