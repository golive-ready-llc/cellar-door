/**
 * CSV / TSV wine import: pure parsing, shared by the import dialog and tests.
 *
 * Handles generic spreadsheets plus the quirks of real CellarTracker exports
 * (verified 2026-09-10 against real Inventory, Bottles and Available exports):
 *  - Type, Color and Category columns. Category holds a style ("Dry",
 *    "Sweet/Dessert", "Sparkling", "Fortified"), never a color, so it must not
 *    overwrite Type/Color.
 *  - "Unknown" is CellarTracker's placeholder for an empty text field.
 *  - Vintage 1001 means non-vintage; 9999 means "no drinking window".
 *  - Drink-window columns hold years ("2024") or dates ("12/31/2027").
 *  - Scores use a 100-point scale; Cellar Door ratings are 0-5.
 *  - Dates are M/D/YYYY.
 *  - Letters outside Latin-1 arrive as HTML numeric entities ("&#259;").
 *  - Files may be Windows-1252 rather than UTF-8.
 *  - The Bottles export includes bottles already drunk (BottleState 0).
 */
import type { Wine, WineType } from "@/types/wine";

export type ImportedWine = Omit<Wine, "id" | "addedAt" | "updatedAt" | "userId">;

export interface CsvParseResult {
  wines: ImportedWine[];
  headers: string[];
  mappedFields: string[];
  /** Rows skipped on purpose: consumed bottles or a zero bottle count. */
  skippedConsumed: number;
  error: string | null;
}

// Map CSV column headers (lower-cased, trimmed) to internal field keys.
// Supports CellarTracker, Vivino, and generic CSV formats.
const COLUMN_MAP: Record<string, string> = {
  // Name
  name: "name",
  "wine name": "name",
  wine: "name",
  // Winery
  winery: "winery",
  producer: "winery",
  "wine producer": "winery",
  // Vintage
  vintage: "vintage",
  year: "vintage",
  // Type: kept separate so a style column can't overwrite the color
  type: "type",
  "wine type": "type",
  color: "color",
  category: "category",
  // Grape
  grape: "grapeVariety",
  "grape variety": "grapeVariety",
  grapes: "grapeVariety",
  varietal: "grapeVariety",
  // Region
  region: "region",
  appellation: "region",
  subregion: "subRegion",
  "sub-region": "subRegion",
  locale: "locale",
  // Country
  country: "country",
  origin: "country",
  // Price
  price: "price",
  "purchase price": "price",
  cost: "price",
  bottlecost: "price", // CellarTracker Bottles export
  menuprice: "price",
  "menu price": "price",
  // Rating
  rating: "userRating",
  "my rating": "userRating",
  score: "userRating",
  "my score": "userRating",
  myscore: "userRating",
  my: "userRating", // CellarTracker Inventory export
  pscore: "userRating", // CellarTracker Available export
  // Notes
  notes: "notes",
  "tasting notes": "tastingNotes",
  comments: "notes",
  "bottle note": "notes",
  bottlenote: "notes", // CellarTracker
  "private note": "notes",
  "purchase note": "purchaseNote",
  purchasenote: "purchaseNote", // CellarTracker
  "public tasting note": "tastingNotes",
  // Description
  description: "description",
  // Alcohol
  alcohol: "alcohol",
  abv: "alcohol",
  // Barcode
  barcode: "barcode",
  upc: "barcode",
  ean: "barcode",
  winebarcode: "barcode",
  // Drink window
  "drink window": "drinkWindow",
  "drink by": "drinkBy",
  maturity: "drinkWindow",
  begin: "beginDrink",
  end: "endDrink",
  "begin consumption": "beginDrink",
  "end consumption": "endDrink",
  begindrink: "beginDrink",
  enddrink: "endDrink",
  "begin drinking": "beginDrink",
  "end drinking": "endDrink",
  beginconsume: "beginDrink", // CellarTracker
  endconsume: "endDrink", // CellarTracker
  // Location
  location: "location",
  bin: "location",
  shelf: "location",
  // Quantity and purchase details
  quantity: "quantity",
  qty: "quantity",
  inventory: "quantity", // CellarTracker Available export: bottles on hand
  size: "size",
  "bottle size": "size",
  bottlesize: "size",
  store: "store",
  storename: "store", // CellarTracker Inventory export
  "purchase date": "purchaseDate",
  purchasedate: "purchaseDate",
  "delivery date": "purchaseDate",
  // CellarTracker Bottles export: 0 = consumed, 1 = in the cellar
  bottlestate: "bottleState",
};

/** Values CellarTracker writes instead of leaving a field empty. */
const PLACEHOLDER_VALUES = new Set(["unknown"]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: String.fromCharCode(0xa0),
};

/** Decode HTML character references (CellarTracker encodes e.g. "ă" as "&#259;"). */
function decodeHtmlEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const code = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function cleanValue(raw: string): string {
  const value = decodeHtmlEntities(raw.trim()).trim();
  return PLACEHOLDER_VALUES.has(value.toLowerCase()) ? "" : value;
}

