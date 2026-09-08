import { describe, it, expect } from "vitest";
import {
  getTierConfig,
  getTierDisplayName,
  hasFeature,
  canAddWine,
  getUpgradeTier,
  TIER_CONFIGS,
  AI_CREDIT_COSTS,
  CREDIT_PACKS,
  TIER_ORDER,
} from "@/lib/tier";

/**
 * Tests for `@/lib/tier`. The agent task asked for `getEffectiveTier`,
 * `canUseAi`, `getCreditCap`, and `getEffectivePrice` — those helpers
 * don't exist in this module (see report). The closest in-codebase
 * equivalents are exercised here:
 *
 *   - canUseAi   →  `useTier()` hook in src/hooks/use-tier.ts
 *                   (out of scope for pure-lib tests)
 *   - getCreditCap → TIER_CONFIGS[tier].features.aiCreditsPerMonth
 *   - getEffectivePrice → TIER_CONFIGS[tier].pricing.{monthly,annual}
 *   - getEffectiveTier / DEFAULT_TIER_FLOOR → no such export; floor logic
 *                   lives behind `getUserTier` (server) which is also
 *                   out of scope for a pure-lib test.
 */

describe("tier — config integrity", () => {
  it("TIER_ORDER lists FREE → PRO → PREMIUM in upgrade order", () => {
    expect(TIER_ORDER).toEqual(["FREE", "PRO", "PREMIUM"]);
  });

  it("FREE tier has no AI and unlimited wines (2026-08 pricing revamp)", () => {
    const cfg = getTierConfig("FREE");
    expect(cfg.features.aiEnabled).toBe(false);
    expect(cfg.features.maxWines).toBeNull();
    expect(cfg.features.aiCreditsPerMonth).toBe(0);
  });

  it("PRO tier enables AI (incl. image search since 2026-08) but excludes bulkEnrich/valueTracker", () => {
    const cfg = getTierConfig("PRO");
    expect(cfg.features.aiEnabled).toBe(true);
    expect(cfg.features.bulkEnrich).toBe(false);
    expect(cfg.features.aiFindImage).toBe(true);
    expect(cfg.features.valueTracker).toBe(false);
    expect(cfg.features.maxWines).toBeNull();
  });

  it("PREMIUM is priced under InVintory Premium ($14.95/mo, $149.99/yr)", () => {
    const cfg = getTierConfig("PREMIUM");
    expect(cfg.pricing.monthly).toBeLessThan(14.95);
    expect(cfg.pricing.annual).toBeLessThan(149.99);
  });

  it("PREMIUM tier unlocks every flag and removes the wine cap", () => {
    const cfg = getTierConfig("PREMIUM");
    expect(cfg.features.maxWines).toBeNull();
    expect(cfg.features.bulkEnrich).toBe(true);
    expect(cfg.features.aiFindImage).toBe(true);
    expect(cfg.features.apiAccess).toBe(true);
    expect(cfg.features.haSensors).toBe(true);
    expect(cfg.features.valueTracker).toBe(true);
  });
});

describe("hasFeature (tier × feature)", () => {
  it("FIXED: hasFeature('PREMIUM', 'maxWines') returns TRUE for unlimited (null) sentinel", () => {
    // Bug fix: hasFeature now treats null (the unlimited sentinel) as true.
    // Previously the fallback `val !== null` path returned false when val
    // was null, which incorrectly reported "no maxWines feature" for the
    // PREMIUM unlimited tier. Now an early-return at the top of hasFeature
    // catches null and returns true.
    expect(hasFeature("PREMIUM", "maxWines")).toBe(true);
  });

  it("returns true for positive numeric features (PRO has 300 AI credits)", () => {
    expect(hasFeature("PRO", "aiCreditsPerMonth")).toBe(true);
  });

  it("returns false for 0-credit AI on FREE tier", () => {
    expect(hasFeature("FREE", "aiCreditsPerMonth")).toBe(false);
  });

  it("returns the boolean flag verbatim for boolean features", () => {
    expect(hasFeature("PRO", "labelScanning")).toBe(true);
    expect(hasFeature("PRO", "bulkEnrich")).toBe(false);
    expect(hasFeature("PREMIUM", "apiAccess")).toBe(true);
    expect(hasFeature("FREE", "aiEnabled")).toBe(false);
  });
});

describe("canAddWine", () => {
  it("every tier is unlimited since the 2026-08 pricing revamp", () => {
    expect(canAddWine("FREE", 0)).toBe(true);
    expect(canAddWine("FREE", 1_000_000)).toBe(true);
    expect(canAddWine("PRO", 1_000_000)).toBe(true);
    expect(canAddWine("PREMIUM", 1_000_000)).toBe(true);
  });
});

describe("getUpgradeTier", () => {
  it("FREE → PRO", () => {
    expect(getUpgradeTier("FREE")).toBe("PRO");
  });
  it("PRO → PREMIUM", () => {
    expect(getUpgradeTier("PRO")).toBe("PREMIUM");
  });
  it("PREMIUM → null (already at top)", () => {
    expect(getUpgradeTier("PREMIUM")).toBeNull();
  });
});

describe("getTierDisplayName", () => {
  it("returns the marketing name for each tier", () => {
    expect(getTierDisplayName("FREE")).toBe("Free");
    expect(getTierDisplayName("PRO")).toBe("Cellar+");
    expect(getTierDisplayName("PREMIUM")).toBe("Cellar Pro");
  });
});

describe("AI_CREDIT_COSTS", () => {
  it("simple operations cost 1 credit", () => {
    expect(AI_CREDIT_COSTS.auto_fill).toBe(1);
    expect(AI_CREDIT_COSTS.enrich_text).toBe(1);
    expect(AI_CREDIT_COSTS.chat).toBe(1);
  });

  it("expensive ops (label_scan, find_image, batch_enrich_image) cost more", () => {
    expect(AI_CREDIT_COSTS.label_scan).toBe(2);
    expect(AI_CREDIT_COSTS.find_image).toBe(5);
    expect(AI_CREDIT_COSTS.batch_enrich_image).toBe(6);
  });
});

describe("CREDIT_PACKS pricing sanity", () => {
  it("the 500-pack has a lower per-credit price than the 100-pack", () => {
    const p100 = CREDIT_PACKS.find((p) => p.id === "pack-100")!;
    const p500 = CREDIT_PACKS.find((p) => p.id === "pack-500")!;
    expect(p500.priceUsd / p500.credits).toBeLessThan(p100.priceUsd / p100.credits);
  });

  it("each pack references a Stripe env-var name", () => {
    for (const pack of CREDIT_PACKS) {
      expect(pack.envVar).toMatch(/^STRIPE_PRICE_CREDITS_/);
    }
  });
});

describe("tier pricing (effective price proxy)", () => {
  it("FREE has null monthly/annual prices", () => {
    expect(TIER_CONFIGS.FREE.pricing).toEqual({ monthly: null, annual: null });
  });

  it("annual price is cheaper per-month than monthly × 12 for paid tiers", () => {
    for (const t of ["PRO", "PREMIUM"] as const) {
      const { monthly, annual } = TIER_CONFIGS[t].pricing;
      expect(monthly).not.toBeNull();
      expect(annual).not.toBeNull();
      expect(annual!).toBeLessThan(monthly! * 12);
    }
  });
});
