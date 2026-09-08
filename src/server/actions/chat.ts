"use server";

import { getAIProvider, isAIAvailable } from "@/lib/ai";
import { buildCellarContext, type CellarSummaryWine } from "@/lib/ai/context";
import { requireFeature, reserveAiCredits, TierError } from "@/server/tier-check";
import { resolveServerUserId } from "@/server/auth-guard";
import { isDemoRequest } from "@/lib/demo";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are CellarChat, a friendly and knowledgeable AI sommelier assistant for the Cellar Door wine cellar app. You have access to the user's full wine collection data.

Your expertise includes:
- Wine recommendations based on occasions, food pairings, and preferences
- Answering questions about specific wines in the cellar
- Providing tasting guidance and serving suggestions
- Suggesting which wines to drink now vs. hold
- Offering food pairing advice
- Helping with cellar organization

Be conversational, helpful, and enthusiastic about wine. Keep responses concise (2-4 sentences usually). Use your knowledge of the user's actual collection to give specific, personalized advice.

When recommending wines, always reference wines that are actually in the user's cellar by name.

IMPORTANT: When mentioning a specific wine from the user's cellar, wrap the wine name in double brackets like this: [[Wine Name]]. For example: "I'd recommend the [[Catena Zapata Malbec]] tonight." Only use brackets for wines that are actually in the user's collection.`;

/**
 * Send a message to CellarChat and get a response.
 * Requires PRO+ tier (cellarChat feature).
 *
 * Uses the configured AI provider's chat method (not JSON, free-text)
 * via the ProviderRouter, so the configured text provider handles all
 * chat conversations with proper failover.
 *
 * NOTE: The outer wrapper catches ANY unexpected error (including
 * serialization issues at the server-action boundary) and returns a
 * clean error object instead of letting the component crash.
 */
export async function chatWithSommelier(
  messages: ChatMessage[],
  wines: CellarSummaryWine[],
  _userId?: string
): Promise<{ success: true; message: string; isMock: boolean } | { success: false; error: string; code?: string }> {
  try {
    return await chatWithSommelierImpl(messages, wines, _userId);
  } catch (fatal) {
    const msg = fatal instanceof Error ? `${fatal.name}: ${fatal.message}` : String(fatal);
    console.error("[Chat Fatal]", msg, fatal);
    return { success: false, error: msg };
  }
}

async function chatWithSommelierImpl(
  messages: ChatMessage[],
  wines: CellarSummaryWine[],
  _userId?: string
): Promise<{ success: true; message: string; isMock: boolean } | { success: false; error: string; code?: string }> {
  // Reservation held outside the try so a thrown AI call can refund.
  let reservation: Awaited<ReturnType<typeof reserveAiCredits>> | null = null;
  try {
    // Server-side tier + credit check — cellarChat requires PRO+.
    const isDemo = await isDemoRequest();
    const userId = isDemo ? null : await resolveServerUserId(_userId);
    if (!isDemo) {
      if (!userId) {
        return { success: false, error: "Unauthorized" };
      }
      await requireFeature(userId, "cellarChat");
      reservation = await reserveAiCredits(userId, "chat", 1);
      if (!reservation.ok) {
        throw new TierError("CREDITS_EXHAUSTED", reservation.tier, reservation.message);
      }
    }

    const provider = await getAIProvider();
    const cellarContext = buildCellarContext(wines);

    // Build the full prompt from system context + cellar data + conversation history.
    // The provider's chat() method handles the actual text generation.
    const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n${cellarContext}`;

    // Wrap the provider call in a try/catch to handle non-serializable errors
    // from the AI SDK (e.g. Google's client can throw opaque objects).
    let responseText: string;
    try {
      responseText = await provider.chat(fullSystemPrompt, messages);
    } catch (providerErr) {
      const msg = providerErr instanceof Error ? providerErr.message : String(providerErr);
      console.error("[Chat Provider Error]", msg);
      return { success: false, error: msg };
    }

    return {
      success: true,
      message: responseText,
      // Report the real state — getAIProvider() returns the mock provider when
      // no real AI is configured, so don't hardcode false (matches ai.ts).
      isMock: !(await isAIAvailable()),
    };
  } catch (err) {
    if (reservation?.ok) {
      await reservation.refundOnFailure().catch((e) =>
        console.error("[Chat credit refund failed]", e)
      );
    }
    if (err instanceof TierError) {
      return { success: false, error: err.message, code: err.code };
    }
    const raw = err instanceof Error ? err.message : "Chat failed";
    console.error("[Chat Error]", raw);
    return { success: false, error: raw };
  }
}
