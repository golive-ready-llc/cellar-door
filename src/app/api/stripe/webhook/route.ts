import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { stripe } from "@/lib/stripe";
import { tierFromPriceId } from "@/lib/stripe-helpers";
import { prisma } from "@/lib/db";
import { CREDIT_PACKS } from "@/lib/tier";
import type Stripe from "stripe";

/**
 * Stripe webhook handler.
 * Processes subscription lifecycle events to keep user tiers in sync.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency guard (audit #3) — Stripe delivers webhooks at-least-once,
  // so dedupe by event.id before doing side effects. Insert first; on unique
  // violation (P2002), this event has already been processed → ack 200.
  // If a handler later throws (audit #17), we DELETE this row in the catch
  // so Stripe's retry actually re-runs the handler instead of being deduped.
  try {
    await prisma.processedStripeEvent.create({
      data: { id: event.id, type: event.type },
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      console.info(`[Stripe] Skipping already-processed event ${event.id} (${event.type})`);
      return NextResponse.json({ received: true, deduped: true });
    }
    console.error(`[Stripe] Failed to record event ${event.id}:`, err);
    // Fall through — better to risk a duplicate than drop the event entirely
  }


  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case "customer.subscription.paused": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionPaused(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn(
          `[Stripe] invoice.payment_failed for customer=${
            typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id
          } invoice=${invoice.id} amount_due=${invoice.amount_due}`
        );
        break;
      }
      default:
        // Unhandled event type — acknowledge anyway
        break;
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err);
    const errMessage = err instanceof Error ? err.message : String(err);
    // Roll back the dedupe row so Stripe's retry actually re-runs the
    // handler instead of being short-circuited as "already processed".
    //
    // FAILURE MODE: if this DELETE itself fails (e.g. DB unreachable), the
    // dedupe row stays in place AND we still return 500. Stripe will retry,
    // but the next attempt will short-circuit at the dedupe check and the
    // event is silently dropped forever — no user tier update, no credit
    // grant, just a stale log line. We surface this two ways:
    //   1. Sentry.captureException so on-call gets paged with full context
    //      (event id/type + the original handler error that triggered cleanup).
    //   2. Embed the failure context in the 500 response body. Stripe ignores
    //      response bodies, but our request logs / proxy logs preserve it,
    //      giving us a richer breadcrumb when triaging from logs alone.
    try {
      await prisma.processedStripeEvent.delete({ where: { id: event.id } });
    } catch (cleanupErr) {
      console.error(`[Stripe] Failed to roll back dedupe row for ${event.id}:`, cleanupErr);
      Sentry.captureException(cleanupErr, {
        tags: {
          source: "stripe-webhook",
          phase: "dedupe-cleanup",
          eventType: event.type,
        },
        extra: {
          eventId: event.id,
          eventType: event.type,
          originalError: errMessage,
        },
      });
      return NextResponse.json(
        {
          error: "Handler failed",
          cleanupFailed: true,
          eventId: event.id,
          originalError: errMessage,
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

// ─── Event Handlers ──────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("Checkout session missing userId in metadata");
    return;
  }

  // One-time AI credit top-up (mode: "payment")
  if (session.metadata?.type === "ai_credits") {
    // Only grant if payment actually succeeded — paid status protects
    // against "complete" events for async payment methods that failed.
    if (session.payment_status !== "paid") {
      console.info(
        `[Stripe] Credit purchase not yet paid (${session.payment_status}) for user ${userId}`
      );
      return;
    }
    const credits = Number(session.metadata.credits);
    // Defense-in-depth: the credits value is set server-side from CREDIT_PACKS
    // when the session is created and is signature-verified here, but re-check
    // it against the source of truth anyway — only grant an amount that matches
    // a defined pack, so a corrupted/unexpected metadata can't grant arbitrary credits.
    if (!Number.isFinite(credits) || credits <= 0 || !CREDIT_PACKS.some((p) => p.credits === credits)) {
      console.error(`[Stripe] Credits value does not match any defined pack: ${session.metadata.credits}`);
      return;
    }
    await prisma.user.update({
      where: { id: userId },
      data: { extraCredits: { increment: credits } },
    });
    console.info(`[Stripe] Granted ${credits} top-up credits to user ${userId}`);
    return;
  }

  // Subscription checkout — fall through to original tier-upgrade flow
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) return;

  // Only promote tier when the subscription is actually live (audit #23).
  // Guards against stale/replayed checkout.session.completed events that arrive
  // after a downgrade or for an incomplete/canceled subscription. Combined
  // with #5: incomplete subs defer here and get promoted by the eventual
  // subscription.updated event when status flips to active/trialing.
  if (subscription.status !== "active" && subscription.status !== "trialing") {
    console.warn(
      `[Stripe] Ignoring checkout.session.completed for user ${userId}: subscription status is ${subscription.status}`
    );
    return;
  }

  const tier = tierFromPriceId(priceId);
  if (!tier) {
    console.error(`[Stripe] Cannot determine tier for price ${priceId} — skipping update for user ${userId}`);
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      tier,
      stripeSubId: subscriptionId,
      trialEndsAt: trialEndFrom(subscription),
      stripeCustomerId:
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? undefined,
    },
  });

  console.info(`[Stripe] User upgraded to ${tier} via checkout`);
}

/**
 * The trial-end timestamp for a subscription, or null when it isn't trialing.
 * Used to cap AI credits during the free trial (see TRIAL_CREDIT_CAP) and
 * cleared once the subscription converts to active.
 */
