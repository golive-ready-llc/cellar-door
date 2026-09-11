import Stripe from "stripe";

const globalForStripe = globalThis as unknown as {
  stripe: Stripe | undefined;
};

/**
 * Lazy Stripe singleton — only initialised when first accessed at runtime.
 * This prevents build-time errors when STRIPE_SECRET_KEY is not yet set.
 */
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!globalForStripe.stripe) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) {
        throw new Error(
          "STRIPE_SECRET_KEY is not set — cannot initialise Stripe"
        );
      }
      globalForStripe.stripe = new Stripe(key, { typescript: true });
    }
    return (globalForStripe.stripe as unknown as Record<string | symbol, unknown>)[prop];
  },
});
