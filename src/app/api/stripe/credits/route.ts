import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { getAdminAuth } from "@/lib/firebase-admin";
import { CREDIT_PACKS } from "@/lib/tier";

/**
 * Start a one-time Stripe Checkout for an AI credit top-up. The purchased
 * credits are granted by the Stripe webhook (checkout.session.completed)
 * once payment is confirmed.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify Firebase token
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const idToken = authHeader.slice(7);
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
    }
    const decoded = await adminAuth.verifyIdToken(idToken);

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
      where: { firebaseUid: decoded.uid },
      select: { id: true, email: true, stripeCustomerId: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 4. Ensure Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id, firebaseUid: decoded.uid },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // 5. Create one-time payment Checkout Session
    // Self-hosted deployments set NEXT_PUBLIC_SITE_URL so Stripe returns the
    // user to THEIR domain; falls back to the hosted service.
    const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://mycellardoor.app";
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
      success_url: `${origin}/settings?credits=success`,
      cancel_url: `${origin}/settings`,
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
