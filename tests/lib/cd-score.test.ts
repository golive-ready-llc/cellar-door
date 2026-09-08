import { describe, it, expect } from "vitest";
import { effectiveCdScore, aiRatingsToBaseline, communityWineKey } from "@/lib/cd-score";

/**
 * Pure-function tests for the Bayesian CD score helpers.
 *
 * effectiveCdScore = (cdScoreSum + baseline*weight) / (count + weight)
 *
 * Edge cases worth pinning down:
 *   - count=0 with no baseline → null
 *   - count=0 with baseline   → returns the baseline exactly
 *   - negative / NaN weight   → guarded to 0 (baseline ignored)
 *   - very large count        → baseline influence approaches 0 (asymptote)
 */

describe("effectiveCdScore", () => {
  it("returns null when count=0 and there is no baseline", () => {
    expect(
      effectiveCdScore({
        aiBaselineScore: null,
        aiBaselineWeight: 5,
        cdScoreSum: 0,
        cdRatingCount: 0,
      })
    ).toBeNull();
  });

  it("returns the baseline when count=0 and a baseline exists", () => {
    expect(
      effectiveCdScore({
        aiBaselineScore: 3.5,
        aiBaselineWeight: 5,
        cdScoreSum: 0,
        cdRatingCount: 0,
      })
    ).toBe(3.5);
  });

  it("computes the standard Bayesian formula for typical inputs", () => {
    // (8 + 3.0*5) / (2 + 5) = 23/7 ≈ 3.2857
    const v = effectiveCdScore({
      aiBaselineScore: 3.0,
      aiBaselineWeight: 5,
      cdScoreSum: 8, // 2 ratings averaging 4.0
      cdRatingCount: 2,
    });
    expect(v).toBeCloseTo(23 / 7, 6);
  });

  it("ignores the baseline when weight is negative (guarded to 0)", () => {
    // negative weight → ignored, so it should equal the simple average
    expect(
      effectiveCdScore({
        aiBaselineScore: 3.0,
        aiBaselineWeight: -10,
        cdScoreSum: 8,
        cdRatingCount: 2,
      })
    ).toBe(4); // 8/2
  });

  it("returns null when negative weight + no real ratings (no fallback baseline)", () => {
    expect(
      effectiveCdScore({
        aiBaselineScore: 3.0,
        aiBaselineWeight: -10,
        cdScoreSum: 0,
        cdRatingCount: 0,
      })
    ).toBeNull();
  });

  it("ignores the baseline when weight is NaN (guarded to 0)", () => {
    expect(
      effectiveCdScore({
        aiBaselineScore: 4.0,
        aiBaselineWeight: Number.NaN,
        cdScoreSum: 6,
        cdRatingCount: 3,
      })
    ).toBe(2); // 6/3
  });

  it("ignores the baseline when weight is 0", () => {
    expect(
      effectiveCdScore({
        aiBaselineScore: 4.0,
        aiBaselineWeight: 0,
        cdScoreSum: 9,
        cdRatingCount: 3,
      })
    ).toBe(3);
  });

  it("ignores a non-finite baseline (Infinity) and falls back to user mean", () => {
    expect(
      effectiveCdScore({
        aiBaselineScore: Number.POSITIVE_INFINITY,
        aiBaselineWeight: 5,
        cdScoreSum: 8,
        cdRatingCount: 2,
      })
    ).toBe(4);
  });

  it("baseline influence asymptotes toward 0 as count grows large", () => {
    const baseline = 1.0; // far from the user mean to make any leak obvious
    const userMean = 5.0;
    const weight = 5;
    const count = 100_000;
    const v = effectiveCdScore({
      aiBaselineScore: baseline,
      aiBaselineWeight: weight,
      cdScoreSum: userMean * count,
      cdRatingCount: count,
    })!;
    // With weight=5 and count=100k, the prior should drift the result by
    // less than 0.001 below the true user mean of 5.0.
    expect(v).toBeGreaterThan(userMean - 0.001);
    expect(v).toBeLessThanOrEqual(userMean);
  });
});

describe("aiRatingsToBaseline", () => {
  it("returns null when aiRatings is null/undefined", () => {
    expect(aiRatingsToBaseline(null)).toBeNull();
    expect(aiRatingsToBaseline(undefined)).toBeNull();
  });

  it("returns null when no critic produced a positive score", () => {
    expect(aiRatingsToBaseline({ rating_ws: 0, rating_rp: undefined })).toBeNull();
  });

  it("maps a 96-point average to ≈4.0 on the 5-scale", () => {
    expect(aiRatingsToBaseline({ rating_ws: 96 })).toBeCloseTo(4.0, 6);
  });

  it("clamps very high scores to 5", () => {
    expect(aiRatingsToBaseline({ rating_ws: 200 })).toBe(5);
  });
});

describe("communityWineKey", () => {
  it("normalizes case and whitespace to a canonical key", () => {
    expect(communityWineKey("  Foo  ", "BAR Winery", 2020)).toBe(
      "bar winery|foo|2020"
    );
  });

  it("treats null vintage as empty string in the key", () => {
    expect(communityWineKey("Foo", "Bar", null)).toBe("bar|foo|");
  });
});
