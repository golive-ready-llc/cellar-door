"use server";

import { headers } from "next/headers";
import { verifyTurnstile } from "@/lib/turnstile";

/**
 * Server action used by the signup form to verify a Turnstile token before the
 * client proceeds with Firebase account creation. Returns true when the token
 * is valid (or when Turnstile isn't configured yet).
 */
export async function verifyBotToken(token: string | null): Promise<boolean> {
  let ip: string | undefined;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  } catch {
    /* headers unavailable — verify without the IP */
  }
  return verifyTurnstile(token, ip);
}
