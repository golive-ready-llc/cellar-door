import type { AiRatings } from "@/types/wine";

/**
 * Canonical lookup key for a community wine. Lowercased + trimmed so
 * capitalization or stray whitespace doesn't fork canonical wines.
 * Server-side and batch-fetch helpers must agree on this format.
 */
export function communityWineKey(
  name: string,
  winery: string,
  vintage: number | null
): string {
  const w = (winery || "").trim().toLowerCase();
  const n = (name || "").trim().toLowerCase();
  return `${w}|${n}|${vintage ?? ""}`;
}

/**
 * Convert an AI-estimated 100-point critic score to the 0-5 CD scale.
 * Mapping: 80=2.0, 88=3.0, 96=4.0, 100=4.5, 75=1.375.
 * Wines below 75 are clamped to 0; above 100 clamped to 5.
 * The 80-pt floor reflects that critics rarely score below 80 for sellable
 * wine — using a linear stretch would crowd realistic scores into 3.5-5.
 */
function criticTo5Scale(score100: number): number {
  const v = 2 + (score100 - 80) / 8;
  return Math.max(0, Math.min(5, v));
}

/**
 * Average the available AI-estimated critic scores (WS / RP / JD / AG)
 * and convert to the 0-5 CD scale. Returns null when no critics scored
 * the wine (so the caller can leave aiBaselineScore null and skip the prior).
 */
export function aiRatingsToBaseline(
  aiRatings: AiRatings | null | undefined
): number | null {
  if (!aiRatings) return null;
  const scores = [
    aiRatings.rating_ws,
    aiRatings.rating_rp,
    aiRatings.rating_jd,
    aiRatings.rating_ag,
  ].filter((s): s is number => typeof s === "number" && s > 0);
  if (scores.length === 0) return null;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return criticTo5Scale(avg);
}

/**
 * Bayesian effective CD score combining the AI baseline (prior) with the
 * accumulated user-rating sum. The baseline behaves like `weight` synthetic
 * votes at the baseline value — it dominates when count=0 and fades out as
 * real ratings accumulate (≈equal influence at count=weight, minor past 50).
 */
export function effectiveCdScore(args: {
  aiBaselineScore: number | null;
  aiBaselineWeight: number;
  cdScoreSum: number;
  cdRatingCount: number;
}): number | null {
  const { aiBaselineScore, aiBaselineWeight, cdScoreSum, cdRatingCount } = args;
  // Defensive numeric guards: NaN slips past `> 0` as false (silently drops
  // the prior) and negative weights would either skew the average or, if
  // weight === -cdRatingCount, divide by zero and produce Infinity. Coerce
  // any non-finite or non-positive value to 0 so the baseline is simply
  // ignored in those cases.
  const w =
    Number.isFinite(aiBaselineWeight) && aiBaselineWeight > 0
      ? aiBaselineWeight
      : 0;
  const baseline =
    aiBaselineScore !== null && Number.isFinite(aiBaselineScore)
      ? aiBaselineScore
      : null;
  const hasBaseline = baseline !== null && w > 0;
  if (!hasBaseline && cdRatingCount === 0) return null;
  if (!hasBaseline) return cdScoreSum / cdRatingCount;
  const num = cdScoreSum + baseline * w;
  const den = cdRatingCount + w;
  return num / den;
}
