import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai";
import { MockAIProvider } from "@/lib/ai/mock";
import type { AIProvider } from "@/lib/ai/provider";
import { buildCellarContext, type CellarSummaryWine } from "@/lib/ai/context";
import { CELLAR_CHAT_SYSTEM_PROMPT, CHAT_STREAM_ERROR } from "@/lib/ai/chat-prompt";
import { getAuthenticatedUserId } from "@/server/auth-guard";
import { isDemoRequest } from "@/lib/demo";
import { requireFeature, reserveAiCredits, TierError } from "@/server/tier-check";

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 50;
const MAX_MESSAGE_CHARS = 8000;
const MAX_WINES = 3000;

function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: ChatMessage[] = [];
  // The client sends the whole thread on every turn, so rejecting an over-long
  // history (or an over-long message) used to wedge the conversation for good
  // once it crossed the cap — every later turn resent the same rejected body.
  // Keep the newest window instead: the model only needs the recent turns, and
  // the bounds still cap what reaches it.
  for (const item of value.slice(-MAX_MESSAGES)) {
    if (!item || typeof item !== "object") return null;
    const { role, content } = item as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    out.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) });
  }
  return out;
}

async function* replyChunks(
  provider: AIProvider,
  system: string,
  messages: ChatMessage[]
): AsyncGenerator<string> {
  if (provider.chatStream) {
    yield* provider.chatStream(system, messages);
  } else {
    yield await provider.chat(system, messages);
  }
}

/**
 * POST /api/chat — CellarChat with a streamed reply, so text appears as the
 * model writes it instead of after the whole answer (often 5-20 seconds).
 *
 * Same gates as the chatWithSommelier server action: a session, the
 * cellarChat feature, and one reserved AI credit, refunded if the model fails
 * before producing any text. Demo visitors get the canned mock provider.
 */
export async function POST(request: Request) {
  let body: { messages?: unknown; wines?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const messages = parseMessages(body.messages);
  if (!messages) return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
  const wines = (Array.isArray(body.wines) ? body.wines.slice(0, MAX_WINES) : []) as CellarSummaryWine[];

  const isDemo = await isDemoRequest();
  let refund: (() => Promise<void>) | null = null;
  if (!isDemo) {
    const userId = await getAuthenticatedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      await requireFeature(userId, "cellarChat");
    } catch (err) {
      if (err instanceof TierError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: 403 });
      }
      throw err;
    }
    const reservation = await reserveAiCredits(userId, "chat", 1);
    if (!reservation.ok) {
      return NextResponse.json({ error: reservation.message, code: "CREDITS_EXHAUSTED" }, { status: 402 });
    }
    refund = reservation.refundOnFailure;
  }

  const provider: AIProvider = isDemo ? new MockAIProvider() : await getAIProvider();
  const system = `${CELLAR_CHAT_SYSTEM_PROMPT}\n\n${buildCellarContext(wines)}`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let produced = false;
      try {
        for await (const chunk of replyChunks(provider, system, messages)) {
          if (!chunk) continue;
          produced = true;
          controller.enqueue(encoder.encode(chunk));
        }
        if (!produced) throw new Error("Empty reply");
      } catch (err) {
        console.error("[Chat stream]", err instanceof Error ? err.message : err);
        if (!produced) {
          if (refund) {
            await refund().catch((e) => console.error("[Chat credit refund failed]", e));
          }
          controller.enqueue(encoder.encode(CHAT_STREAM_ERROR));
        } else {
          controller.enqueue(encoder.encode("\n\n(The reply was cut off. Please try again.)"));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
