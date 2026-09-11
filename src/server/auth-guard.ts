"use server";

import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase-admin";
import { prisma } from "@/lib/db";
import {
  isSingleUserMode,
  SINGLE_USER_FIREBASE_UID,
  SINGLE_USER_EMAIL,
  SINGLE_USER_DISPLAY_NAME,
} from "@/lib/single-user";

// No DATABASE_URL means local development without a database: use a fixed dev
// identity. Never in production. A deploy that lost its DATABASE_URL must fail
// closed (no sign-in), not hand every visitor the same identity.
const isDev = !process.env.DATABASE_URL && process.env.NODE_ENV !== "production";

/**
 * Get the authenticated user's Prisma ID by verifying the Firebase SESSION
 * cookie set by `getUserProfile` → establishSessionCookie on auth init.
 *
 * Secure flow:
 *   1. Read the httpOnly `__session` cookie (a Firebase session cookie)
 *   2. Verify it via Firebase Admin (`verifySessionCookie`)
 *   3. Look up the Prisma user by `firebaseUid`
 *   4. Return the Prisma user ID
 *
 * Returns `null` if authentication cannot be verified (no cookie, invalid/
 * expired cookie, user not found, or dev mode without Firebase).
 */
/** Warn once per process, not once per request. */
let warnedNoPasswordGate = false;

/**
 * Resolve (creating on first use) the implicit owner for single-user mode.
 *
 * `firebaseUid` is @unique, so this upsert is atomic — concurrent requests on
 * a cold instance cannot race into two owner rows.
 */
export async function ensureSingleUser(): Promise<string> {
  if (!warnedNoPasswordGate) {
    warnedNoPasswordGate = true;
    console.warn(
      "[auth] SINGLE_USER_MODE is enabled: authentication is disabled and " +
        "anyone who can reach this server has full access to the cellar. Keep " +
        "it on a LAN/VPN (e.g. Tailscale) or behind reverse-proxy auth " +
        "(Authelia, oauth2-proxy). SITE_PASSWORD is a convenience gate, not " +
        "access control — don't rely on it alone."
    );
  }

  const user = await prisma.user.upsert({
    where: { firebaseUid: SINGLE_USER_FIREBASE_UID },
    update: {},
    create: {
      firebaseUid: SINGLE_USER_FIREBASE_UID,
      email: SINGLE_USER_EMAIL,
      displayName: SINGLE_USER_DISPLAY_NAME,
    },
    select: { id: true },
  });
  return user.id;
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  // Single-user mode — no authentication, one implicit local owner.
  // Checked before everything else because it is a deployment-level mode.
  // See src/lib/single-user.ts for the security tradeoff.
  if (isSingleUserMode()) {
    return ensureSingleUser();
  }

  // Dev mode — return dev user ID
  if (isDev) {
    return "dev-user-001";
  }

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value;

    if (!sessionCookie) {
      return null;
    }

    const auth = getAdminAuth();
    if (!auth) {
      return null;
    }

    // verifySessionCookie (not verifyIdToken): the cookie is a long-lived
    // Firebase session cookie minted from the ID token, valid up to 14 days.
    // checkRevoked=false to avoid a Firebase network round-trip on every server
    // action — a deleted account drops out at the Prisma lookup below, and
    // sign-out clears the cookie.
    const decoded = await auth.verifySessionCookie(sessionCookie, false);
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { id: true },
    });

    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve the effective user ID for a server action — STRICTLY from the
 * verified `__session` cookie.
 *
 * The `clientUserId` parameter is kept for call-site compatibility but is NOT
 * trusted: it can only ever be the caller's own id (the server ignores it in
 * favour of the cookie) and a mismatch is logged. This closes the IDOR where
 * any caller could pass another user's id to read/mutate their data — the old
 * fallback that trusted clientUserId when no cookie was present is gone.
 *
 * Requires the __session cookie, which `getUserProfile` establishes on every
 * auth-init before the app exposes `userId`. A request with no valid cookie is
 * Unauthorized.
 */
export async function resolveServerUserId(
  clientUserId?: string | null
): Promise<string> {
  const verifiedId = await getAuthenticatedUserId();

  if (!verifiedId) {
    throw new Error("Unauthorized");
  }

  if (clientUserId && clientUserId !== verifiedId) {
    console.warn(
      `[auth-guard] userId mismatch ignored: client sent "${clientUserId}" but the session resolves to "${verifiedId}".`
    );
  }
  return verifiedId;
}
