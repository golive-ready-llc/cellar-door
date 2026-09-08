import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Public contact endpoint for the landing page — lets visitors reach us
 * without exposing an email address to scrapers.
 *
 * Delivery: if RESEND_API_KEY is set, the message is emailed (via Resend's REST
 * API — no SDK dependency) to CONTACT_EMAIL (default support@email242.com).
 * The submission is ALSO written to the server log every time, so nothing is
 * lost even before an email provider is configured.
 *
 * Bounded and abuse-resistant: honeypot field, per-IP rate limit, size caps.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE = 4000;

// Simple in-memory per-IP rate limit (5 / 10 min). Fine for this low-volume
// endpoint; a multi-instance deploy would use a shared store.
const MAX_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

/** Collapse CR/LF so a submitter can't forge extra log lines. */
const oneLine = (s: string, n = 500) => s.replace(/[\r\n]+/g, " ").slice(0, n);

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "global";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "Too many messages — please try again later." }, { status: 429 });
  }

  let body: { name?: unknown; email?: unknown; message?: unknown; website?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: real users never fill this hidden field. Pretend success.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const name = String(body.name ?? "").trim().slice(0, 200);
  const email = String(body.email ?? "").trim().slice(0, 320);
  const message = String(body.message ?? "").trim().slice(0, MAX_MESSAGE);

  if (!name) return NextResponse.json({ ok: false, error: "Please tell us your name." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
  if (message.length < 2) return NextResponse.json({ ok: false, error: "Please enter a message." }, { status: 400 });

  // Always log the submission (durable-enough fallback + record).
  console.log(`[contact] name=${oneLine(name, 200)} email=${oneLine(email, 320)} — ${oneLine(message, 2000)}`);

  // Email it if a provider is configured.
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.CONTACT_FROM || "Cellar Door <onboarding@resend.dev>",
          to: [process.env.CONTACT_EMAIL || "support@email242.com"],
          reply_to: email,
          subject: `Contact form — ${oneLine(name, 100)}`,
          text: `From: ${name} <${email}>\n\n${message}`,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.error("[contact] email send failed", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[contact] email send error", err instanceof Error ? err.message : err);
    }
  }

  // Succeed regardless of email delivery — the message is logged either way.
  return NextResponse.json({ ok: true });
}