/**
 * Decode a file's bytes. Tries strict UTF-8 first (a UTF-8 byte-order mark is
 * dropped), then falls back to Windows-1252, the encoding CellarTracker and
 * Excel commonly produce.
 */
export function decodeCsvBytes(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(view);
  } catch {
    return new TextDecoder("windows-1252").decode(view);
  }
}

/**
 * Parse a price string from an arbitrary CSV export, handling both US
 * (1,234.56) and European (1.234,56 / 12,50) number formats. The decimal
 * separator is whichever of "." or "," appears last AND is followed by 1–2
 * digits; the other separator is treated as thousands grouping. Falls back
 * to a plain float parse. Returns null for blank/unparseable input.
 */
function parseImportedPrice(raw: string): number | null {
  if (!raw) return null;
  let s = raw.replace(/[^0-9.,]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const decimalsAfterComma = lastComma >= 0 ? s.length - lastComma - 1 : -1;
  if (lastComma > lastDot && decimalsAfterComma >= 1 && decimalsAfterComma <= 2) {
    // Comma is the decimal separator (European). Drop dot thousands-groupers.
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // Dot is decimal (or integer). Drop comma thousands-groupers.
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Convert a 5-, 10- or 100-point score to Cellar Door's 0-5 scale (one decimal). */
function toFiveStarRating(raw: string): number | null {
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n <= 5) return Math.round(n * 10) / 10;
  if (n <= 10) return Math.round(n * 5) / 10;
  if (n <= 100) return Math.round(n / 2) / 10;
  return null;
}

/** First plausible 4-digit year in a value ("2027", "12/31/2027"); ignores 9999. */
function yearOf(raw: string | undefined): string {
  if (!raw) return "";
  const m = raw.match(/\b(1[89]\d{2}|2[01]\d{2})\b/);
  return m ? m[1] : "";
}

/** Normalize US M/D/YYYY dates (CellarTracker) to ISO YYYY-MM-DD. */
function normalizeDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/);
  if (us) {
    const [, m, d, y] = us;
    if (+m >= 1 && +m <= 12 && +d >= 1 && +d <= 31) {
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  return s;
}

const SPARKLING_RE =
  /spark|champ|prosecco|\bcava\b|cr[eé]mant|franciacorta|p[eé]t[- ]?nat|frizzante|\bsekt\b/;

/** U+FFFD, left behind when a Windows-1252 file was decoded as UTF-8. */
const REPLACEMENT_CHAR = String.fromCharCode(0xfffd);

function colorOf(raw: string | undefined): WineType | null {
  if (!raw) return null;
  const l = raw.toLowerCase();
  if (/\bred\b|rouge|rosso|tinto/.test(l)) return "red";
  if (/\bwhite\b|blanc|bianco|blanco/.test(l)) return "white";
  if (/ros[eé]|rosado|rosato|blush/.test(l) || l.includes("ros" + REPLACEMENT_CHAR)) return "rosé";
  if (/\borange\b|amber|skin[- ]contact/.test(l)) return "orange";
  return null;
}

/**
 * Resolve the wine type from Type / Color / Category columns. Style words
 * (dessert, fortified) win; otherwise color comes from Type, then Color, and
 * never from a style-only Category such as "Dry". Sparkling whites become
 * "sparkling"; sparkling rosés and reds keep their color with the flag set.
 */
function resolveWineType(
  typeRaw: string | undefined,
  colorRaw: string | undefined,
  categoryRaw: string | undefined
): { type: WineType; sparkling: boolean } {
  const all = [typeRaw, colorRaw, categoryRaw].filter(Boolean).join(" ").toLowerCase();
  if (!all) return { type: "red", sparkling: false };
  const sparkling = SPARKLING_RE.test(all);
  if (/fortified|sherry|madeira/.test(all)) return { type: "fortified", sparkling };
  if (/dessert|sweet|sauternes|\bport\b/.test(all)) return { type: "dessert", sparkling };
  const color = colorOf(typeRaw) ?? colorOf(colorRaw) ?? colorOf(categoryRaw);
  if (sparkling && (color === null || color === "white")) {
    return { type: "sparkling", sparkling: true };
  }
  return { type: color ?? "red", sparkling };
}

function mapRow(headers: string[], values: string[]): Record<string, string> {
  const row: Record<string, string> = {};
  headers.forEach((h, i) => {
    const key = COLUMN_MAP[h.toLowerCase().trim()];
    if (!key || values[i] == null) return;
    const val = cleanValue(values[i]);
    if (!val) return;
    // For note-like fields, append if already set
    if ((key === "notes" || key === "tastingNotes") && row[key]) {
      row[key] = row[key] + "\n" + val;
    } else {
      row[key] = val;
    }
  });
  return row;
}

/** Auto-detect delimiter: tab vs comma */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || "";
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

function parseDelimited(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  const currentRow: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(current);
        current = "";
      } else if (char === "\n" || (char === "\r" && next === "\n")) {
        currentRow.push(current);
        current = "";
        if (currentRow.some((c) => c.trim())) {
          rows.push([...currentRow]);
        }
        currentRow.length = 0;
        if (char === "\r") i++;
      } else {
        current += char;
      }
    }
  }

  // Final row
  currentRow.push(current);
  if (currentRow.some((c) => c.trim())) {
    rows.push([...currentRow]);
  }

  return rows;
}

