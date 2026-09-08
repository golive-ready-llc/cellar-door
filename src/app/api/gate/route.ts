import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time compare (SHA-256 → fixed length, no early-exit length leak). */
function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// Audit fix #19: simple in-memory IP rate limit to prevent brute-force of the
// 30-day password gate. Acceptable for this low-traffic endpoint; for prod
// scale we'd use Upstash/Redis, but the gate sees rare traffic.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "global";
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}

/** Purge expired entries from the rate-limit Map to prevent unbounded growth. */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (entry.resetAt < now) attempts.delete(key);
  }
}

// Periodic cleanup — every 15 minutes, remove stale entries so the Map
// never grows forever under sustained traffic. In serverless environments
// the interval is harmless (the runtime is frozen after the response).
setInterval(cleanupExpiredEntries, WINDOW_MS);

export async function POST(request: NextRequest) {
  const key = clientKey(request);
  if (!checkRateLimit(key)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  // Malformed JSON is a client error (400), not a server crash (500).
  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const password = body?.password;
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword || typeof password !== "string" || !constantTimeEqual(password, sitePassword)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("site_access", "granted", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return response;
}
