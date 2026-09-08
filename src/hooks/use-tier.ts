"use client";

import { useAuth } from "@/components/auth-provider";
import { useAiToggle } from "@/hooks/use-ai-toggle";
import {
  getTierConfig,
  getTierDisplayName,
  hasFeature,
  canAddWine,
  getUpgradeTier,
  type Tier,
  type TierConfig,
  type TierFeatures,
} from "@/lib/tier";

export interface UseTierReturn {
  /** Current tier enum value */
  tier: Tier;
  /** Full config for current tier */
  config: TierConfig;
  /** Display name (e.g., "Cellar+") */
  displayName: string;
  /** Prisma user ID for passing to server actions */
  userId: string | null;
  /** Check if a specific feature is available for this tier (static flag
   * — does NOT respect the user's AI toggle). Use this when you need to
   * know "is this a paid feature?" independent of the user's runtime
   * preference, e.g., showing an upgrade prompt vs hiding the feature. */
  can: (feature: keyof TierFeatures) => boolean;
  /** Variant of `can` that ALSO respects the user's AI toggle: returns
   * false for any AI-gated feature when the toggle is off. Use this to
   * decide whether to RENDER an AI feature UI at all. */
  canUseAi: (feature: keyof TierFeatures) => boolean;
  /** Check if user can add another wine (needs current count) */
  canAddWine: (currentCount: number) => boolean;
  /** Whether user is on a paid tier */
  isPaid: boolean;
  /** The next tier to upgrade to, or null if at max */
  upgradeTier: Tier | null;
  /** Whether AI features should be shown. Combines tier AI access AND
   * the user's runtime AI toggle — when either is off, this is false
   * and AI UI should be hidden everywhere. */
  hasAI: boolean;
  /** Tier-level AI access only (ignores the toggle). Use this when you
   * need to decide whether a user COULD use AI (e.g., for showing an
   * upgrade prompt) vs whether the AI UI should currently render. */
  tierHasAI: boolean;
  /** Raw user toggle state, useful for rendering the toggle itself. */
  aiUserEnabled: boolean;
}

// AI-related TierFeatures flags. When the user toggles AI off, these
// all return false from canUseAi / hasAI even if the tier technically
// allows them. Non-AI features (maxWines, apiAccess, etc.) are unaffected.
const AI_FEATURE_FLAGS: ReadonlyArray<keyof TierFeatures> = [
  "aiEnabled",
  "labelScanning",
  "wineEnrichment",
  "recommendations",
  "bulkEnrich",
  "cellarChat",
  "barcodeAiLookup",
  "aiFindImage",
] as const;

export function useTier(): UseTierReturn {
  const { tier, userId } = useAuth();
  const { aiUserEnabled } = useAiToggle();
  const config = getTierConfig(tier);
  const tierHasAI = config.features.aiEnabled;

  const isAiFeature = (f: keyof TierFeatures) => AI_FEATURE_FLAGS.includes(f);

  return {
    tier,
    config,
    displayName: getTierDisplayName(tier),
    userId,
    can: (feature) => hasFeature(tier, feature),
    canUseAi: (feature) => {
      if (isAiFeature(feature) && !aiUserEnabled) return false;
      return hasFeature(tier, feature);
    },
    canAddWine: (currentCount) => canAddWine(tier, currentCount),
    isPaid: tier !== "FREE",
    upgradeTier: getUpgradeTier(tier),
    hasAI: tierHasAI && aiUserEnabled,
    tierHasAI,
    aiUserEnabled,
  };
}
