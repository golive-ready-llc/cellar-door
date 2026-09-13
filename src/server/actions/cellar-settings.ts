"use server";

/**
 * Per-account cellar settings: whether first-run setup is done, and the
 * cellar's display name.
 *
 * Both used to live only in browser localStorage, so "Name Your Cellar"
 * reappeared on every new device or browser (and whenever a cookie or storage
 * glitch hid the flag), and a name set on one device never showed on another.
 */

import { prisma } from "@/lib/db";
import { resolveServerUserId } from "@/server/auth-guard";
import { assertNotDemo } from "@/lib/demo";

export interface CellarSettings {
  onboarded: boolean;
  cellarName: string;
}

/** Longest cellar name we store; the header truncates long names anyway. */
const MAX_CELLAR_NAME = 60;

/** Read the signed-in user's cellar settings. */
export async function getCellarSettings(clientUserId?: string | null): Promise<CellarSettings> {
  const userId = await resolveServerUserId(clientUserId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardedAt: true, cellarName: true },
  });
  return { onboarded: !!user?.onboardedAt, cellarName: user?.cellarName ?? "" };
}

/**
 * Save the signed-in user's cellar settings. Only the fields given change:
 * `onboarded: true` records setup as done, and `cellarName` is trimmed and
 * capped (an empty name means the default).
 */
export async function saveCellarSettings(
  data: { onboarded?: boolean; cellarName?: string },
  clientUserId?: string | null
): Promise<CellarSettings> {
  await assertNotDemo("change your cellar settings");
  const userId = await resolveServerUserId(clientUserId);

  const update: { onboardedAt?: Date; cellarName?: string } = {};
  if (data.onboarded === true) update.onboardedAt = new Date();
  if (typeof data.cellarName === "string") {
    update.cellarName = data.cellarName.trim().slice(0, MAX_CELLAR_NAME);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: update,
    select: { onboardedAt: true, cellarName: true },
  });
  return { onboarded: !!user.onboardedAt, cellarName: user.cellarName };
}
