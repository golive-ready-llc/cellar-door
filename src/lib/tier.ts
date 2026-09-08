/**
 * Tier configuration — single source of truth for feature gating.
 *
 * No "use client" or "use server" directive so it can be imported
 * from both server actions and client components.
 */

// ─── Tier Enum (mirrors Prisma schema) ────────────────────────

export type Tier = "FREE" | "PRO" | "PREMIUM";

// ─── Display Names ────────────────────────────────────────────

export const TIER_DISPLAY_NAMES: Record<Tier, string> = {
  FREE: "Free",
  PRO: "Cellar+",
  PREMIUM: "Cellar Pro",
};

// ─── AI Operations & Credit Costs ─────────────────────────────

export type AiOperation =
  | "auto_fill"
  | "enrich_text"
  | "label_scan"
  | "chat"
  | "find_image"
  | "batch_enrich_text"
  | "batch_enrich_image";

export const AI_CREDIT_COSTS: Record<AiOperation, number> = {
  auto_fill: 1,
  enrich_text: 1,
  label_scan: 2,
  chat: 1,
  find_image: 5,
  batch_enrich_text: 1,
  batch_enrich_image: 6,
};

/** Max wines per batch enrich run */
export const BATCH_ENRICH_MAX = 200;

// ─── Feature Flags ────────────────────────────────────────────

export interface TierFeatures {
  maxWines: number | null; // null = unlimited
  aiEnabled: boolean;
  aiCreditsPerMonth: number; // 0 = no AI
  apiAccess: boolean;
  adFree: boolean;
  // Specific AI feature flags
  labelScanning: boolean;
  wineEnrichment: boolean;
  recommendations: boolean;
  bulkEnrich: boolean;
  cellarChat: boolean;
  barcodeAiLookup: boolean;
  aiFindImage: boolean; // Google Search grounding — expensive
  haSensors: boolean; // Home Assistant sensor integration
  sommelierMode: boolean; // Guest session QR code voting
  valueTracker: boolean; // Portfolio-style value tracking
}

// ─── Pricing ──────────────────────────────────────────────────

export interface TierPricing {
  monthly: number | null; // null = free
  annual: number | null; // null = no annual option
}

// ─── Tier Config ──────────────────────────────────────────────

export interface TierConfig {
  tier: Tier;
  displayName: string;
  tagline: string;
  description: string;
  pricing: TierPricing;
  /** @deprecated Use pricing.monthly instead */
  price: number | null;
  trialDays: number | null; // null = no trial
  features: TierFeatures;
}

export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  FREE: {
    tier: "FREE",
    displayName: "Free",
    tagline: "Get started",
    description: "Basic wine management with ad support",
    pricing: { monthly: null, annual: null },
    price: null,
    trialDays: null,
    features: {
      // Unlimited tracking on FREE (2026-08-01): matches InVintory's free
      // tier — bottle-count caps stopped being the upgrade lever; AI is.
      maxWines: null,
      aiEnabled: false,
      aiCreditsPerMonth: 0,
      apiAccess: false,
      adFree: false,
      labelScanning: false,
      wineEnrichment: false,
      recommendations: false,
      bulkEnrich: false,
      cellarChat: false,
      barcodeAiLookup: false,
      aiFindImage: false,
      haSensors: false,
      sommelierMode: false,
      valueTracker: false,
    },
  },
  PRO: {
    tier: "PRO",
    displayName: "Cellar+",
    tagline: "Most popular",
    description: "AI-powered wine management for the serious collector",
    pricing: { monthly: 9.99, annual: 99.99 },
    price: 9.99,
    trialDays: 14,
    features: {
      maxWines: null,
      aiEnabled: true,
      aiCreditsPerMonth: 300,
      apiAccess: false,
      adFree: true,
      labelScanning: true,
      wineEnrichment: true,
      recommendations: true,
      bulkEnrich: false, // PREMIUM only
      cellarChat: true,
      barcodeAiLookup: true,
      // Opened to Cellar+ (2026-08-02): image search uses expensive grounding
      // but is credit-metered, so the monthly cap self-limits the spend.
      aiFindImage: true,
      haSensors: false,
      sommelierMode: true,
      valueTracker: false, // PREMIUM only
    },
  },
  PREMIUM: {
    tier: "PREMIUM",
    displayName: "Cellar Pro",
    tagline: "Power user",
    description: "Everything in Cellar+ plus batch AI, image search, and API",
    // $13.99/$139.99 (2026-08-01): priced under InVintory Premium
    // ($14.95/mo, $149.99/yr) on both axes.
    pricing: { monthly: 13.99, annual: 139.99 },
    price: 13.99,
    trialDays: 14,
    features: {
      maxWines: null,
      aiEnabled: true,
      aiCreditsPerMonth: 1000,
      apiAccess: true,
      adFree: true,
      labelScanning: true,
      wineEnrichment: true,
      recommendations: true,
      bulkEnrich: true,
      cellarChat: true,
      barcodeAiLookup: true,
      aiFindImage: true,
      haSensors: true,
      sommelierMode: true,
      valueTracker: true,
    },
  },
};

