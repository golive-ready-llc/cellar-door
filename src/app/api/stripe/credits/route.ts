import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { getOrCreateStripeCustomerId } from "@/lib/stripe-helpers";
import { SITE_URL } from "@/lib/site-url";
import { prisma } from "@/lib/db";
import { authenticateIdToken } from "@/lib/api-auth";
import { CREDIT_PACKS } from "@/lib/tier";

/**
 * Start a one-time Stripe Checkout for an AI credit top-up. The purchased
 * credits are granted by the Stripe webhook (checkout.session.completed)
 * once payment is confirmed.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify the caller's Firebase ID token
    const authResult = await authenticateIdToken(request);
    if (!authResult.ok) return authResult.response;

    // 2. Parse pack id
    const { packId } = (await request.json()) as { packId?: string };
    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack) {
      return NextResponse.json({ error: "Invalid credit pack" }, { status: 400 });
    }

    const priceId = process.env[pack.envVar];
    if (!priceId) {
      return NextResponse.json(
        { error: `Credit pack Stripe price not configured (${pack.envVar})` },
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

    // 4. Ensure Stripe customer
    const customerId = await getOrCreateStripeCustomerId(user, authResult.uid);

    // 5. Create one-time payment Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        userId: user.id,
        type: "ai_credits",
        packId: pack.id,
        credits: String(pack.credits),
      },
      success_url: `${SITE_URL}/settings?credits=success`,
      cancel_url: `${SITE_URL}/settings`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe credits checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
