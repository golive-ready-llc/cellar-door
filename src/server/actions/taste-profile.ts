"use server";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { getAIProvider, isAIAvailable } from "@/lib/ai";
import type { TasteProfileResult, TasteProfileBundle } from "@/lib/ai";
import { tasteProfilePrompt } from "@/lib/ai/prompts";
import {
  requireFeature,
  reserveAiCredits,
  TierError,
} from "@/server/tier-check";
import type { AIResult } from "./ai";
import { resolveServerUserId } from "@/server/auth-guard";
import { isDemoRequest } from "@/lib/demo";

/** Canned Flavor Genome for demo visitors — never touches the DB or paid AI. */
const DEMO_TASTE_PROFILE: TasteProfileBundle = {
  all: {
    body: 7, tannin: 6, acidity: 6, sweetness: 3, fruit: 7, oak: 5,
    summary:
      "You lean toward structured, fruit-forward reds with balanced oak, and reach for crisp, aromatic whites as a bright counterpoint.",
  },
  red: {
    body: 8, tannin: 7, acidity: 5, sweetness: 2, fruit: 7, oak: 6,
    summary:
      "Full-bodied, firmly tannic reds are your core — Napa Cabernet, Barolo, and Bordeaux blends sit right in your wheelhouse.",
  },
  white: {
    body: 5, tannin: 2, acidity: 8, sweetness: 4, fruit: 6, oak: 3,
    summary:
      "Bright, high-acid whites with a touch of fruit — think Riesling and unoaked Chardonnay, chosen for freshness over weight.",
  },
};

/**
 * Legacy filter type — kept exported for callers that still import it
 * (e.g. share/preview code). The action no longer accepts it as input.
 */
export type TasteProfileTypeFilter = "all" | "red" | "white";

// Type sets used to bucket wines into the red/white slices. Sparkling/rosé/
// dessert/green bucket into white (more aligned with white character);
// fortified/orange go with reds.
const RED_TYPES = ["red", "fortified", "orange"] as const;
const WHITE_TYPES = ["white", "rosé", "sparkling", "dessert", "green"] as const;

type WineRow = {
  id?: string;
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  grapeVariety: string;
  userRating: number | null;
};

/**
 * Build a stable SHA-256 fingerprint of the input set used to compute the
 * profiles. Same inputs → same fingerprint → cache hit (zero credits, zero
 * AI call). The fields included MUST match what the prompt actually
 * conditions on, otherwise the cache becomes stale silently.
 */
function fingerprint(
  wines: ReadonlyArray<{
    id?: string | null;
    type: string;
    userRating: number | null;
    vintage: number | null;
    name: string;
    winery: string;
  }>,
  history: ReadonlyArray<{
    id: string;
    type: string;
    rating: number | null;
    vintage: number | null;
    name: string;
    winery: string;
  }>
): string {
  const wineKeys = wines
    .map(
      (w) =>
        `W:${w.id ?? `${w.name}|${w.winery}`}:${w.type}:${w.userRating ?? ""}:${w.vintage ?? ""}`
    )
    .sort();
  const histKeys = history
    .map(
      (h) =>
        `H:${h.id}:${h.type}:${h.rating ?? ""}:${h.vintage ?? ""}`
    )
    .sort();
  const joined = [...wineKeys, ...histKeys].join("\n");
  return createHash("sha256").update(joined).digest("hex");
}

function clampProfile(p: TasteProfileResult): TasteProfileResult {
  const axes: (keyof TasteProfileResult)[] = [
    "body",
    "tannin",
    "acidity",
    "sweetness",
    "fruit",
    "oak",
  ];
  const out = { ...p } as TasteProfileResult;
  for (const axis of axes) {
    const val = out[axis] as unknown;
    if (typeof val === "number") {
      (out as unknown as Record<string, unknown>)[axis] = Math.max(
        1,
        Math.min(10, Math.round(val))
      );
    }
  }
  return out;
}

