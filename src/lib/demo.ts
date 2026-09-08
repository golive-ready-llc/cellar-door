/**
 * Demo-mode helpers.
 *
 * The `/demo` route sets a `demo_mode=true` cookie so the app can render
 * an unauthenticated sample experience. This module centralises the
 * detection + enforcement logic:
 *
 *   - `isDemoRequest()`    — true when the current request carries the
 *     demo cookie. Safe in server actions, route handlers, server components.
 *   - `assertNotDemo()`    — throws a human-readable error when a mutation
 *     is attempted in demo mode. Call at the top of any data-mutating
 *     server action so demo visitors can browse but not corrupt real data.
 */

import { cookies } from "next/headers";

export const DEMO_COOKIE = "demo_mode";

/** True when the current request is a demo-mode visitor. */
export async function isDemoRequest(): Promise<boolean> {
  try {
    const store = await cookies();
    return store.get(DEMO_COOKIE)?.value === "true";
  } catch {
    // cookies() isn't available in every context (e.g. static rendering)
    return false;
  }
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
