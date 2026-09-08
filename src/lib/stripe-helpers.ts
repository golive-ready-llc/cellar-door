import type { Tier } from "@/lib/tier";

export type BillingInterval = "monthly" | "annual";

/**
 * Maps Stripe price IDs to app tier enums.
 * Supports monthly, annual, and legacy price IDs.
 */
export function tierFromPriceId(priceId: string): Tier | null {
  const map: Record<string, Tier> = {};

  // Monthly prices
  if (process.env.STRIPE_PRICE_PRO) map[process.env.STRIPE_PRICE_PRO] = "PRO";
  if (process.env.STRIPE_PRICE_PREMIUM) map[process.env.STRIPE_PRICE_PREMIUM] = "PREMIUM";

  // Annual prices
  if (process.env.STRIPE_PRICE_PRO_ANNUAL) map[process.env.STRIPE_PRICE_PRO_ANNUAL] = "PRO";
  if (process.env.STRIPE_PRICE_PREMIUM_ANNUAL) map[process.env.STRIPE_PRICE_PREMIUM_ANNUAL] = "PREMIUM";

  // Legacy prices (grandfather existing subscribers on old pricing).
  // Comma-separated: a price change retires BOTH a monthly and an annual
  // price ID, and each repricing adds more — e.g.
  // STRIPE_PRICE_PREMIUM_LEGACY="price_old_monthly,price_old_annual".
  for (const id of (process.env.STRIPE_PRICE_PRO_LEGACY ?? "").split(",")) {
    if (id.trim()) map[id.trim()] = "PRO";
  }
  for (const id of (process.env.STRIPE_PRICE_PREMIUM_LEGACY ?? "").split(",")) {
    if (id.trim()) map[id.trim()] = "PREMIUM";
  }

  if (map[priceId]) return map[priceId];

  console.error(
    `[Stripe] Unknown price ID: ${priceId}. Check STRIPE_PRICE_* env vars.`
  );
  return null;
}

/**
 * Maps app tier + billing interval to Stripe price ID for checkout.
 */
export function priceIdFromTier(
  tier: Tier,
  interval: BillingInterval = "monthly"
): string | null {
  if (tier === "PRO") {
    return interval === "annual"
      ? process.env.STRIPE_PRICE_PRO_ANNUAL ?? null
      : process.env.STRIPE_PRICE_PRO ?? null;
  }
  if (tier === "PREMIUM") {
    return interval === "annual"
      ? process.env.STRIPE_PRICE_PREMIUM_ANNUAL ?? null
      : process.env.STRIPE_PRICE_PREMIUM ?? null;
  }
  return null;
}