// ─── Feature Bullets (for pricing cards) ──────────────────────

export const TIER_FEATURE_BULLETS: Record<Tier, string[]> = {
  FREE: [
    "Unlimited wines",
    "Manual wine entry",
    "Visual cellar grid",
    "Wine history tracking",
    "Community CD Scores",
  ],
  PRO: [
    "Unlimited wines",
    "300 AI credits / month",
    "AI label scanning",
    "AI wine enrichment",
    "AI sommelier chat",
    "AI label image search",
    "Ad-free experience",
  ],
  PREMIUM: [
    "Everything in Cellar+",
    "1,000 AI credits / month",
    "Unlimited wines",
    "Batch AI enrichment",
    "REST API access",
    "Home Assistant sensors",
    "Priority support",
  ],
};

// ─── Helpers ──────────────────────────────────────────────────

export function getTierConfig(tier: Tier): TierConfig {
  return TIER_CONFIGS[tier];
}

export function getTierDisplayName(tier: Tier): string {
  return TIER_DISPLAY_NAMES[tier];
}

/** Check if a specific feature is available for a tier */
export function hasFeature(tier: Tier, feature: keyof TierFeatures): boolean {
  const val = TIER_CONFIGS[tier].features[feature];
  if (val === null) return true; // null = unlimited
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val > 0;
  return val !== null; // null means unlimited → true
}

/** Check if user can add more wines */
export function canAddWine(tier: Tier, currentCount: number): boolean {
  const max = TIER_CONFIGS[tier].features.maxWines;
  if (max === null) return true;
  return currentCount < max;
}

/** Get the next upgrade tier, or null if already at max */
export function getUpgradeTier(currentTier: Tier): Tier | null {
  if (currentTier === "FREE") return "PRO";
  if (currentTier === "PRO") return "PREMIUM";
  return null;
}

/** Ordered tiers for display in pricing cards */
export const TIER_ORDER: Tier[] = ["FREE", "PRO", "PREMIUM"];

// ─── One-time credit top-ups ──────────────────────────────────

/**
 * Purchasable AI credit packs. Sold as one-time Stripe Payments
 * (not subscriptions). Consumed after the monthly allowance is exhausted.
 * Never expire. Priced well above real Gemini token cost (~$0.003/credit)
 * so margins stay healthy even under heavy bulk-enrich use.
 */
export interface CreditPack {
  id: "pack-100" | "pack-500";
  credits: number;
  priceUsd: number;
  /** Server-side Stripe Price ID env var name — set per environment. */
  envVar: "STRIPE_PRICE_CREDITS_100" | "STRIPE_PRICE_CREDITS_500";
  label: string;
  /** Marketing blurb shown alongside the price. */
  perCreditLabel: string;
  highlight?: boolean;
}

export const CREDIT_PACKS: readonly CreditPack[] = [
  {
    id: "pack-100",
    credits: 100,
    priceUsd: 1.49,
    envVar: "STRIPE_PRICE_CREDITS_100",
    label: "100 credits",
    perCreditLabel: "$0.015/credit",
  },
  {
    id: "pack-500",
    credits: 500,
    priceUsd: 4.99,
    envVar: "STRIPE_PRICE_CREDITS_500",
    label: "500 credits",
    perCreditLabel: "$0.010/credit · best value",
    highlight: true,
  },
] as const;
