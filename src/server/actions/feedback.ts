"use server";

import { prisma } from "@/lib/db";
import { getAdminAuth } from "@/lib/firebase-admin";
import { isAdmin as checkAdmin } from "@/lib/admin";
import { resolveServerUserId } from "@/server/auth-guard";

export type FeedbackItem = {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  subject: string;
  message: string;
  tier: string;
  status: string;
  adminNote: string;
  createdAt: Date;
};

export async function submitFeedback(
  userId: string,
  subject: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const uid = await resolveServerUserId(userId);
    // Bound what one request can store.
    const cleanSubject = (subject ?? "").trim().slice(0, 200);
    const cleanMessage = (message ?? "").trim();
    if (!cleanMessage) {
      return { success: false, error: "Please enter a message." };
    }
    if (cleanMessage.length > 5000) {
      return { success: false, error: "Message is too long (5,000 characters max)." };
    }
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { tier: true },
    });

    await prisma.feedback.create({
      data: {
        userId: uid,
        subject: cleanSubject,
        message: cleanMessage,
        tier: user?.tier ?? "FREE",
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[submitFeedback]", error);
    return { success: false, error: "Failed to submit feedback" };
  }
}

export async function getFeedbackQueue(
  idToken: string
): Promise<{ data?: FeedbackItem[]; error?: string }> {
  try {
    const decoded = await getAdminAuth()!.verifyIdToken(idToken);
    const email = decoded.email;
    if (!email || !checkAdmin(email)) return { error: "Access denied" };

    const items = await prisma.feedback.findMany({
      include: {
        user: { select: { email: true, displayName: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    const tierRank: Record<string, number> = { PREMIUM: 0, PRO: 1, FREE: 2 };
    const sorted = items.sort((a, b) => {
      const tierDiff = (tierRank[a.tier] ?? 2) - (tierRank[b.tier] ?? 2);
      if (tierDiff !== 0) return tierDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return {
      data: sorted.map((item) => ({
        id: item.id,
        userId: item.userId,
        userEmail: item.user.email,
        userDisplayName: item.user.displayName,
        subject: item.subject,
        message: item.message,
        tier: item.tier,
        status: item.status,
        adminNote: item.adminNote,
        createdAt: item.createdAt,
      })),
    };
  } catch (error) {
    console.error("[getFeedbackQueue]", error);
    return { error: "Failed to load feedback" };
  }
}

export async function updateFeedbackStatus(
  idToken: string,
  feedbackId: string,
  status: string,
  adminNote?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await getAdminAuth()!.verifyIdToken(idToken);
    const email = decoded.email;
    if (!email || !checkAdmin(email))
      return { success: false, error: "Access denied" };

    await prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        status,
        ...(adminNote !== undefined ? { adminNote } : {}),
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[updateFeedbackStatus]", error);
    return { success: false, error: "Failed to update feedback" };
  }
}
