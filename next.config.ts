import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Self-contained server bundle for container deploys (`node server.js`).
  // Gated behind DOCKER_BUILD so Vercel builds are completely unaffected —
  // this flag is set only by the Dockerfile.
  ...(process.env.DOCKER_BUILD === "true"
    ? { output: "standalone" as const }
    : {}),
  // Build identity shown at the bottom of Settings ("v<sha> · <env>").
  // Explicit values win, so Docker and self-hosted builds can set their own;
  // on Vercel, fall back to the commit and environment it provides at build
  // time. Without this, production showed "vdev · local".
  env: {
    NEXT_PUBLIC_BUILD_SHA:
      process.env.NEXT_PUBLIC_BUILD_SHA || (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7),
    NEXT_PUBLIC_BUILD_VERSION: process.env.NEXT_PUBLIC_BUILD_VERSION || process.env.VERCEL_ENV || "",
  },
  typescript: {
    // Skip type checking during build — existing type issues to fix incrementally
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      // Allow up to 8MB for label scan / wine list extraction (base64 images)
      bodySizeLimit: "8mb",
    },
    // Client router cache. Next defaults dynamic to 0, so EVERY tab switch
    // refetched the route's RSC payload from Vercel — a full network round
    // trip (~1s on mobile) even though all app views are client components
    // whose data comes from the lib/data read cache anyway. 5 minutes of
    // client-side route reuse makes tab switches instant; fresh data still
    // arrives via the pages' own fetch + cache invalidation on mutations.
    staleTimes: {
      dynamic: 300,
      static: 300,
    },
  },
  async rewrites() {
    // Same-origin Firebase auth helper: proxy /__/* (auth iframe, popup
    // handler, init.json) to the project's firebaseapp.com so privacy-
    // hardened browsers (LibreWolf, Brave strict, Safari ITP) never touch
    // a third-party auth origin. Inert until the client actually points
    // authDomain at our host (NEXT_PUBLIC_AUTH_SAME_ORIGIN=true — see
    // src/lib/firebase.ts resolveAuthDomain).
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    if (!authDomain) return [];
    return [
      {
        source: "/__/:path*",
        destination: `https://${authDomain}/__/:path*`,
      },
    ];
  },
  async headers() {
    // ROOT CAUSE of the "first Google login attempt fails, second works" bug:
    // Modern Chrome/Firefox enforce a default COOP that severs the opener
    // ↔ popup relationship for cross-origin popups. Firebase's signInWithPopup
    // opens a popup at cellar-door-3bbeb.firebaseapp.com (cross-origin), and
    // after OAuth completes the popup tries to close itself via window.close().
    // With the default COOP, that call is blocked — the popup stays open,
    // Firebase's internal polling thinks the user is still interacting,
    // eventually times out or throws auth/popup-closed-by-user, which our
    // login page silently suppresses (intentional — real cancellations
    // shouldn't surface as errors). Result: user is left on /login with no
    // visible feedback. Reproducible diagnostic in chunks/0muwp3fan5dpi.js:15
    // "Cross-Origin-Opener-Policy policy would block the window.close call."
    //
    // The fix is the documented Firebase Auth workaround: set COOP to
    // `same-origin-allow-popups`. It keeps the same-origin isolation
    // benefits of the default policy but EXPLICITLY preserves the opener
    // relationship for popups, so window.close() works and Firebase's
    // postMessage handshake completes normally.
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
          // Baseline CSP: no plugins, no <base> hijacking, no framing by other
          // sites. Scripts aren't restricted yet (AdSense, Firebase, Stripe
          // and Turnstile all load third-party code).
          {
            key: "Content-Security-Policy",
            value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
          },
        ],
      },
      // The proxied Firebase auth helper embeds /__/auth/iframe in a hidden
      // iframe on our own pages — the global X-Frame-Options: DENY above
      // would break it. Later matching rules win for duplicate keys, so
      // relax to SAMEORIGIN for the auth helper paths only.
      {
        source: "/__/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Content-Security-Policy",
            value: "base-uri 'self'; object-src 'none'; frame-ancestors 'self'",
          },
        ],
      },
    ];
  },
};

// Only wrap with Sentry when the DSN is set — keeps local builds fast
// and avoids needing Sentry credentials for casual contributors.
const sentryEnabled = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      silent: true,
      // Org + project slugs — Sentry uses these to upload source maps
      // during Vercel builds so errors in the dashboard resolve to
      // original source lines instead of minified `chunks/abc.js:1:5234`
      // gibberish. Source-map upload only fires when SENTRY_AUTH_TOKEN
      // is present in the build env (auto-detected by the SDK), so
      // local dev builds don't try to push.
      org: "golive-ready-llc",
      project: "cellar-door",
      // Strip source maps from the public output — Vercel still uploads
      // them to Sentry during build, but they're not served to browsers.
      // Without this, anyone could fetch your source maps + read your
      // un-minified code.
      sourcemaps: {
        deleteSourcemapsAfterUpload: true,
      },
      // Skip Sentry's tunnel route — would proxy events through our own
      // domain to bypass ad blockers, but adds Vercel function invocations
      // we don't need at this scale. Re-enable later if ad-blocker drop
      // rate becomes a problem.
      tunnelRoute: undefined,
      // Drop the Sentry SDK's own logger calls from the client bundle
      // (a few KB savings).
      disableLogger: true,
    })
  : nextConfig;
