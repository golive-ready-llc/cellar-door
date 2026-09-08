/**
 * Server-side tier enforcement utilities.
 *
 * Used by AI server actions and data mutation endpoints to gate
 * features based on the user's subscription tier.
 *
 * NOTE: No "use server" directive — this is a utility module imported
 * by server actions, not a server action file itself. "use server" files
 * can only export async functions (no classes, types, or constants).
 */

import { prisma } from "@/lib/db";
import {
  hasFeature,
  canAddWine,
  getUpgradeTier,
  TIER_CONFIGS,
  TIER_DISPLAY_NAMES,
  effectiveCreditCap,
  type Tier,
  type TierFeatures,
  type AiOperation,
} from "@/lib/tier";

// ─── Error Types ──────────────────────────────────────────────

export type TierErrorCode = "UPGRADE_REQUIRED" | "WINE_LIMIT_REACHED" | "CREDITS_EXHAUSTED";

export class TierError extends Error {
  public readonly code: TierErrorCode;
  public readonly requiredTier: Tier;

  constructor(code: TierErrorCode, requiredTier: Tier, message: string) {
    super(message);
    this.code = code;
    this.requiredTier = requiredTier;
    this.name = "TierError";
  }
}

// ─── Tier Override ───────────────────────────────────────────

/**
 * Minimum tier override — mirrors the same logic in auth-provider.tsx.
 * When NEXT_PUBLIC_DEFAULT_TIER is set (e.g. "PREMIUM"), it acts as a
 * floor: the user gets whichever tier is higher (DB or override).
 */
const TIER_RANK: Record<Tier, number> = { FREE: 0, PRO: 1, PREMIUM: 2 };
const DEFAULT_TIER: Tier =
  (process.env.NEXT_PUBLIC_DEFAULT_TIER as Tier | undefined) &&
  (process.env.NEXT_PUBLIC_DEFAULT_TIER as string) in TIER_RANK
    ? (process.env.NEXT_PUBLIC_DEFAULT_TIER as Tier)
    : "FREE";

function maxTier(a: Tier, b: Tier): Tier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

/** Current calendar month as "YYYY-MM" */
function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// ─── Tier Lookup ──────────────────────────────────────────────

/** Get user tier from DB by userId, respecting env-var override */
export async function getUserTier(userId: string): Promise<Tier> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });
    if (!user) return DEFAULT_TIER;
    const dbTier = (user.tier as Tier) ?? "FREE";
    return maxTier(dbTier, DEFAULT_TIER);
  } catch {
    // DB error — use default tier (FREE in production)
    return DEFAULT_TIER;
  }
}

/**
 * Fetch tier plus trial state in one query — used by the credit path so a
 * subscription still in its free trial can be capped at TRIAL_CREDIT_CAP.
 */
async function getTierAndTrial(
  userId: string
): Promise<{ tier: Tier; trialEndsAt: Date | null }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true, trialEndsAt: true },
    });
    if (!user) return { tier: DEFAULT_TIER, trialEndsAt: null };
    const dbTier = (user.tier as Tier) ?? "FREE";
    return {
      tier: maxTier(dbTier, DEFAULT_TIER),
      trialEndsAt: user.trialEndsAt ?? null,
    };
  } catch {
    // Fall back to a tier-only read. This matters during rollout: if the
    // trialEndsAt column hasn't been applied to the DB yet, the select above
    // throws — and we must NOT downgrade a paying user to FREE. Re-reading the
    // tier alone keeps AI working; the trial cap simply stays dormant (no
    // trial info) until the column exists.
    return { tier: await getUserTier(userId), trialEndsAt: null };
  }
}

/**
 * The effective monthly AI credit allowance. While a subscription is in its
 * free trial (trialEndsAt in the future), the allowance is capped at
 * TRIAL_CREDIT_CAP so a trial can't consume a full tier's credits and cancel
 * before the first charge. Otherwise it's the full tier allowance.
 */
function effectiveCreditLimit(tier: Tier, trialEndsAt: Date | null): number {
  const isTrialing = Boolean(trialEndsAt && trialEndsAt.getTime() > Date.now());
  return effectiveCreditCap(tier, isTrialing);
}

// ─── Gate Functions ───────────────────────────────────────────

/**
 * Assert that a user's tier allows a specific feature.
 * Throws TierError if not.
 */
export async function requireFeature(
  userId: string,
  feature: keyof TierFeatures
): Promise<Tier> {
  const tier = await getUserTier(userId);
  if (!hasFeature(tier, feature)) {
    const upgradeTo = getUpgradeTier(tier) ?? "PRO";
    const upgradeName = TIER_DISPLAY_NAMES[upgradeTo];
    throw new TierError(
      "UPGRADE_REQUIRED",
      upgradeTo,
      `This feature requires a ${upgradeName} subscription`
    );
  }
  return tier;
}

/**
 * Assert that a user can add another wine.
 * Throws TierError if at the free tier wine limit.
 */
