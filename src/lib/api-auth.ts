import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { getAdminAuth } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";
import { getUserTier } from "@/server/tier-check";
import { hasFeature } from "@/lib/tier";

export interface ApiUser {
  id: string;
  email: string;
  tier: string;
}

/** CORS headers for all API v1 responses */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** Return a JSON error response with CORS headers */
export function apiError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: corsHeaders }
  );
}

/** Return a JSON success response with CORS headers */
export function apiSuccess(data: unknown, status: number = 200) {
  return NextResponse.json(
    { data },
    { status, headers: corsHeaders }
  );
}

/**
 * Result of {@link authenticateApiKey} as a true discriminated union, so
 * callers can narrow safely on `.ok` (audit fix #22).
 */
export type AuthResult =
  | { ok: true; user: ApiUser }
  | { ok: false; response: NextResponse };

/**
 * Authenticate an API request using a Bearer token.
 * Parses `Authorization: Bearer cd_xxx`, hashes the key,
 * looks up the ApiKey record, verifies the user is PREMIUM,
 * and updates `lastUsed`.
 *
 * Returns a discriminated union — callers do `if (!result.ok) return result.response;`.
 */
export async function authenticateApiKey(
  request: Request
): Promise<AuthResult> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, response: apiError("Missing or invalid Authorization header. Use: Bearer cd_xxx", 401) };
  }

  const token = authHeader.slice(7).trim();

  if (!token.startsWith("cd_")) {
    return { ok: false, response: apiError("Invalid API key format.", 401) };
  }

  // Hash the provided key
  const keyHash = createHash("sha256").update(token).digest("hex");

  // Look up in DB
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      user: {
        select: { id: true, email: true, tier: true },
      },
    },
  });

  if (!apiKey) {
    return { ok: false, response: apiError("Invalid API key.", 401) };
  }

  // Check expiry
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { ok: false, response: apiError("API key has expired.", 401) };
  }

  // Verify API access — go through getUserTier so the DEFAULT_TIER_FLOOR
  // env-var override is honored consistently with the rest of the server
  // tier checks. Reading apiKey.user.tier directly would skip the floor.
  const effectiveTier = await getUserTier(apiKey.user.id);
  if (!hasFeature(effectiveTier, "apiAccess")) {
    return { ok: false, response: apiError("API access requires an active Cellar Pro (PREMIUM) subscription.", 403) };
  }

  // Update lastUsed (fire-and-forget)
  void prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    })
    .catch(() => {
      // Non-critical — don't block the request
    });

  return {
    ok: true,
    user: {
      id: apiKey.user.id,
      email: apiKey.user.email,
      tier: effectiveTier,
    },
  };
}

/**
 * Result of {@link authenticateIdToken}, shaped like {@link AuthResult} so
 * route handlers narrow on `.ok` the same way.
 */
export type IdTokenResult =
  | { ok: true; uid: string; email: string | null }
  | { ok: false; response: NextResponse };

/**
 * Authenticate a request whose caller is the signed-in browser user rather
 * than an API client: `Authorization: Bearer <Firebase ID token>`.
 *
 * Only the token is verified here. Resolving the Prisma user stays with the
 * route, because the callers select different columns.
 */
export async function authenticateIdToken(
  request: Request
): Promise<IdTokenResult> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, response: apiError("Unauthorized", 401) };
  }

  const auth = getAdminAuth();
  if (!auth) {
    return { ok: false, response: apiError("Auth not configured", 500) };
  }

  try {
    const decoded = await auth.verifyIdToken(authHeader.slice(7).trim());
    return { ok: true, uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    // Expired or forged token — unauthenticated, not a server error.
    return { ok: false, response: apiError("Unauthorized", 401) };
  }
}
