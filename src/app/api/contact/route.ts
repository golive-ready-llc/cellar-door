import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Public contact endpoint for the landing page — lets visitors reach us
 * without exposing an email address to scrapers.
 *
 * Delivery is Microsoft Graph sendMail under an app registration
 * (client-credentials, Mail.Send) — the same mechanism goliveready.com uses,
 * so no third-party email provider (Resend/SMTP) is needed. Graph also removes
 * the header-injection surface: the message is a JSON document, not a header
 * block, so a name like "x\nBcc: victim@example.com" is just text in a string.
 *
 * The submission is ALSO written to the server log every time, so nothing is
 * lost even before Graph is configured (or if a send fails).
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

/**
 * A client-credentials token for Graph. Fetched per submission — at contact-
 * form volume a token cache would be complexity defending against nothing.
 */
async function graphToken(tenant: string, clientId: string, secret: string): Promise<string | null> {
  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: secret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!res.ok) return null;
  const data: unknown = await res.json();
  const token = (data as { access_token?: unknown }).access_token;
  return typeof token === "string" ? token : null;
}

/** Send the contact note via Graph. Returns true on success. */
async function sendViaGraph(name: string, email: string, message: string): Promise<boolean> {
  const tenant = process.env.GRAPH_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const secret = process.env.GRAPH_CLIENT_SECRET;
  const sender = process.env.GRAPH_SENDER;
  if (!tenant || !clientId || !secret || !sender) return false;

  const token = await graphToken(tenant, clientId, secret);
  if (!token) {
    console.error("[contact] Graph token request failed");
    return false;
  }

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: `Contact — Cellar Door (${name})`,
          body: {
            contentType: "Text",
            content: [`Name: ${name}`, `Email: ${email}`, "", message].join("\n"),
          },
          toRecipients: [
            { emailAddress: { address: process.env.CONTACT_EMAIL || sender } },
          ],
          replyTo: [{ emailAddress: { address: email } }],
        },
        saveToSentItems: false,
      }),
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!res.ok) {
    console.error("[contact] Graph sendMail failed", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

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

  // Best-effort email delivery via Graph. Never fail the request on a send
  // error — the message is already logged, so we don't lose it.
  try {
    await sendViaGraph(name, email, message);
  } catch (err) {
    console.error("[contact] email send error", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ ok: true });
}
