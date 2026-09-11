import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Site-wide password gate for development/preview.
 * Set SITE_PASSWORD env var to enable. Remove it to disable.
 * When enabled, ALL pages require the password — only the gate page,
 * essential API routes, legitimate crawlers, and verification files
 * are excluded.
 */

// User agents we let through so they can crawl / verify the site.
// These are legitimate bots Google, AdSense, Bing, etc. use — blocking
// them breaks AdSense approval, SEO, and social unfurls.
const BOT_UA_PATTERNS = [
  /Googlebot/i,
  /AdsBot-Google/i,        // AdSense crawler
  /Mediapartners-Google/i, // AdSense content crawler
  /bingbot/i,
  /DuckDuckBot/i,
  /Slackbot/i,             // link unfurls
  /Twitterbot/i,
  /facebookexternalhit/i,
  /LinkedInBot/i,
  /WhatsApp/i,
  /Discordbot/i,
  /TelegramBot/i,
  /AhrefsBot/i,
  /SemrushBot/i,
];

// Paths that are always public so verification tools + crawlers can
// reach them (AdSense ads.txt, robots, sitemap, favicons).
const PUBLIC_PATHS = new Set<string>([
  "/gate",
  "/api/gate",
  "/api/stripe/webhook",
  "/ads.txt",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/manifest.json",
]);

// Public path PREFIXES — anything that starts with one of these is
// treated as public (crawlable + indexable). Used for routes that have
// dynamic segments like /blog/[slug] where we can't enumerate every
// path in PUBLIC_PATHS.
const PUBLIC_PATH_PREFIXES = [
  "/blog",        // marketing blog: index + every article
  "/restaurants", // B2B landing page — must stay crawlable + shareable
  "/__",          // proxied Firebase auth helper (same-origin auth)
];

export function middleware(request: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD;

  // No password set → site is open
  if (!sitePassword) return NextResponse.next();

  // Explicit public paths (AdSense verification, robots, etc.)
  if (PUBLIC_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  // Public prefixes (blog index + every blog article)
  if (PUBLIC_PATH_PREFIXES.some((prefix) =>
    request.nextUrl.pathname === prefix ||
    request.nextUrl.pathname.startsWith(prefix + "/")
  )) {
    return NextResponse.next();
  }

  // Crawler / bot bypass — legitimate indexing + ad-verification traffic.
  // This is cosmetic-only protection (anyone can spoof UA), but it's
  // intentional: the gate keeps curious humans out, while letting real
  // bots verify the site.
  const ua = request.headers.get("user-agent") || "";
  if (ua && BOT_UA_PATTERNS.some((rx) => rx.test(ua))) {
    return NextResponse.next();
  }

  // Check cookies — password-gate cookie OR demo session both grant access.
  // Audit fix #18: demo_session is the dedicated httpOnly cookie issued by
  // /api/demo (separate from the 30-day site_access cookie). demo_mode is
  // kept for backward compatibility with already-issued client cookies.
  const granted = request.cookies.get("site_access")?.value;
  if (granted === "granted") return NextResponse.next();
  const demoSession = request.cookies.get("demo_session")?.value;
  if (demoSession === "granted") return NextResponse.next();
  const demoMode = request.cookies.get("demo_mode")?.value;
  if (demoMode === "true") return NextResponse.next();

  // Redirect to gate
  const gateUrl = new URL("/gate", request.url);
  gateUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(gateUrl);
}

export const config = {
  // Match all routes except static files and Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\.png$|.*\.svg$).*)"],
};
