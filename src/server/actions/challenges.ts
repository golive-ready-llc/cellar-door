"use server";

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { isAIAvailable } from "@/lib/ai";
import { challengePrompt } from "@/lib/ai/prompts";
import { resolveServerUserId } from "@/server/auth-guard";
import { isDemoRequest } from "@/lib/demo";
import { requireFeature, reserveAiCredits } from "@/server/tier-check";

/**
 * Award a badge exactly once. Relies on the Badge @@unique([userId, name])
 * constraint: create throws P2002 if it already exists (or a concurrent
 * request created it first), which we treat as "already awarded". Returns the
 * new badge only when THIS call created it — atomic, no findFirst-then-create
 * race that could insert duplicates.
 */
async function awardBadgeOnce(
  userId: string,
  name: string,
  icon: string
): Promise<{ id: string; userId: string; name: string; icon: string; earnedAt: Date } | null> {
  try {
    return await prisma.badge.create({ data: { userId, name, icon } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return null; // already earned (or won the race elsewhere)
    }
    throw err;
  }
}

// ============================================================
// Corkscrew Challenges — Server Actions
// ============================================================

export interface ChallengeData {
  id: string;
  userId: string;
  title: string;
  description: string;
  type: string;
  criteria: Record<string, unknown>;
  completed: boolean;
  completedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface BadgeData {
  id: string;
  userId: string;
  name: string;
  icon: string;
  earnedAt: Date;
}

// ─── Generate a weekly challenge ──────────────────────────────

export async function generateWeeklyChallenge(
  userId?: string
): Promise<ChallengeData> {
  const uid = await resolveServerUserId(userId);
  // AI challenges are a paid feature (the UI hides the button on Free).
  // Enforce it here too: exported server actions are public endpoints.
  await requireFeature(uid, "aiEnabled");
  // Cellar, recent history and past challenges, fetched in parallel.
  const [wines, history, recentChallenges] = await Promise.all([
    prisma.wine.findMany({
      where: { userId: uid },
      select: {
        id: true,
        name: true,
        winery: true,
        type: true,
        country: true,
        region: true,
        vintage: true,
        grapeVariety: true,
        userRating: true,
        addedAt: true,
      },
      orderBy: { addedAt: "desc" },
      take: 100,
    }),
    prisma.wineHistory.findMany({
      where: { userId: uid },
      select: {
        name: true,
        type: true,
        country: true,
        region: true,
        rating: true,
        removedAt: true,
      },
      orderBy: { removedAt: "desc" },
      take: 30,
    }),
    prisma.challenge.findMany({
      where: { userId: uid },
      select: { title: true, type: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const prompt = challengePrompt(wines, history, recentChallenges);

  let title = "Rate 3 wines this week";
  let description =
    "Open your tasting journal and rate at least 3 wines from your cellar.";
  let type = "taste";
  let criteria: Record<string, unknown> = { action: "rate", count: 3 };

  // Reserve a credit before the paid call. Out of credits falls through to the
  // deterministic fallback below (no AI cost); refunded if the AI call fails.
  let refund: (() => Promise<void>) | null = null;
  try {
    if (!(await isAIAvailable())) throw new Error("AI not available");
    const reservation = await reserveAiCredits(uid, "enrich_text", 1);
    if (!reservation.ok) throw new Error(reservation.message);
    refund = reservation.refundOnFailure;
    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
      httpOptions: { timeout: 60_000 },
    });
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.8 },
    });
    const text = response.text ?? "";
    // Extract JSON from response (handles code fences, thinking tags)
    let jsonStr = text;
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    const parsed = JSON.parse(jsonStr);
    title = parsed.title || title;
    description = parsed.description || description;
    type = parsed.type || type;
    criteria = parsed.criteria || criteria;
  } catch (err) {
    if (refund) await refund().catch(() => {});
    console.error("[Challenges] AI generation failed, using fallback:", err);
    // Use deterministic fallback based on cellar contents
    const fallbacks = getFallbackChallenge(wines, history);
    title = fallbacks.title;
    description = fallbacks.description;
    type = fallbacks.type;
    criteria = fallbacks.criteria;
  }

  // Expires in 7 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const challenge = await prisma.challenge.create({
    data: {
      userId: uid,
      title,
      description,
      type,
      criteria: criteria as import("@/generated/prisma/client").Prisma.InputJsonValue,
      expiresAt,
    },
  });

  return challenge as unknown as ChallengeData;
}

