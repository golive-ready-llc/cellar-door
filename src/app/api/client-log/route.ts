import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Client-side error sink. The mobile app / phone browsers hit bugs we can't
 * reproduce at a desk; this lands their console errors in the server
 * (Vercel) logs as structured lines, with no external service required.
 *
 * Unauthenticated by design (errors often happen before/without auth), so
 * it is strictly bounded: tiny payload cap, no storage, log-only.
 */
const MAX_BODY = 4_000; // chars — enough for message + trimmed stack

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) {
      return NextResponse.json({ ok: false }, { status: 413 });
    }
    const body = JSON.parse(raw) as {
      message?: string;
      stack?: string;
      path?: string;
      source?: string;
    };
    const ua = request.headers.get("user-agent") ?? "";
    console.error(
      `[client-error] source=${(body.source || "window").slice(0, 40)} path=${(body.path || "").slice(0, 200)} ua="${ua.slice(0, 120)}" — ${(body.message || "").slice(0, 500)}${body.stack ? `\n${body.stack.slice(0, 1500)}` : ""}`
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
