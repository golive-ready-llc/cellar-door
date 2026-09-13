/**
 * Client-side demo-mode state.
 *
 * The /demo route sets a site-wide `demo_mode` cookie so visitors can browse a
 * seeded sample cellar without signing in. That cookie is only the entry
 * signal. The AuthProvider decides whether the app is actually in demo mode,
 * and a real signed-in session always wins. Everything else (the banner,
 * Settings, the data layer) follows that decision instead of reading the
 * cookie on its own: a cookie left over from an earlier /demo visit used to
 * put a signed-in owner's real account into demo mode, with the demo banner,
 * demo data, and the first-run wizard over their own cellar.
 *
 * Browser-only. The server-side equivalent is `@/lib/demo`.
 */

export const DEMO_COOKIE = "demo_mode";

let demoModeActive = false;

/** True when the browser carries the demo cookie. An entry signal only. */
export function hasDemoCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${DEMO_COOKIE}=true`));
}

/** Remove the demo cookie from the browser. */
export function clearDemoCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/** Called by the AuthProvider once it has chosen between demo mode and a real session. */
export function setDemoModeActive(active: boolean): void {
  demoModeActive = active;
}

/** Whether the app is in demo mode, as decided by the AuthProvider. */
export function isDemoModeActive(): boolean {
  return demoModeActive;
}
