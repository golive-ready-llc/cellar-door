"use server";

import { prisma } from "@/lib/db";
import { getAdminAuth } from "@/lib/firebase-admin";
import { isAdmin } from "@/lib/admin";
import { stripe } from "@/lib/stripe";

export interface RevenueStats {
  mrr: number;
  activeSubscriptions: number;
  proSubscriptions: number;
  premiumSubscriptions: number;
  recentCharges: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    customerEmail: string | null;
    description: string | null;
    created: number;
  }[];
}

export interface AdminStats {
  totalUsers: number;
  usersByTier: { FREE: number; PRO: number; PREMIUM: number };
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  totalWines: number;
  avgWinesPerUser: number;
  totalCollectionValue: number;
  wineTypeDistribution: { type: string; count: number }[];
  recentSignups: {
    id: string;
    email: string;
    displayName: string;
    tier: string;
    createdAt: Date;
    wineCount: number;
  }[];
  revenue: RevenueStats | null;
}

export async function getAdminStats(
  idToken: string
): Promise<{ error?: string; data?: AdminStats }> {
  try {
    const decoded = await getAdminAuth()!.verifyIdToken(idToken);
    const email = decoded.email;

    if (!email || !isAdmin(email)) {
      return { error: "Access denied. You are not an admin." };
    }

    // Total users and breakdown by tier
    const [totalUsers, freeCount, proCount, premiumCount] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { tier: "FREE" } }),
      prisma.user.count({ where: { tier: "PRO" } }),
      prisma.user.count({ where: { tier: "PREMIUM" } }),
    ]);

    // New users this week and this month
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [newUsersThisWeek, newUsersThisMonth] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: oneMonthAgo } } }),
    ]);

    // Total wines and average per user
    const totalWines = await prisma.wine.count();
    const avgWinesPerUser = totalUsers > 0 ? totalWines / totalUsers : 0;

    // Total collection value (sum of all wine prices)
    const valueResult = await prisma.wine.aggregate({
      _sum: { price: true },
    });
    const totalCollectionValue = valueResult._sum.price ?? 0;

    // Top 10 wine types distribution
    const wineTypeGroups = await prisma.wine.groupBy({
      by: ["type"],
      _count: { type: true },
      orderBy: { _count: { type: "desc" } },
      take: 10,
    });
    const wineTypeDistribution = wineTypeGroups.map((g) => ({
      type: g.type,
      count: g._count.type,
    }));

    // Recent signups (last 20 users with wine count)
    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        email: true,
        displayName: true,
        tier: true,
        createdAt: true,
        _count: { select: { wines: true } },
      },
    });

    const recentSignups = recentUsers.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      tier: u.tier,
      createdAt: u.createdAt,
      wineCount: u._count.wines,
    }));

    // Stripe revenue data
    let revenue: RevenueStats | null = null;
    try {
      const proPriceId = process.env.STRIPE_PRICE_PRO;
      const premiumPriceId = process.env.STRIPE_PRICE_PREMIUM;

      // Fetch active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        status: "active",
        limit: 100,
        expand: ["data.customer"],
      });

      let mrr = 0;
      let proSubs = 0;
      let premiumSubs = 0;

      for (const sub of subscriptions.data) {
        const item = sub.items.data[0];
        if (!item) continue;
        const priceId = item.price?.id;
        const amount = item.price?.unit_amount ?? 0;
        const interval = item.price?.recurring?.interval;

        // Normalise to monthly
        const monthlyAmount =
          interval === "year" ? amount / 12 : amount;
        mrr += monthlyAmount;

        if (priceId === proPriceId) proSubs++;
        else if (priceId === premiumPriceId) premiumSubs++;
      }

      // Fetch recent charges (last 20)
      const charges = await stripe.charges.list({
        limit: 20,
        expand: ["data.customer"],
      });

      const recentCharges = charges.data.map((ch) => ({
        id: ch.id,
        amount: ch.amount,
        currency: ch.currency,
        status: ch.status,
        customerEmail:
          typeof ch.customer === "object" && ch.customer !== null
            ? (ch.customer as { email?: string | null }).email ?? null
            : (ch.receipt_email ?? null),
        description: ch.description,
        created: ch.created,
      }));

      revenue = {
        mrr: Math.round(mrr), // in cents
        activeSubscriptions: subscriptions.data.length,
        proSubscriptions: proSubs,
        premiumSubscriptions: premiumSubs,
        recentCharges,
      };
    } catch (stripeErr) {
      console.error("Failed to fetch Stripe revenue data:", stripeErr);
      // revenue stays null — page will still render other stats
    }

    return {
      data: {
        totalUsers,
        usersByTier: {
          FREE: freeCount,
          PRO: proCount,
          PREMIUM: premiumCount,
        },
        newUsersThisWeek,
        newUsersThisMonth,
        totalWines,
        avgWinesPerUser: Math.round(avgWinesPerUser * 10) / 10,
        totalCollectionValue,
        wineTypeDistribution,
        recentSignups,
        revenue,
      },
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to fetch admin stats.",
    };
  }
}
