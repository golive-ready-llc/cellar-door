/**
 * The public base URL of this instance, without a trailing slash.
 *
 * The hosted service leaves this at the default; self-hosted deployments set
 * `NEXT_PUBLIC_SITE_URL` to their own domain so canonical/OpenGraph tags, the
 * sitemap, robots, and guest-share links point at *their* instance instead of
 * the hosted one. `NEXT_PUBLIC_` so the same value is available to server and
 * client code (inlined at build time).
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://mycellardoor.app"
).replace(/\/+$/, "");
