"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getAdminAuth } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";
import { DEFAULT_CABINETS } from "@/types/constants";
import { mockStore } from "@/lib/mock-store";
import { logAudit } from "./audit";

const isDev = !process.env.DATABASE_URL || process.env.DATABASE_URL === "";

/** Name of the httpOnly session cookie that authenticates server actions. */
const SESSION_COOKIE = "__session";
/** Firebase session-cookie lifetime: 14 days (the Firebase max). */
const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 14 * 1000;

/**
 * Mint a Firebase session cookie from a freshly-verified ID token and store it
 * as an httpOnly `__session` cookie. This is what `getAuthenticatedUserId()`
 * later verifies, so server actions can authenticate the caller WITHOUT
 * trusting a client-supplied userId (closes the IDOR).
 *
 * Best-effort: any failure here is logged but never thrown, so a session-cookie
 * hiccup can't break sign-in/profile loading. (If the cookie isn't set, the
 * caller stays unauthenticated for mutations until the next attempt.)
 */
async function establishSessionCookie(idToken: string): Promise<void> {
  try {
    const auth = getAdminAuth();
    if (!auth) return;
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
      path: "/",
    });
  } catch (err) {
    console.error(
      "[auth] failed to establish __session cookie:",
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Clear the `__session` cookie. Call this from the client on sign-out so a
 * shared/public device doesn't leave an authenticated server session behind.
 */
export async function clearSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
  } catch {
    // no cookie / not in a request context — nothing to clear
  }
}

/**
 * Verify a Firebase ID token and return/create the Prisma user.
 * Called after Firebase client-side auth succeeds.
 */
export async function syncUser(idToken: string) {
  const auth = getAdminAuth();

  // Dev mode without database — verify token if possible, then use mock profile
  if (isDev) {
    let email = "dev@cellardoor.app";
    let displayName = "Dev User";
    let avatarUrl = "";
    let uid = "dev-user-001";

    // If Firebase Admin is available, verify the real token for the user info
    if (auth) {
      try {
        const decoded = await auth.verifyIdToken(idToken);
        uid = decoded.uid;
        email = decoded.email || email;
        displayName = decoded.name || displayName;
        avatarUrl = decoded.picture || "";
      } catch {
        // Token verification failed — use defaults
      }
    }

    // Update mock profile with the real user info
    mockStore.updateProfile({
      displayName,
      photoURL: avatarUrl || null,
    });

    return {
      id: uid,
      email,
      displayName,
      avatarUrl,
      tier: "FREE",
    };
  }

  // Production — verify token and upsert in Prisma
  const decoded = await getAdminAuth()!.verifyIdToken(idToken);
  const { uid, email, name, picture } = decoded;

  if (!email) {
    throw new Error("Firebase user has no email");
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { firebaseUid: uid },
  });

  if (existing) {
    // Update existing user
    const user = await prisma.user.update({
      where: { firebaseUid: uid },
      data: {
        email,
        displayName: name || "",
        avatarUrl: picture || "",
      },
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      tier: user.tier,
    };
  }

  // New user — create user, default wall, and default cabinets in a transaction
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        firebaseUid: uid,
        email,
        displayName: name || "",
        avatarUrl: picture || "",
      },
    });

    // Create a default wall
    const wall = await tx.wall.create({
      data: {
        userId: newUser.id,
        name: "Main Wall",
        sortOrder: 0,
      },
    });

    // Create default cabinets attached to the wall
    for (const cab of DEFAULT_CABINETS) {
      await tx.cabinet.create({
        data: {
          userId: newUser.id,
          wallId: wall.id,
          name: cab.name,
          rows: cab.rows,
          cols: cab.cols,
          depth: cab.depth,
          storageRows: cab.storageRows,
          sortOrder: cab.sortOrder,
        },
      });
    }

    return newUser;
  });

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    tier: user.tier,
  };
}

/**
 * Get the current user from a Firebase ID token.
 * Used by server components / API routes.
 */
export async function getCurrentUser(idToken: string) {
  if (isDev) {
    return {
      id: "dev-user-001",
      email: "dev@cellardoor.app",
      displayName: "Dev User",
      avatarUrl: "",
      tier: "FREE",
      firebaseUid: "dev-user-001",
    };
  }

  try {
    const decoded = await getAdminAuth()!.verifyIdToken(idToken);
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    });
    return user;
  } catch {
    return null;
  }
}

/**
 * Permanently delete a user account and ALL associated data.
 * This is irreversible. Deletes: user, wines, cabinets, walls, history,
 * buy list, community ratings, and Firebase auth record.
 */
