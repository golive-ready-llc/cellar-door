/**
 * Auth handoff between /login → /cellar.
 *
 * Problem: Firefox's tracking protection sometimes prevents Firebase's
 * onAuthStateChanged from firing in the main window after signInWithPopup
 * resolves (the auth iframe's postMessage handshake is blocked by third-
 * party cookie restrictions). Result: even though signInWithGoogle returned
 * a UserCredential, the AuthProvider's listener never gets the user, so
 * (app)/layout sees user=null and bounces back to /login.
 *
 * Mitigation: the login/signup pages set a sessionStorage marker right
 * before navigating. The (app)/layout reads it and treats user=null as
 * "still handing off" (showing a skeleton, not redirecting) for up to
 * JUST_SIGNED_IN_TTL_MS. Once the AuthProvider listener catches up (or
 * the user proves authenticated some other way) the marker is cleared.
 *
 * Race-free: doesn't depend on debounce timing. If Firefox is slow, we
 * show the skeleton longer. If onAuthStateChanged never fires at all, the
 * marker eventually expires and the user is sent to /login — but that
 * window is long enough (10s) that the user will see the cellar render
 * once Firebase eventually catches up.
 */
export const JUST_SIGNED_IN_KEY = "cd-just-signed-in";
/**
 * 30 seconds. The marker is set immediately before router.push("/cellar")
 * — in real flows, the layout mounts ~200-500ms later. 30s is a generous
 * margin that covers slow networks, Firefox tracking-protection-induced
 * Firebase reconciliation delays, and slow device cold starts. Still
 * tight enough that a genuine signed-out user clicking back into /cellar
 * won't be left staring at a skeleton for more than half a minute.
 */
export const JUST_SIGNED_IN_TTL_MS = 30_000;

/** Mark that the user just completed a sign-in. Call from login/signup pages BEFORE router.push. */
export function markJustSignedIn(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(JUST_SIGNED_IN_KEY, Date.now().toString());
  } catch {
    // sessionStorage can throw in private browsing modes — degrade gracefully
  }
}

/** Returns true if a sign-in marker exists and is still within TTL. */
export function isJustSignedIn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.sessionStorage.getItem(JUST_SIGNED_IN_KEY);
    if (!v) return false;
    const age = Date.now() - parseInt(v, 10);
    return age >= 0 && age < JUST_SIGNED_IN_TTL_MS;
  } catch {
    return false;
  }
}

/** Clear the marker (call once auth is confirmed). */
export function clearJustSignedIn(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(JUST_SIGNED_IN_KEY);
  } catch {
    // ignore
  }
}
