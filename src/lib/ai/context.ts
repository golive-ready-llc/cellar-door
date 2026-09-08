// Builds cellar context summary for CellarChat
// Provides the AI with a concise overview of the user's collection

/**
 * Minimal wine shape CellarChat actually needs. Deliberately EXCLUDES heavy
 * fields — above all `imageUrl`, which is frequently a multi-hundred-KB base64
 * data URL. Sending full Wine objects (with images) for a 60+ wine cellar
 * produced an ~9MB server-action payload and an HTTP 413 before the request
 * ever reached the AI. The client maps to this slim shape before sending.
 */
export interface CellarSummaryWine {
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  country: string;
  grapeVariety: string;
  disposition: string;
  price: number | null;
  retailPrice: number | null;
}

/**
 * Build a context summary string of the user's cellar for the chat AI.
 * Keeps it concise to fit within prompt length limits.
 */
export function buildCellarContext(wines: CellarSummaryWine[]): string {
  if (wines.length === 0) {
    return "The user's cellar is currently empty.";
  }

  // Type distribution
  const typeCounts: Record<string, number> = {};
  for (const w of wines) {
    typeCounts[w.type] = (typeCounts[w.type] || 0) + 1;
  }
  const typeStr = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `${c} ${t}`)
    .join(", ");

  // Value
  const totalValue = wines.reduce(
    (sum, w) => sum + (w.price || w.retailPrice || 0),
    0
  );

  // Country distribution
  const countryCounts: Record<string, number> = {};
  for (const w of wines) {
    if (w.country) countryCounts[w.country] = (countryCounts[w.country] || 0) + 1;
  }
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([c, n]) => `${c} (${n})`)
    .join(", ");

  // Readiness
  const drinkNow = wines.filter((w) => w.disposition === "D").length;
  const hold = wines.filter((w) => w.disposition === "H").length;
  const pastPeak = wines.filter((w) => w.disposition === "P").length;

  // Include as many wines in the explicit list as fit an approximate token
  // budget, so the prompt never overflows the model's context — this supports
  // cellars of ANY size (10,000+) without breaking. We can't list all of a
  // 10,000-wine cellar (~300K tokens, far over a 64K window), so drink-now
  // wines (what recommendations care about most) come first, then the most
  // recently added; everything the list can't fit is still represented by the
  // statistical summary above.
  const LIST_CHAR_BUDGET = 90_000; // ~22K tokens — safe well within a 64K context
  const lineFor = (w: CellarSummaryWine) =>
    `- ${w.name} (${w.winery}, ${w.vintage || "NV"}, ${w.type}${w.disposition ? `, ${w.disposition === "D" ? "Drink Now" : w.disposition === "H" ? "Hold" : "Past Peak"}` : ""}${w.price ? `, $${w.price}` : ""}${w.grapeVariety ? `, ${w.grapeVariety}` : ""}${w.region ? `, ${w.region}` : ""})`;
  const orderedForList = [
    ...wines.filter((w) => w.disposition === "D"),
    ...wines.filter((w) => w.disposition !== "D").slice().reverse(),
  ];
  const listLines: string[] = [];
  let listChars = 0;
  for (const w of orderedForList) {
    const line = lineFor(w);
    if (listLines.length > 0 && listChars + line.length + 1 > LIST_CHAR_BUDGET) break;
    listLines.push(line);
    listChars += line.length + 1;
  }
  const displayCount = listLines.length;
  const truncated = displayCount < wines.length;
  const wineList = listLines.join("\n");

  // Statistical one-liner for large cellars
  const total = wines.length;
  const typePctStr = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `${Math.round((c / total) * 100)}% ${t}`)
    .join(", ");
  const avgPrice = total > 0 ? `$${(totalValue / total).toFixed(0)}` : "$0";
  const top3Countries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c)
    .join(", ");

  const header = truncated
    ? `Cellar at a glance: ${total} wines, ${typePctStr}, avg ${avgPrice}, top countries: ${top3Countries}, readiness: ${drinkNow} drink now / ${hold} hold / ${pastPeak} past peak

CELLAR SUMMARY:
Total bottles: ${total}
Types: ${typeStr}
Estimated value: $${totalValue.toLocaleString()}
Countries: ${topCountries}
Readiness: ${drinkNow} drink now, ${hold} hold, ${pastPeak} past peak

(Listing ${displayCount} of ${total} wines — drink-now first, then most recent. Full-collection stats are above; use them for any wines not individually listed.)`
    : `CELLAR SUMMARY:
Total bottles: ${total}
Types: ${typeStr}
Estimated value: $${totalValue.toLocaleString()}
Countries: ${topCountries}
Readiness: ${drinkNow} drink now, ${hold} hold, ${pastPeak} past peak`;

  return `${header}

WINE LIST:
${wineList}`;
}
