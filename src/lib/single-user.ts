/**
 * Single-user mode — for self-hosted personal instances.
 *
 * Cellar Door normally authenticates every request against Firebase. That is
 * the right model for the hosted multi-tenant service, but it is a hard
 * dependency on a Google cloud service, which defeats the point of a
 * self-contained deployment.
 *
 * When `NEXT_PUBLIC_SINGLE_USER_MODE=true`, the app skips authentication
 * entirely and treats every request as coming from one implicit local owner.
 * There is no sign-in, no Firebase project, and no external dependency.
 *
 * ─── SECURITY ────────────────────────────────────────────────────────────
 * This removes authentication. ANYONE who can reach the server is the owner
 * and can read and modify the entire cellar. It is appropriate for:
 *
 *   * a personal instance on your LAN or behind a VPN/Tailscale
 *   * an instance behind SITE_PASSWORD
 *   * an instance behind your own reverse-proxy auth (Authelia, oauth2-proxy)
 *
 * It is NOT appropriate for anything exposed to the open internet without one
 * of those in front of it. The mode is opt-in and off by default; when it is
 * enabled without SITE_PASSWORD the server logs a startup warning.
 *
 * Multi-user instances should leave this unset and use Firebase.
 */

/** Sentinel identity for the implicit local owner. Stored in User.firebaseUid,
 *  which is @unique — so find-or-create is a single atomic upsert. */
export const SINGLE_USER_FIREBASE_UID = "single-user-mode-owner";

/** Placeholder address. Never emailed; the column is just non-nullable. */
export const SINGLE_USER_EMAIL = "owner@localhost";

export const SINGLE_USER_DISPLAY_NAME = "Cellar Owner";

/**
 * Whether the deployment is running without authentication.
 *
 * Deliberately a NEXT_PUBLIC_ var so the same flag is readable by both the
 * browser (to skip the sign-in flow) and the server (to resolve the owner).
 * It is a deployment mode, not a secret.
 *
 * NOTE: NEXT_PUBLIC_ values are inlined into the client bundle at BUILD time,
 * so in Docker this must be passed as a build arg, not just an env var.
 */
export function isSingleUserMode(): boolean {
  return process.env.NEXT_PUBLIC_SINGLE_USER_MODE === "true";
}