// ─── Get active challenges ────────────────────────────────────

export async function getActiveChallenges(
  userId?: string
): Promise<ChallengeData[]> {
  // Demo visitors have no challenges. And a read this minor shouldn't throw
  // Unauthorized (it was noisy in Sentry from /stats when the session cookie
  // didn't resolve) — return empty gracefully instead.
  if (await isDemoRequest()) return [];
  let uid: string;
  try {
    uid = await resolveServerUserId(userId);
  } catch {
    return [];
  }
  const challenges = await prisma.challenge.findMany({
    where: {
      userId: uid,
      completed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  return challenges as unknown as ChallengeData[];
}

// ─── Get all challenges (active + completed) ──────────────────

export async function getAllChallenges(
  userId?: string
): Promise<ChallengeData[]> {
  const uid = await resolveServerUserId(userId);
  const challenges = await prisma.challenge.findMany({
    where: { userId: uid },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return challenges as unknown as ChallengeData[];
}

// ─── Complete a challenge ─────────────────────────────────────

const BADGE_MILESTONES: Record<number, { name: string; icon: string }> = {
  1: { name: "First Cork", icon: "🎉" },
  3: { name: "Hat Trick", icon: "🎩" },
  5: { name: "High Five", icon: "🖐️" },
  10: { name: "Tenacious Taster", icon: "🏆" },
  25: { name: "Quarter Century", icon: "💎" },
  50: { name: "Half Century", icon: "👑" },
};

const STREAK_BADGES: Record<number, { name: string; icon: string }> = {
  2: { name: "Double Down", icon: "🔥" },
  4: { name: "Sommelier Streak", icon: "⚡" },
  8: { name: "Unstoppable", icon: "🚀" },
  12: { name: "Year of Wine", icon: "🌟" },
};

const TYPE_BADGES: Record<string, { name: string; icon: string }> = {
  taste: { name: "Flavor Seeker", icon: "👅" },
  explore: { name: "Globe Trotter", icon: "🌍" },
  share: { name: "Wine Ambassador", icon: "🤝" },
  learn: { name: "Wine Scholar", icon: "📚" },
};

export async function completeChallenge(
  userId: string,
  challengeId: string
): Promise<{ challenge: ChallengeData; newBadges: BadgeData[] }> {
  const uid = await resolveServerUserId(userId);
  const challenge = await prisma.challenge.update({
    where: { id: challengeId, userId: uid },
    data: {
      completed: true,
      completedAt: new Date(),
    },
  });

  // Check for badge awards
  const newBadges: BadgeData[] = [];

  // 1. Count total completed challenges
  const totalCompleted = await prisma.challenge.count({
    where: { userId: uid, completed: true },
  });

  // Award milestone badge
  const milestone = BADGE_MILESTONES[totalCompleted];
  if (milestone) {
    const badge = await awardBadgeOnce(uid, milestone.name, milestone.icon);
    if (badge) newBadges.push(badge as unknown as BadgeData);
  }

  // 2. Check streak
  const streak = await computeStreak(uid);
  const streakBadge = STREAK_BADGES[streak];
  if (streakBadge) {
    const badge = await awardBadgeOnce(uid, streakBadge.name, streakBadge.icon);
    if (badge) newBadges.push(badge as unknown as BadgeData);
  }

  // 3. Award type-specific badge after 5 of same type
  const typeCount = await prisma.challenge.count({
    where: { userId: uid, completed: true, type: challenge.type },
  });
  if (typeCount >= 5) {
    const typeBadge = TYPE_BADGES[challenge.type];
    if (typeBadge) {
      const badge = await awardBadgeOnce(uid, typeBadge.name, typeBadge.icon);
      if (badge) newBadges.push(badge as unknown as BadgeData);
    }
  }

  return {
    challenge: challenge as unknown as ChallengeData,
    newBadges,
  };
}

// ─── Get user badges ──────────────────────────────────────────

export async function getUserBadges(userId?: string): Promise<BadgeData[]> {
  const uid = await resolveServerUserId(userId);
  const badges = await prisma.badge.findMany({
    where: { userId: uid },
    orderBy: { earnedAt: "desc" },
  });

  return badges as unknown as BadgeData[];
}

// ─── Get user streak ──────────────────────────────────────────

export async function getUserStreak(userId?: string): Promise<number> {
  const uid = await resolveServerUserId(userId);
  return computeStreak(uid);
}

async function computeStreak(userId: string): Promise<number> {
  // Get all completed challenges ordered by completion date
  const completed = await prisma.challenge.findMany({
    where: { userId, completed: true, completedAt: { not: null } },
    select: { completedAt: true, createdAt: true },
    orderBy: { completedAt: "desc" },
  });

  if (completed.length === 0) return 0;

  // Group by ISO week
  const weeks = new Set<string>();
  for (const c of completed) {
    const d = c.completedAt ?? c.createdAt;
    weeks.add(getISOWeek(d));
  }

  // Count consecutive weeks from current week
  const now = new Date();
  let streak = 0;
  const currentWeek = getISOWeek(now);

  // Check if current week has a completion — if not, start from last week
  let checkWeek = weeks.has(currentWeek) ? currentWeek : getPreviousWeek(now);

  while (weeks.has(checkWeek)) {
    streak++;
    // Go back one week
    const [year, week] = checkWeek.split("-W").map(Number);
    const d = new Date(year, 0, 1 + (week - 1) * 7);
    d.setDate(d.getDate() - 7);
    checkWeek = getISOWeek(d);
  }

  return streak;
}

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

function getPreviousWeek(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - 7);
  return getISOWeek(d);
}

// ─── Fallback challenge generator ─────────────────────────────

function getFallbackChallenge(
  wines: Array<{
    type: string;
    country: string;
    vintage: number | null;
    userRating: number | null;
  }>,
  _history: Array<{ country: string; type: string }>
) {
  const fallbacks = [
    {
      title: "Rate 3 wines this week",
      description:
        "Take a moment to taste and rate at least 3 wines from your cellar. Note what you love about each one.",
      type: "taste",
      criteria: { action: "rate", count: 3 },
    },
    {
      title: "Open your oldest bottle",
      description:
        "Find the oldest vintage in your collection and give it the tasting it deserves. Life is too short for unopened wine!",
      type: "taste",
      criteria: { action: "consume", filter: { oldest: true } },
    },
    {
      title: "Explore a new country",
      description:
        "Try a wine from a country you haven't opened recently. Branch out from your usual picks!",
      type: "explore",
      criteria: { action: "consume", filter: { newCountry: true } },
    },
    {
      title: "Blind tasting showdown",
      description:
        "Pick 2 similar wines (same grape or region), pour them blind, and rate them. Can you tell which is which?",
      type: "learn",
      criteria: { action: "blind_taste", count: 2 },
    },
    {
      title: "Share a wine with a friend",
      description:
        "Open a bottle with someone special this week. Great wine is even better when shared.",
      type: "share",
      criteria: { action: "share", count: 1 },
    },
  ];

  // Pick based on cellar content variety
  const unratedCount = wines.filter((w) => !w.userRating).length;
  if (unratedCount > wines.length * 0.5) return fallbacks[0]; // lots unrated

  const countries = new Set(wines.map((w) => w.country).filter(Boolean));
  if (countries.size > 3) return fallbacks[2]; // diverse cellar = explore

  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}
