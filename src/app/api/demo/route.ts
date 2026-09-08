import { NextRequest, NextResponse } from "next/server";

/**
 * Demo mode entry point.
 * Sets cookies server-side BEFORE the redirect, so the AuthProvider
 * sees the demo_mode cookie on its very first useEffect run.
 */
export async function GET(request: NextRequest) {
  const url = new URL("/cellar", request.url);
  const response = NextResponse.redirect(url);
  // Client-readable: AuthProvider checks document.cookie for this on first run.
  response.cookies.set("demo_mode", "true", {
    path: "/",
    maxAge: 3600, // 1 hour
    sameSite: "lax",
    secure: true,
  });
  // Audit fix #18: do NOT issue the password-gate cookie ("site_access") here.
  // Instead use a dedicated demo_session cookie that middleware honors as a
  // gate bypass. This prevents /api/demo from being a no-auth backdoor that
  // grants the same 30-day cookie the password gate issues.
  response.cookies.set("demo_session", "granted", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h
  });
  return response;
}
