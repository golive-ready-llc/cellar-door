/**
 * Cloudflare Turnstile server-side verification.
 *
 * Privacy-friendly bot control for the public forms (signup, contact). The
 * client renders a Turnstile widget and sends its token; the server verifies
 * the token here against Cloudflare before trusting the submission.
 *
 * Rollout-safe: when TURNSTILE_SECRET_KEY isn't set, verification is skipped
 * (returns true) so the app works before Turnstile is provisioned. Once the
 * secret is set, a missing or invalid token fails.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** True once the server secret is configured (so callers can require a token). */
export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured yet — don't block real users
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Network/timeout — fail closed (a configured secret means we want the gate).
    return false;
  }
}
