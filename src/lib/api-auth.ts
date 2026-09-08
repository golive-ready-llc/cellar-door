import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getUserTier } from "@/server/tier-check";

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

  // Verify PREMIUM tier — go through getUserTier so the DEFAULT_TIER_FLOOR
  // env-var override is honored consistently with the rest of the server
  // tier checks. Reading apiKey.user.tier directly would skip the floor.
  const effectiveTier = await getUserTier(apiKey.user.id);
  if (effectiveTier !== "PREMIUM") {
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