function trialEndFrom(subscription: Stripe.Subscription): Date | null {
  return subscription.status === "trialing" && subscription.trial_end
    ? new Date(subscription.trial_end * 1000)
    : null;
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { stripeSubId: subscription.id },
        { stripeCustomerId: customerId },
      ],
    },
    select: { id: true },
  });

  if (!user) {
    console.error(`No user found for subscription ${subscription.id}`);
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) return;

  const status = subscription.status;

  if (status === "active" || status === "trialing") {
    // Active subscription — set to the paid tier
    const tier = tierFromPriceId(priceId);
    if (!tier) {
      console.error(`[Stripe] Cannot determine tier for price ${priceId} — skipping update for user ${user.id}`);
      return;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { tier, stripeSubId: subscription.id, trialEndsAt: trialEndFrom(subscription) },
    });
    console.info(`[Stripe] Subscription updated to ${tier} (${status})`);
  } else if (status === "past_due" || status === "unpaid") {
    // Grace period — keep the tier but log warning
    console.warn(`User ${user.id} subscription is ${status}`);
  } else if (status === "canceled") {
    // Canceled but not yet deleted — keep tier until period end
    console.info("[Stripe] Subscription canceled, keeping tier until period end");
  } else if (status === "incomplete_expired" || status === "paused") {
    // Initial payment never succeeded (incomplete_expired) or sub was
    // paused — downgrade to FREE and clear stripe linkage.
    await prisma.user.update({
      where: { id: user.id },
      data: { tier: "FREE", stripeSubId: null, trialEndsAt: null },
    });
    console.info(`[Stripe] Downgraded user ${user.id} to FREE (status=${status})`);
  } else if (status === "incomplete") {
    // Initial payment still pending — keep user on FREE, do nothing.
    console.info(`[Stripe] Subscription incomplete for user ${user.id} — awaiting payment`);
  } else {
    // Unknown / future Stripe status — log so we notice and add a branch.
    console.error(
      `[Stripe] Unhandled subscription status "${status}" for user ${user.id} sub=${subscription.id}`
    );
  }
}

async function handleSubscriptionPaused(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { stripeSubId: subscription.id },
        { stripeCustomerId: customerId },
      ],
    },
    select: { id: true },
  });

  if (!user) {
    console.error(`No user found for paused subscription ${subscription.id}`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { tier: "FREE", stripeSubId: null, trialEndsAt: null },
  });

  console.info(`[Stripe] Downgraded user ${user.id} to FREE (subscription paused)`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { stripeSubId: subscription.id },
        { stripeCustomerId: customerId },
      ],
    },
    select: { id: true },
  });

  if (!user) {
    console.error(`No user found for deleted subscription ${subscription.id}`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { tier: "FREE", stripeSubId: null, trialEndsAt: null },
  });

  console.info("[Stripe] Downgraded to FREE (subscription deleted)");
}
