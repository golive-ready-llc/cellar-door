import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { priceIdFromTier } from "@/lib/stripe-helpers";
import { prisma } from "@/lib/db";
import { authenticateIdToken } from "@/lib/api-auth";
import { TIER_CONFIGS, type Tier } from "@/lib/tier";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify the caller's Firebase ID token
    const authResult = await authenticateIdToken(request);
    if (!authResult.ok) return authResult.response;

    // 2. Parse requested tier and billing interval
    const { tier, interval = "monthly" } = (await request.json()) as {
      tier: Tier;
      interval?: "monthly" | "annual";
    };
    if (tier !== "PRO" && tier !== "PREMIUM") {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const priceId = priceIdFromTier(tier, interval);
    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe price not configured" },
        { status: 500 }
      );
    }

    // 3. Look up Prisma user
    const user = await prisma.user.findUnique({
      where: { firebaseUid: authResult.uid },
      select: { id: true, email: true, stripeCustomerId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 4. Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id, firebaseUid: authResult.uid },
      });
      customerId = customer.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // 5. Create Checkout Session
    const tierConfig = TIER_CONFIGS[tier];
    // Self-hosted deployments set NEXT_PUBLIC_SITE_URL so Stripe returns the
    // user to THEIR domain; falls back to the hosted service.
    const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://mycellardoor.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: tierConfig.trialDays ?? undefined,
        metadata: { userId: user.id, tier },
      },
      metadata: { userId: user.id, tier },
      success_url: `${origin}/settings?checkout=success`,
      cancel_url: `${origin}/settings`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