/** Parse CSV/TSV text into wines ready for bulk import. */
export function parseWineCsv(
  text: string,
  today: string = new Date().toISOString().split("T")[0]
): CsvParseResult {
  const fail = (
    error: string,
    headers: string[] = [],
    mappedFields: string[] = [],
    skippedConsumed = 0
  ): CsvParseResult => ({ wines: [], headers, mappedFields, skippedConsumed, error });

  const rows = parseDelimited(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  if (rows.length < 2) {
    return fail("CSV must have a header row and at least one data row.");
  }

  const headers = rows[0];
  const mapped = new Set<string>();
  for (const h of headers) {
    const key = COLUMN_MAP[h.toLowerCase().trim()];
    if (key) mapped.add(key);
  }
  const mappedFields = Array.from(mapped);

  if (!mapped.has("name")) {
    return fail(
      'Could not find a "Name" column. Please ensure your CSV has a column named "Name", "Wine Name", or "Wine".',
      headers,
      mappedFields
    );
  }

  const wines: ImportedWine[] = [];
  let skippedConsumed = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = mapRow(headers, rows[i]);
    if (!row.name) continue;

    // Bottles already drunk (CellarTracker Bottles export) or none left.
    if (row.bottleState === "0") {
      skippedConsumed++;
      continue;
    }
    const qtyParsed = row.quantity ? parseInt(row.quantity, 10) : NaN;
    if (Number.isFinite(qtyParsed) && qtyParsed <= 0) {
      skippedConsumed++;
      continue;
    }
    const quantity = Number.isFinite(qtyParsed) ? qtyParsed : 1;

    // Drink window from Begin/End (years or full dates) if not given directly
    let drinkWindow = row.drinkWindow || "";
    const begin = yearOf(row.beginDrink);
    const end = yearOf(row.endDrink);
    if (!drinkWindow && (begin || end)) {
      drinkWindow = begin && end ? `${begin}-${end}` : end || `${begin}+`;
    }
    const drinkBy = row.drinkBy || end;

    // Merge region fields (region + subRegion)
    let region = row.region || "";
    if (row.subRegion && row.subRegion !== region) {
      region = region ? `${region}, ${row.subRegion}` : row.subRegion;
    }
    if (!region && row.locale) {
      region = row.locale;
    }

    // Merge notes (notes + purchaseNote + store info)
    let notes = row.notes || "";
    if (row.purchaseNote) {
      notes = notes ? `${notes}\n${row.purchaseNote}` : row.purchaseNote;
    }
    if (row.store) {
      const storeNote = `Purchased from: ${row.store}`;
      notes = notes ? `${notes}\n${storeNote}` : storeNote;
    }

    // Non-vintage: CellarTracker uses the sentinel year 1001
    const vintageNum = row.vintage ? parseInt(row.vintage, 10) : NaN;
    const vintage = Number.isFinite(vintageNum) && vintageNum !== 1001 ? vintageNum : null;

    // CellarTracker's Wine column repeats the producer; keep just the wine
    const winery = row.winery || "";
    let name = row.name;
    if (winery && name.toLowerCase().startsWith(`${winery.toLowerCase()} `)) {
      const rest = name.slice(winery.length + 1).trim();
      if (rest) name = rest;
    }

    const { type, sparkling } = resolveWineType(row.type, row.color, row.category);
    const price = row.price ? parseImportedPrice(row.price) : null;

    const wine: ImportedWine = {
      cabinetId: null,
      barcode: row.barcode || "",
      name,
      winery,
      region,
      country: row.country || "",
      vintage,
      type,
      sparkling,
      grapeVariety: row.grapeVariety || "",
      userRating: row.userRating ? toFiveStarRating(row.userRating) : null,
      imageUrl: "",
      price: price && price > 0 ? price : null,
      retailPrice: null,
      purchaseDate: row.purchaseDate ? normalizeDate(row.purchaseDate) : today,
      drinkBy,
      notes,
      description: row.description || "",
      foodPairings: "",
      alcohol: row.alcohol || "",
      row: null,
      col: null,
      depth: 0,
      zone: "",
      tastingNotes: row.tastingNotes || null,
      disposition: "",
      drinkWindow,
      aiRatings: null,
      tags: [],
    };

    // One entry per bottle
    for (let q = 0; q < Math.min(quantity, 100); q++) {
      wines.push({ ...wine });
    }
  }

  if (wines.length === 0) {
    return fail(
      skippedConsumed > 0
        ? "Every row is marked as consumed or has no bottles left, so there is nothing to import."
        : "No valid wine entries found in the CSV.",
      headers,
      mappedFields,
      skippedConsumed
    );
  }

  return { wines, headers, mappedFields, skippedConsumed, error: null };
}
