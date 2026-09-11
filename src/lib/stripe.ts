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
      globalForStripe.stripe = new Stripe(key, {
        typescript: true,
        // Pin the API version this app was built and tested against (the
        // stripe-node 20 default). A new SDK major otherwise moves every call
        // to its own newer default version.
        apiVersion: "2026-02-25.clover" as Stripe.StripeConfig["apiVersion"],
      });
    }
    return (globalForStripe.stripe as unknown as Record<string | symbol, unknown>)[prop];
  },
});
