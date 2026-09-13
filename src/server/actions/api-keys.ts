"use server";

import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";
import { getAdminAuth } from "@/lib/firebase-admin";
import { getUserTier } from "@/server/tier-check";
import { hasFeature } from "@/lib/tier";
import { logAudit } from "@/server/audit-log";

const MAX_KEYS_PER_USER = 5;

/**
 * Generate a new API key for a user whose tier grants API access.
 * Returns the plaintext key (shown only once).
 */
export async function generateApiKey(
  idToken: string,
  name?: string
): Promise<{ key: string; id: string; prefix: string } | { error: string }> {
  try {
    const decoded = await getAdminAuth()!.verifyIdToken(idToken);
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    });

    if (!user) {
      return { error: "User not found." };
    }

    const tier = await getUserTier(user.id);
    if (!hasFeature(tier, "apiAccess")) {
      return { error: "API access requires Cellar Pro (PREMIUM) subscription." };
    }

    // Check key limit
    const existingCount = await prisma.apiKey.count({
      where: { userId: user.id },
    });

    if (existingCount >= MAX_KEYS_PER_USER) {
      return { error: `Maximum of ${MAX_KEYS_PER_USER} API keys allowed.` };
    }

    // Generate the plaintext key: cd_ + 40 random hex chars
    const randomHex = randomBytes(20).toString("hex"); // 20 bytes = 40 hex chars
    const plaintext = `cd_${randomHex}`;
    const prefix = `cd_${randomHex.slice(0, 8)}...`;

    // Store SHA-256 hash
    const keyHash = createHash("sha256").update(plaintext).digest("hex");

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        name: name || "Default",
        keyHash,
        prefix,
      },
    });

    void logAudit(user.id, "apikey.create", prefix, { name: name || "Default" });

    return { key: plaintext, id: apiKey.id, prefix };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to generate API key.",
    };
  }
}

/**
 * List all API keys for the authenticated user.
 * Never returns the full key or hash.
 */
export async function listApiKeys(
  idToken: string
): Promise<
  | { keys: { id: string; name: string; prefix: string; lastUsed: string | null; createdAt: string }[] }
  | { error: string }
> {
  try {
    const decoded = await getAdminAuth()!.verifyIdToken(idToken);
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    });

    if (!user) {
      return { error: "User not found." };
    }

    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsed: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        lastUsed: k.lastUsed?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      })),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to list API keys.",
    };
  }
}

/**
 * Revoke (delete) an API key.
 */
export async function revokeApiKey(
  idToken: string,
  keyId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await getAdminAuth()!.verifyIdToken(idToken);
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    });

    if (!user) {
      return { success: false, error: "User not found." };
    }

    // Verify the key belongs to this user
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId: user.id },
    });

    if (!apiKey) {
      return { success: false, error: "API key not found." };
    }

    await prisma.apiKey.delete({
      where: { id: keyId },
    });

    void logAudit(user.id, "apikey.delete", apiKey.prefix, { name: apiKey.name });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to revoke API key.",
    };
  }
}
