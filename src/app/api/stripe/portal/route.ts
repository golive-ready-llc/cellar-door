import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { authenticateIdToken } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify the caller's Firebase ID token
    const authResult = await authenticateIdToken(request);
    if (!authResult.ok) return authResult.response;

    // 2. Look up Prisma user
    const user = await prisma.user.findUnique({
      where: { firebaseUid: authResult.uid },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    // 3. Create portal session
    // Self-hosted deployments set NEXT_PUBLIC_SITE_URL so Stripe returns the
    // user to THEIR domain; falls back to the hosted service.
    const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://mycellardoor.app";

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe portal error:", err);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