function parseBundle(text: string): TasteProfileBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      parsed = JSON.parse(fenced[1].trim());
    } else {
      const objMatch = text.match(/(\{[\s\S]*\})/);
      if (!objMatch) throw new Error("Could not parse taste profile response");
      parsed = JSON.parse(objMatch[1]);
    }
  }
  const obj = parsed as { all?: TasteProfileResult; red?: TasteProfileResult | null; white?: TasteProfileResult | null };
  if (!obj.all || typeof obj.all !== "object") {
    throw new Error("Taste profile response missing required 'all' slice");
  }
  return {
    all: clampProfile(obj.all),
    red: obj.red ? clampProfile(obj.red) : null,
    white: obj.white ? clampProfile(obj.white) : null,
  };
}

/**
 * Generate the Flavor Genome bundle (all + reds + whites) for a user.
 *
 * One AI pass returns all three slices. Result is cached server-side keyed
 * by a fingerprint of the input set — switching tabs in the UI or signing
 * in on a new device reuses the cache (zero credits) until the user's
 * collection meaningfully changes.
 *
 * @param userId  Optional — falls back to the authenticated server user.
 * @param opts.force  When true, bypass the cache and recompute.
 */
export async function generateTasteProfile(
  userId?: string,
  opts?: { force?: boolean }
): Promise<AIResult<TasteProfileBundle>> {
  // Demo visitors get a canned example — never touch the real DB or paid AI.
  if (await isDemoRequest()) {
    return { success: true, data: DEMO_TASTE_PROFILE, isMock: true };
  }

  // Reservation held outside the try so a thrown AI call can refund.
  let reservation: Awaited<ReturnType<typeof reserveAiCredits>> | null = null;
  try {
    const uid = await resolveServerUserId(userId);
    await requireFeature(uid, "wineEnrichment");

    // Fetch user's wines — prioritize rated, then recent. Cap at 50 for prompt.
    const wines = await prisma.wine.findMany({
      where: { userId: uid },
      select: {
        id: true,
        name: true,
        winery: true,
        vintage: true,
        type: true,
        region: true,
        grapeVariety: true,
        userRating: true,
      },
      orderBy: [
        { userRating: { sort: "desc", nulls: "last" } },
        { addedAt: "desc" },
      ],
      take: 50,
    });

    if (wines.length < 3) {
      return {
        success: false,
        error:
          "You need at least 3 wines in your collection to generate a taste profile.",
      };
    }

    const history = await prisma.wineHistory.findMany({
      where: { userId: uid, rating: { not: null } },
      select: {
        id: true,
        name: true,
        winery: true,
        vintage: true,
        type: true,
        region: true,
        grapeVariety: true,
        rating: true,
      },
      orderBy: { rating: { sort: "desc", nulls: "last" } },
      take: 20,
    });

    // Compute fingerprint over the actual input set used by the prompt.
    const fp = fingerprint(wines, history);

    // Cache lookup — return immediately on hit unless force=true.
    if (!opts?.force) {
      const cached = await prisma.tasteProfileCache.findUnique({
        where: { userId: uid },
      });
      if (cached && cached.collectionFingerprint === fp) {
        return {
          success: true,
          data: {
            all: cached.all as unknown as TasteProfileResult,
            red: (cached.red as unknown as TasteProfileResult | null) ?? null,
            white:
              (cached.white as unknown as TasteProfileResult | null) ?? null,
          },
          isMock: !(await isAIAvailable()),
        };
      }
    }

    // Build the three input lists. Bucket each wine/history row into red/
    // white slices using the same type-set rules the action used before.
    const redSet: ReadonlySet<string> = new Set(RED_TYPES);
    const whiteSet: ReadonlySet<string> = new Set(WHITE_TYPES);

    const allInputs: WineRow[] = [
      ...wines.map((w) => ({
        id: w.id,
        name: w.name,
        winery: w.winery,
        vintage: w.vintage,
        type: w.type,
        region: w.region,
        grapeVariety: w.grapeVariety,
        userRating: w.userRating,
      })),
      ...history.map((h) => ({
        id: h.id,
        name: h.name,
        winery: h.winery,
        vintage: h.vintage,
        type: h.type,
        region: h.region,
        grapeVariety: h.grapeVariety,
        userRating: h.rating,
      })),
    ];
    const redInputs = allInputs.filter((w) => redSet.has(w.type));
    const whiteInputs = allInputs.filter((w) => whiteSet.has(w.type));

    const prompt = tasteProfilePrompt(allInputs, redInputs, whiteInputs);
    // Touch the provider so test/feature stubs can intercept; the actual
    // call below uses GoogleGenAI directly to set responseMimeType.
    void getAIProvider();

    const { GoogleGenAI } = await import("@google/genai");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // No API key — return mock bundle. Zero credit charge for mock.
      const mockSlice: TasteProfileResult = {
        body: 7,
        tannin: 6,
        acidity: 5,
        sweetness: 2,
        fruit: 7,
        oak: 5,
        summary:
          "You prefer medium to full-bodied reds with moderate tannin and fruit-forward character.",
      };
      const mockBundle: TasteProfileBundle = {
        all: mockSlice,
        red: redInputs.length >= 3 ? mockSlice : null,
        white: whiteInputs.length >= 3 ? mockSlice : null,
      };
      return { success: true, data: mockBundle, isMock: true };
    }

    // Reserve 1 credit RIGHT BEFORE the real Gemini call. Single charge for
    // all three slices since it's one AI call. Cached returns charge zero.
    reservation = await reserveAiCredits(uid, "enrich_text", 1);
    if (!reservation.ok) {
      throw new TierError(
        "CREDITS_EXHAUSTED",
        reservation.tier,
        reservation.message
      );
    }

    const client = new GoogleGenAI({ apiKey, httpOptions: { timeout: 60_000 } });
    // gemini-2.5-flash "thinks" by default. This prompt is deterministic
    // scoring, and thinking is what pushed the three-slice JSON response past
    // Gemini's server deadline — production logged 504 DEADLINE_EXCEEDED on
    // 2026-09-12. Budget 0 skips thinking entirely.
    const call = () =>
      client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
    let response;
    try {
      response = await call();
    } catch (err) {
      // One retry: these 504s are Gemini load, not something in the request.
      const msg = err instanceof Error ? err.message : String(err);
      if (!/504|DEADLINE_EXCEEDED|timed out/i.test(msg)) throw err;
      response = await call();
    }

    const text = response.text ?? "";
    const bundle = parseBundle(text);

    // If the input set has fewer than 3 reds/whites, force null on that
    // slice regardless of what the model returned (defensive — prompt
    // already says return null but model output is untrusted).
    if (redInputs.length < 3) bundle.red = null;
    if (whiteInputs.length < 3) bundle.white = null;

    // Persist cache (upsert: one row per user). Prisma JSON columns reject
    // raw `null` — use `Prisma.JsonNull` to write a SQL NULL.
    const { Prisma } = await import("@/generated/prisma/client");
    type JsonIn = import("@/generated/prisma/client").Prisma.InputJsonValue;
    const allJson = bundle.all as unknown as JsonIn;
    const redJson = bundle.red
      ? (bundle.red as unknown as JsonIn)
      : Prisma.JsonNull;
    const whiteJson = bundle.white
      ? (bundle.white as unknown as JsonIn)
      : Prisma.JsonNull;
    await prisma.tasteProfileCache.upsert({
      where: { userId: uid },
      create: {
        userId: uid,
        all: allJson,
        red: redJson,
        white: whiteJson,
        collectionFingerprint: fp,
      },
      update: {
        all: allJson,
        red: redJson,
        white: whiteJson,
        collectionFingerprint: fp,
        computedAt: new Date(),
      },
    });

    return { success: true, data: bundle, isMock: !(await isAIAvailable()) };
  } catch (err) {
    // Refund the reservation if anything after reserve threw.
    if (reservation?.ok) {
      await reservation
        .refundOnFailure()
        .catch((e) => console.error("[TasteProfile credit refund failed]", e));
    }
    if (err instanceof TierError) {
      return { success: false, error: err.message, code: err.code };
    }
    const raw = err instanceof Error ? err.message : "Unknown error";
    console.error("[TasteProfile Error]", raw);
    return {
      success: false,
      error: "Failed to generate taste profile. Please try again.",
    };
  }
}
