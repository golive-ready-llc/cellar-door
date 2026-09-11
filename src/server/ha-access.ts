/**
 * Access resolution for the Home Assistant sensor endpoints.
 *
 * Both /api/ha-sensor and /api/ha-sensor/history must answer the same questions
 * before reading a sensor: is the caller's Firebase token valid, does their tier
 * cover sensors, and which wall's connection should we use. Keeping that here
 * means the two endpoints cannot drift apart on who may read what.
 *
 * NOTE: No "use server" directive — this is a utility module imported by route
 * handlers, not a server action file.
 */

import type { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { prisma } from "@/lib/db";
import { hasFeature } from "@/lib/tier";
import { getUserTier } from "@/server/tier-check";
import { decrypt } from "@/lib/encryption";
import { validateHaUrl } from "@/lib/ssrf-guard";

/**
 * The stored shape of `Wall.haConfig`. The client-facing projection in
 * types/wine.ts swaps `encryptedToken` for `hasToken` — the token itself never
 * leaves the server.
 */
export interface StoredHaConfig {
  haUrl: string;
  encryptedToken: string;
  tempEntityId?: string;
  humidityEntityId?: string;
}

export type HaAccessFailureReason =
  | "unauthorized"
  | "auth-unconfigured"
  | "upgrade-required"
  | "wall-not-found"
  | "no-sensor-configured"
  | "url-rejected";

/** A request that did not earn access. Callers answer with `status`/`error`. */
export interface HaAccessFailure {
  ok: false;
  status: number;
  error: string;
  reason: HaAccessFailureReason;
}

export type HaCaller = { ok: true; userId: string } | HaAccessFailure;

export type HaWallAccess =
  | { ok: true; config: StoredHaConfig; token: string; haUrl: string }
  | HaAccessFailure;

/**
 * Verify the request's Firebase ID token and the caller's `haSensors`
 * entitlement. Identity comes from the verified token only.
 *
 * A token that fails verification throws, so the caller's error handling runs
 * rather than this returning a misleading denial.
 */
export async function authenticateHaRequest(
  request: NextRequest
): Promise<HaCaller> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Unauthorized", reason: "unauthorized" };
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return {
      ok: false,
      status: 500,
      error: "Auth not configured",
      reason: "auth-unconfigured",
    };
  }

  const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));

  const user = await prisma.user.findUnique({
    where: { firebaseUid: decoded.uid },
    select: { id: true },
  });
  // getUserTier combines the DB tier with the NEXT_PUBLIC_DEFAULT_TIER floor, so a
  // self-hosted instance that promises all features keeps that promise.
  if (!user || !hasFeature(await getUserTier(user.id), "haSensors")) {
    return {
      ok: false,
      status: 403,
      error: "Cellar Pro required",
      reason: "upgrade-required",
    };
  }

  return { ok: true, userId: user.id };
}

/**
 * Load an owned wall, decrypt its token, and confirm its stored Home Assistant
 * URL is one we are willing to fetch. The URL check runs here so a wall pointing
 * at a private address fails before the route starts any work; each individual
 * fetch validates again, which is what makes the guard rebind-resistant.
 */
export async function resolveHaWall(
  userId: string,
  wallId: string
): Promise<HaWallAccess> {
  const wall = await prisma.wall.findFirst({ where: { id: wallId, userId } });
  if (!wall) {
    return { ok: false, status: 404, error: "Wall not found", reason: "wall-not-found" };
  }

  const config = wall.haConfig as StoredHaConfig | null;
  if (!config?.encryptedToken || !config?.haUrl) {
    return {
      ok: false,
      status: 404,
      error: "No sensor configured",
      reason: "no-sensor-configured",
    };
  }

  const token = decrypt(config.encryptedToken);
  const haUrl = config.haUrl;

  try {
    await validateHaUrl(haUrl);
  } catch (e) {
    console.error(
      "HA URL validation error:",
      e instanceof Error ? e.message : "rejected"
    );
    return {
      ok: false,
      status: 400,
      error: "Invalid Home Assistant URL",
      reason: "url-rejected",
    };
  }

  return { ok: true, config, token, haUrl };
}
