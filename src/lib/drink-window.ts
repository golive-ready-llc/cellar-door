/**
 * Drinking window parsing & categorization utilities.
 *
 * Shared between server and client — no "use client" / "use server".
 */

import type { Wine } from "@/types/wine";

// ─── Types ────────────────────────────────────────────────────

export type DrinkCategory = "drink-now" | "approaching" | "past-peak" | "hold";

export const DRINK_CATEGORY_LABELS: Record<DrinkCategory, string> = {
  "drink-now": "Drink Now",
  approaching: "Approaching Peak",
  "past-peak": "Past Peak",
  hold: "Safe to Hold",
};

export const DRINK_CATEGORY_COLORS: Record<DrinkCategory, string> = {
  "drink-now": "#22c55e", // green
  approaching: "#f59e0b", // amber
  "past-peak": "#ef4444", // red
  hold: "#3b82f6", // blue
};

// ─── Parsing ──────────────────────────────────────────────────

/**
 * Parse the `drinkWindow` field into start/end years.
 * Handles formats: "2025-2030", "2025–2030", "2025", "", null.
 */
export function parseDrinkWindow(
  drinkWindow: string | null | undefined
): { start: number | null; end: number | null } {
  if (!drinkWindow || !drinkWindow.trim()) return { start: null, end: null };

  const trimmed = drinkWindow.trim();

  // "2025-2030" or "2025–2030" (en-dash)
  const rangeMatch = trimmed.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  if (rangeMatch) {
    return { start: Number(rangeMatch[1]), end: Number(rangeMatch[2]) };
  }

  // Single year "2025"
  const singleMatch = trimmed.match(/^(\d{4})$/);
  if (singleMatch) {
    const year = Number(singleMatch[1]);
    return { start: year, end: year };
  }

  return { start: null, end: null };
}

// ─── Categorization ───────────────────────────────────────────

/**
 * Categorize a wine by its drinking readiness.
 *
 * - No window data → "hold" (assume safe)
 * - currentYear > end → "past-peak"
 * - currentYear >= start && currentYear <= end → "drink-now"
 * - start − currentYear <= 2 → "approaching" (within 2 years)
 * - Otherwise → "hold"
 */
export function categorizeDrinkWindow(
  wine: Wine,
  currentYear: number = new Date().getFullYear()
): DrinkCategory {
  const { start, end } = parseDrinkWindow(wine.drinkWindow);
  if (start === null || end === null) return "hold";

  if (currentYear > end) return "past-peak";
  if (currentYear >= start && currentYear <= end) return "drink-now";
  if (start - currentYear <= 2) return "approaching";
  return "hold";
}

/**
 * Effective disposition for display, reconciling the stored `disposition`
 * field with the wine's `drinkWindow` based on the current year.
 *
 * If a drinkWindow is set, it is authoritative — stored disposition may be
 * stale (e.g. set to "H" years ago when the wine was still aging). If no
 * drinkWindow, fall back to stored disposition.
 *
 * Returns the DB-style single-letter code: "D" | "H" | "P" | "" (empty = unknown).
 */
export function getEffectiveDisposition(
  wine: Pick<Wine, "disposition" | "drinkWindow">,
  currentYear: number = new Date().getFullYear()
): "D" | "H" | "P" | "" {
  const { start, end } = parseDrinkWindow(wine.drinkWindow);
  if (start !== null && end !== null) {
    if (currentYear > end) return "P";
    if (currentYear >= start) return "D";
    return "H";
  }
  const d = wine.disposition;
  if (d === "D" || d === "H" || d === "P") return d;
  return "";
}

// ─── Aggregations ─────────────────────────────────────────────

/** Group wines by drink-window category. */
export function getDrinkWindowStats(
  wines: Wine[],
  currentYear?: number
): Record<DrinkCategory, Wine[]> {
  const result: Record<DrinkCategory, Wine[]> = {
    "drink-now": [],
    approaching: [],
    "past-peak": [],
    hold: [],
  };
  for (const wine of wines) {
    const cat = categorizeDrinkWindow(wine, currentYear);
    result[cat].push(wine);
  }
  return result;
}

/** Chart-ready timeline data: for each year, how many wines fall in each category. */
export function getDrinkWindowTimeline(
  wines: Wine[]
): { year: number; drinkNow: number; approaching: number; hold: number; pastPeak: number }[] {
  // Count wines by the END year of their window (when they should be drunk by)
  const yearMap = new Map<
    number,
    { drinkNow: number; approaching: number; hold: number; pastPeak: number }
  >();

  const currentYear = new Date().getFullYear();

  for (const wine of wines) {
    const { start, end } = parseDrinkWindow(wine.drinkWindow);
    if (start === null || end === null) continue;

    // Use the start year for timeline display
    const year = start;
    if (!yearMap.has(year)) {
      yearMap.set(year, { drinkNow: 0, approaching: 0, hold: 0, pastPeak: 0 });
    }
    const entry = yearMap.get(year)!;

    if (currentYear > end) entry.pastPeak++;
    else if (currentYear >= start && currentYear <= end) entry.drinkNow++;
    else if (start - currentYear <= 2) entry.approaching++;
    else entry.hold++;
  }

  return Array.from(yearMap.entries())
    .map(([year, data]) => ({ year, ...data }))
    .sort((a, b) => a.year - b.year);
}
