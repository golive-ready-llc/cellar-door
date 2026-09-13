/**
 * Demo-mode helpers (server side).
 *
 * The `/demo` route sets a `demo_mode=true` cookie so visitors can browse a
 * seeded sample cellar without an account. This module centralises the
 * server-side detection and enforcement:
 *
 *   - `isDemoRequest()`: true for a demo visitor. Safe in server actions,
 *     route handlers, and server components.
 *   - `assertNotDemo()`: throws a readable error when a mutation is attempted
 *     in demo mode, so demo visitors can browse but not write.
 *   - `clearDemoCookies()`: removes both demo cookies. Called when a real
 *     session is established.
 *
 * The browser-side equivalent is `@/lib/demo-state`.
 */

import { cookies } from "next/headers";

export const DEMO_COOKIE = "demo_mode";
/** httpOnly companion set by /api/demo; lets the site gate admit demo visitors. */
export const DEMO_SESSION_COOKIE = "demo_session";
/** The Firebase session cookie that authenticates a signed-in user. */
const SESSION_COOKIE = "__session";

/**
 * True when the current request is a demo-mode visitor.
 *
 * A demo cookie next to a *valid* session is a signed-in user with a cookie
 * left over from a /demo visit, so it is not a demo request. Trusting the demo
 * cookie alone put signed-in owners into demo mode: every write was refused as
 * read-only and chat gave canned demo replies.
 *
 * Only a session that verifies counts. A session cookie that doesn't (expired,
 * or left behind by a sign-out that didn't clear it) stays a demo request;
 * treating its mere presence as signed-in turned demo visitors' AI calls into
 * "Unauthorized" errors instead of demo results.
 */
export async function isDemoRequest(): Promise<boolean> {
  try {
    const store = await cookies();
    if (store.get(DEMO_COOKIE)?.value !== "true") return false;
    if (!store.get(SESSION_COOKIE)?.value) return true;
    // Loaded lazily: auth-guard pulls in Firebase Admin and Prisma, which
    // demo-only callers never need.
    const { getAuthenticatedUserId } = await import("@/server/auth-guard");
    return !(await getAuthenticatedUserId());
  } catch {
    // cookies() isn't available in every context (e.g. static rendering)
    return false;
  }
}

/** Remove both demo cookies from a request's cookie store. */
export function clearDemoCookies(store: { delete(name: string): unknown }): void {
  store.delete(DEMO_COOKIE);
  store.delete(DEMO_SESSION_COOKIE);
}

/**
 * Throws a user-friendly error when called in demo mode. Use at the top of
 * any mutation server action:
 *
 *   await assertNotDemo("add wines");
 */
export async function assertNotDemo(action: string = "do this"): Promise<void> {
  if (await isDemoRequest()) {
    throw new Error(
      `Demo mode is read-only. Sign up to ${action} with your own account.`
    );
  }
}