export async function deleteAccount(idToken: string): Promise<{ success: boolean; error?: string }> {
  if (isDev) {
    return { success: false, error: "Account deletion is not available in dev mode." };
  }

  try {
    const decoded = await getAdminAuth()!.verifyIdToken(idToken);
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    });

    if (!user) {
      return { success: false, error: "User not found." };
    }

    // Audit log before deletion (fire-and-forget)
    void logAudit(user.id, "user.delete", user.id, { email: user.email });

    // Cancel any active Stripe subscription and delete the Stripe customer
    // BEFORE wiping the Prisma row — otherwise we lose the customer/sub IDs
    // and the user keeps getting billed forever. Deleting the customer also
    // cancels all subs as a side effect, but we cancel explicitly first so
    // we get a clean audit/webhook event.
    if (user.stripeSubId) {
      try {
        await stripe.subscriptions.cancel(user.stripeSubId, {
          invoice_now: false,
          prorate: false,
        });
      } catch (err) {
        // Sub may already be canceled — log and continue
        void logAudit(user.id, "user.delete.stripe_cancel_failed", user.id, {
          subId: user.stripeSubId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (user.stripeCustomerId) {
      try {
        await stripe.customers.del(user.stripeCustomerId);
      } catch (err) {
        void logAudit(user.id, "user.delete.stripe_customer_del_failed", user.id, {
          customerId: user.stripeCustomerId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Delete the Prisma user — cascades to all related data
    // (wines, cabinets, walls, history, buy list, community ratings)
    await prisma.user.delete({
      where: { id: user.id },
    });

    // Delete the Firebase Auth record
    try {
      await getAdminAuth()!.deleteUser(decoded.uid);
    } catch {
      // Firebase user may already be deleted or not exist
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete account.",
    };
  }
}

/**
 * Lightweight profile lookup — just id + tier.
 * Called once on auth init to populate the auth context with tier data.
 */
/**
 * Profile for single-user (no-auth) deployments.
 *
 * Mirrors getUserProfile but skips Firebase entirely: there is no id token to
 * verify and no session cookie to establish, because every server action
 * independently resolves the same implicit owner via getAuthenticatedUserId().
 *
 * Returns null when single-user mode is not enabled, so it cannot be used to
 * bypass authentication on a normal deployment.
 */
export async function getSingleUserProfile(): Promise<{
  id: string;
  tier: string;
} | null> {
  const { isSingleUserMode } = await import("@/lib/single-user");
  if (!isSingleUserMode()) return null;

  try {
    const { ensureSingleUser } = await import("@/server/auth-guard");
    const id = await ensureSingleUser();
    const user = await prisma.user.findUnique({
      where: { id },
      select: { tier: true },
    });
    return { id, tier: user?.tier ?? "FREE" };
  } catch (err) {
    console.error("[auth] single-user profile failed:", err);
    return null;
  }
}

export async function getUserProfile(
  idToken: string
): Promise<{ id: string; tier: string } | null> {
  if (isDev) {
    return { id: "dev-user-001", tier: "FREE" };
  }

  try {
    const decoded = await getAdminAuth()!.verifyIdToken(idToken);
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { id: true, tier: true },
    });
    if (!user) return null;
    // Establish the httpOnly session cookie as part of the auth-init round
    // trip. The AuthProvider calls this on every onAuthStateChanged before it
    // exposes `userId` to the app, so by the time any other server action runs
    // the cookie already exists — getAuthenticatedUserId() can authenticate the
    // caller server-side and we never have to trust a client-supplied userId.
    await establishSessionCookie(idToken);
    return { id: user.id, tier: user.tier };
  } catch {
    return null;
  }
}

/**
 * Full profile for Settings → Profile card.
 * Resolves the Prisma user via a passed Firebase idToken when present,
 * otherwise via the verified `__session` cookie (resolveServerUserId).
 */
export async function getFullUserProfile(
  idToken?: string,
  clientUserId?: string
): Promise<{
  id: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  avatarColor: string;
  createdAt: string | null;
} | null> {
  if (isDev) {
    return mockStore.getProfile();
  }

  try {
    const { resolveServerUserId } = await import("@/server/auth-guard");
    let userId: string | null = null;
    if (idToken) {
      const decoded = await getAdminAuth()!.verifyIdToken(idToken);
      const u = await prisma.user.findUnique({
        where: { firebaseUid: decoded.uid },
        select: { id: true },
      });
      userId = u?.id ?? null;
    } else {
      userId = await resolveServerUserId(clientUserId);
    }
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        avatarColor: true,
        createdAt: true,
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      displayName: user.displayName || user.email.split("@")[0] || "User",
      email: user.email,
      photoURL: user.avatarUrl || null,
      avatarColor: user.avatarColor || "#722F37",
      createdAt: user.createdAt.toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Update the authenticated user's profile (name / avatar photo / color).
 */
export async function updateUserProfile(
  data: {
    displayName?: string;
    photoURL?: string | null;
    avatarColor?: string;
  },
  clientUserId?: string
): Promise<{
  id: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  avatarColor: string;
  createdAt: string | null;
}> {
  if (isDev) {
    return mockStore.updateProfile(data);
  }
  const { resolveServerUserId } = await import("@/server/auth-guard");
  const userId = await resolveServerUserId(clientUserId);
  if (!userId) throw new Error("Unauthorized");

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.displayName !== undefined && { displayName: data.displayName }),
      ...(data.photoURL !== undefined && { avatarUrl: data.photoURL ?? "" }),
      ...(data.avatarColor !== undefined && { avatarColor: data.avatarColor }),
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      avatarColor: true,
      createdAt: true,
    },
  });
  return {
    id: user.id,
    displayName: user.displayName || user.email.split("@")[0] || "User",
    email: user.email,
    photoURL: user.avatarUrl || null,
    avatarColor: user.avatarColor || "#722F37",
    createdAt: user.createdAt.toISOString(),
  };
}
