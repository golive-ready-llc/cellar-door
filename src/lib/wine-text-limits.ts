/**
 * Bounds on user-supplied wine text, so a single request can't store
 * megabytes of notes or thousands of tags. Applied on create, update and
 * import. imageUrl is deliberately not limited here (label photos are
 * stored as data URLs and are handled by image compression instead).
 */
export const WINE_TEXT_LIMITS = {
  short: 500,
  long: 20_000,
  tagCount: 50,
  tagLength: 60,
} as const;

const SHORT_FIELDS = [
  "name",
  "winery",
  "region",
  "country",
  "grapeVariety",
  "alcohol",
  "zone",
  "disposition",
  "drinkWindow",
  "drinkBy",
  "purchaseDate",
  "barcode",
  "type",
  "bottleSize",
] as const;

const LONG_FIELDS = ["notes", "description", "foodPairings"] as const;

function clamp(value: unknown, max: number): unknown {
  return typeof value === "string" && value.length > max ? value.slice(0, max) : value;
}

/** Return a copy of `input` with over-long text truncated and tags bounded. */
export function limitWineText<T extends object>(input: T): T {
  const out: Record<string, unknown> = { ...(input as Record<string, unknown>) };

  for (const key of SHORT_FIELDS) {
    if (key in out) out[key] = clamp(out[key], WINE_TEXT_LIMITS.short);
  }
  for (const key of LONG_FIELDS) {
    if (key in out) out[key] = clamp(out[key], WINE_TEXT_LIMITS.long);
  }

  // Tasting notes are a plain string today; older rows hold a small object.
  const notes = out.tastingNotes;
  if (typeof notes === "string") {
    out.tastingNotes = clamp(notes, WINE_TEXT_LIMITS.long);
  } else if (notes && typeof notes === "object" && !Array.isArray(notes)) {
    out.tastingNotes = Object.fromEntries(
      Object.entries(notes as Record<string, unknown>).map(([k, v]) => [
        k,
        clamp(v, WINE_TEXT_LIMITS.long),
      ])
    );
  }

  if (Array.isArray(out.tags)) {
    out.tags = out.tags
      .filter((t): t is string => typeof t === "string")
      .slice(0, WINE_TEXT_LIMITS.tagCount)
      .map((t) => t.slice(0, WINE_TEXT_LIMITS.tagLength));
  }

  return out as T;
}