export async function requireCanAddWine(userId: string): Promise<Tier> {
  const tier = await getUserTier(userId);
  const wineCount = await prisma.wine.count({ where: { userId } });
  if (!canAddWine(tier, wineCount)) {
    const upgradeTo = getUpgradeTier(tier) ?? "PREMIUM";
    const limit = TIER_CONFIGS[tier].features.maxWines ?? wineCount;
    const upgradeName = TIER_DISPLAY_NAMES[upgradeTo];
    throw new TierError(
      "WINE_LIMIT_REACHED",
      upgradeTo,
      `You've reached the ${limit}-wine limit on the ${TIER_DISPLAY_NAMES[tier]} plan. Upgrade to ${upgradeName} for more wines.`
    );
  }
  return tier;
}

// ─── AI Credit System ─────────────────────────────────────────

/**
 * Get the current month's AI credit usage for a user.
 * Also returns the user's purchased top-up pool (`extraCredits`).
 */
export async function getAiUsage(userId: string): Promise<{
  creditsUsed: number;
  creditsLimit: number;
  extraCredits: number;
  yearMonth: string;
  tier: Tier;
}> {
  const { tier, trialEndsAt } = await getTierAndTrial(userId);
  const creditsLimit = effectiveCreditLimit(tier, trialEndsAt);
  const yearMonth = currentYearMonth();

  try {
    const [usage, user] = await Promise.all([
      prisma.aiUsage.findUnique({
        where: { userId_yearMonth: { userId, yearMonth } },
        select: { creditsUsed: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { extraCredits: true },
      }),
    ]);
    return {
      creditsUsed: usage?.creditsUsed ?? 0,
      creditsLimit,
      extraCredits: user?.extraCredits ?? 0,
      yearMonth,
      tier,
    };
  } catch {
    return { creditsUsed: 0, creditsLimit, extraCredits: 0, yearMonth, tier };
  }
}

// ─── Atomic Reserve Primitive ─────────────────────────────────

/**
 * Result of `reserveAiCredits`. On success, returns a `refundOnFailure`
 * callback the caller MUST invoke if the AI work itself throws after the
 * reservation succeeded — this rolls back the increment atomically.
 */
export type ReserveAiCreditsResult =
  | {
      ok: true;
      tier: Tier;
      remaining: number;
      chargedMonthly: number;
      chargedExtra: number;
      refundOnFailure: () => Promise<void>;
    }
  | {
      ok: false;
      reason: "CREDITS_EXHAUSTED" | "INVALID_AMOUNT";
      remaining: number;
      tier: Tier;
      message: string;
    };

/**
 * Atomically check-and-reserve AI credits in a single transaction, eliminating
 * the TOCTOU race that exists between `checkAiCredits` and `consumeAiCredits`.
 *
 * Strategy: one `$transaction` that
 *   1. Upserts the monthly `AiUsage` row to ensure it exists.
 *   2. Issues a conditional `updateMany` on `AiUsage` with a WHERE clause that
 *      enforces `creditsUsed + needed <= cap`. If `count === 1`, the monthly
 *      pool covered (part of) the charge.
 *   3. For any remainder, issues a conditional `updateMany` on `User` with
 *      WHERE `extraCredits >= remainder`. If `count === 1`, top-up covered it.
 *   4. Writes the audit log row.
 *   5. Throws to roll back if neither pool can cover the request — the
 *      throw aborts the transaction so partial increments are reverted.
 *
 * The returned `refundOnFailure` reverses the increments (and decrements)
 * from the same split, so callers can wrap the AI call in try/catch.
 *
 * Errors from the underlying DB are NOT swallowed — they propagate so the
 * caller can fail the request rather than silently grant free credits.
 */
export async function reserveAiCredits(
  userId: string,
  operation: AiOperation,
  credits: number
): Promise<ReserveAiCreditsResult> {
  if (!Number.isFinite(credits) || credits < 0) {
    return {
      ok: false,
      reason: "INVALID_AMOUNT",
      remaining: 0,
      tier: "FREE",
      message: "Invalid credit amount",
    };
  }

  const { tier, trialEndsAt } = await getTierAndTrial(userId);
  const creditsLimit = effectiveCreditLimit(tier, trialEndsAt);
  const yearMonth = currentYearMonth();

  // Zero-cost operations still log usage but reserve nothing.
  if (credits === 0) {
    await prisma.aiUsageLog.create({
      data: { userId, operation, credits: 0, yearMonth },
    });
    const { creditsUsed, extraCredits } = await getAiUsage(userId);
    return {
      ok: true,
      tier,
      remaining: Math.max(0, creditsLimit - creditsUsed) + extraCredits,
      chargedMonthly: 0,
      chargedExtra: 0,
      refundOnFailure: async () => {
        /* nothing to refund */
      },
    };
  }

  // Track what was actually charged so we can refund precisely on failure.
  let chargedMonthly = 0;
  let chargedExtra = 0;

  try {
    await prisma.$transaction(async (tx) => {
      // Make sure the monthly row exists so the conditional updateMany has
      // something to match.
      await tx.aiUsage.upsert({
        where: { userId_yearMonth: { userId, yearMonth } },
        create: { userId, yearMonth, creditsUsed: 0 },
        update: {},
      });

      // 1. Try to charge the monthly pool conditionally — only succeeds if
      //    the increment would not exceed the cap.
      const monthlyTry = await tx.aiUsage.updateMany({
        where: {
          userId,
          yearMonth,
          creditsUsed: { lte: creditsLimit - credits },
        },
        data: { creditsUsed: { increment: credits } },
      });

      let remainder = credits;
      if (monthlyTry.count === 1) {
        chargedMonthly = credits;
        remainder = 0;
      } else {
        // 2. Couldn't fit the full charge in the monthly pool. Take whatever
        //    monthly headroom is left atomically, then bill the rest to
        //    extraCredits.
        const usageRow = await tx.aiUsage.findUnique({
          where: { userId_yearMonth: { userId, yearMonth } },
          select: { creditsUsed: true },
        });
        const monthlyHeadroom = Math.max(
          0,
          creditsLimit - (usageRow?.creditsUsed ?? 0)
        );
        const monthlyCharge = Math.min(monthlyHeadroom, credits);
        if (monthlyCharge > 0) {
          // Conditional again, in case another tx raced between the read above
          // and this write.
          const partial = await tx.aiUsage.updateMany({
            where: {
              userId,
              yearMonth,
              creditsUsed: { lte: creditsLimit - monthlyCharge },
            },
            data: { creditsUsed: { increment: monthlyCharge } },
          });
          if (partial.count === 1) {
            chargedMonthly = monthlyCharge;
            remainder = credits - monthlyCharge;
          }
        }

        // 3. Bill the remainder to extraCredits, atomically.
        if (remainder > 0) {
          const extraTry = await tx.user.updateMany({
            where: { id: userId, extraCredits: { gte: remainder } },
            data: { extraCredits: { decrement: remainder } },
          });
          if (extraTry.count !== 1) {
            // Insufficient credits across both pools. Throwing aborts the tx
            // and rolls back any partial monthly charge.
            throw new TierError(
              "CREDITS_EXHAUSTED",
              getUpgradeTier(tier) ?? tier,
              "Insufficient AI credits"
            );
          }
          chargedExtra = remainder;
        }
      }

      // 4. Audit log inside the same transaction so logs match real charges.
      await tx.aiUsageLog.create({
        data: { userId, operation, credits, yearMonth },
      });
    });
  } catch (e) {
    if (e instanceof TierError && e.code === "CREDITS_EXHAUSTED") {
      const { creditsUsed, extraCredits } = await getAiUsage(userId);
      return {
        ok: false,
        reason: "CREDITS_EXHAUSTED",
        remaining: Math.max(0, creditsLimit - creditsUsed) + extraCredits,
        tier,
        message: e.message,
      };
    }
    // Any other DB error must propagate — never silently grant free credits.
    throw e;
  }

  const { creditsUsed, extraCredits } = await getAiUsage(userId);
  const remaining = Math.max(0, creditsLimit - creditsUsed) + extraCredits;

  return {
    ok: true,
    tier,
    remaining,
    chargedMonthly,
    chargedExtra,
    refundOnFailure: async () => {
      // Reverse exactly what we charged, in a single interactive transaction.
      // Errors here propagate so the caller (and ops) know the refund failed.
      await prisma.$transaction(async (tx) => {
        if (chargedMonthly > 0) {
          // Only decrement if it stays >= 0 — a double refund (retried/dup
          // call) must not drive creditsUsed negative, which would read as
          // free carry-over credits (remaining = limit - creditsUsed). The
          // conditional where makes the clamp atomic without a read-modify.
          await tx.aiUsage.updateMany({
            where: { userId, yearMonth, creditsUsed: { gte: chargedMonthly } },
            data: { creditsUsed: { decrement: chargedMonthly } },
          });
        }
        if (chargedExtra > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { extraCredits: { increment: chargedExtra } },
          });
        }
        // Best-effort: also remove the audit log row so reporting matches.
        // Note: deleteMany may delete other matching rows if the user ran an
        // identical-cost op in the same month. Acceptable — the refund
        // happens immediately after the reserve in practice.
        await tx.aiUsageLog.deleteMany({
          where: { userId, operation, credits, yearMonth },
        });
      });
    },
  };
}

/**
 * Get remaining AI credits for display in the UI.
 * Returns { used, limit, remaining, extraCredits, tier } for the current month.
 */
export async function getAiCreditsRemaining(userId: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
  extraCredits: number;
  tier: Tier;
}> {
  const { creditsUsed, creditsLimit, extraCredits, tier } = await getAiUsage(userId);
  const monthlyRemaining = Math.max(0, creditsLimit - creditsUsed);
  return {
    used: creditsUsed,
    limit: creditsLimit,
    remaining: monthlyRemaining + extraCredits,
    extraCredits,
    tier,
  };
}
