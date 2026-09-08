"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { isSparklingType, type Wine, type WineType } from "@/types/wine";

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

interface CSVImportDialogProps {
  onImport: (wines: Omit<Wine, "id" | "addedAt" | "updatedAt" | "userId">[]) => Promise<void>;
  trigger?: React.ReactElement;
}

// Map common CSV column headers to our field names
// Supports CellarTracker, Vivino, and generic CSV formats
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
  // Type
  type: "type",
  color: "type",
  "wine type": "type",
  category: "type",
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
  menuprice: "price",
  "menu price": "price",
  // Rating
  rating: "userRating",
  "my rating": "userRating",
  score: "userRating",
  "my score": "userRating",
  // Notes
  notes: "notes",
  "tasting notes": "tastingNotes",
  comments: "notes",
  "bottle note": "notes",
  "private note": "notes",
  "purchase note": "purchaseNote",
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
  // Drink window (CellarTracker uses Begin/End)
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
  // Location
  location: "location",
  bin: "location",
  shelf: "location",
  // CellarTracker-specific
  quantity: "quantity",
  qty: "quantity",
  size: "size",
  "bottle size": "size",
  bottlesize: "size",
  store: "store",
  "purchase date": "purchaseDate",
  purchasedate: "purchaseDate",
  "delivery date": "purchaseDate",
};

function mapRow(headers: string[], values: string[]) {
  const row: Record<string, string> = {};
  headers.forEach((h, i) => {
    const key = COLUMN_MAP[h.toLowerCase().trim()];
    if (key && values[i]) {
      const val = values[i].trim();
      // For note-like fields, append if already set
      if ((key === "notes" || key === "tastingNotes") && row[key]) {
        row[key] = row[key] + "\n" + val;
      } else {
        row[key] = val;
      }
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

function inferType(value: string): WineType {
  const lower = value.toLowerCase();
  if (lower.includes("red")) return "red";
  if (lower.includes("white")) return "white";
  if (lower.includes("ros") || lower.includes("rosé")) return "rosé";
  if (lower.includes("spark") || lower.includes("champ") || lower.includes("prosecco") || lower.includes("cava"))
    return "sparkling";
  if (lower.includes("dessert") || lower.includes("port") || lower.includes("sweet") || lower.includes("sauternes"))
    return "dessert";
  if (lower.includes("fortified") || lower.includes("sherry") || lower.includes("madeira"))
    return "fortified";
  return "red"; // default
}

export function CSVImportDialog({ onImport, trigger }: CSVImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<
    Omit<Wine, "id" | "addedAt" | "updatedAt" | "userId">[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [_headers, setHeaders] = useState<string[]>([]);
  const [mappedFields, setMappedFields] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setPreview(null);
    setError(null);
    setHeaders([]);
    setMappedFields([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = parseDelimited(text);

        if (rows.length < 2) {
          setError("CSV must have a header row and at least one data row.");
          return;
        }

        const csvHeaders = rows[0];
        setHeaders(csvHeaders);

        // Determine which fields we can map
        const mapped = new Set<string>();
        csvHeaders.forEach((h) => {
          const key = COLUMN_MAP[h.toLowerCase().trim()];
          if (key) mapped.add(key);
        });
        setMappedFields(Array.from(mapped));

        if (!mapped.has("name")) {
          setError(
            'Could not find a "Name" column. Please ensure your CSV has a column named "Name", "Wine Name", or "Wine".'
          );
          return;
        }

        // Parse data rows
        const wines: Omit<Wine, "id" | "addedAt" | "updatedAt" | "userId">[] =
          [];
        for (let i = 1; i < rows.length; i++) {
          const row = mapRow(csvHeaders, rows[i]);
          if (!row.name) continue;

          // Compose drinkWindow from Begin/End if not already set
          let drinkWindow = row.drinkWindow || "";
          let drinkBy = row.drinkBy || "";
          if (!drinkWindow && (row.beginDrink || row.endDrink)) {
            const begin = row.beginDrink || "";
            const end = row.endDrink || "";
            if (begin && end) {
              drinkWindow = `${begin}-${end}`;
            } else if (end) {
              drinkWindow = end;
            } else if (begin) {
              drinkWindow = `${begin}+`;
            }
          }
          if (!drinkBy && row.endDrink) {
            drinkBy = row.endDrink;
          }

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

          // Parse purchase date
          let purchaseDate = row.purchaseDate || "";
          if (!purchaseDate) {
            purchaseDate = new Date().toISOString().split("T")[0];
          }

          // Parse quantity — default to 1
          const quantity = row.quantity ? parseInt(row.quantity, 10) || 1 : 1;

          const wine: Omit<Wine, "id" | "addedAt" | "updatedAt" | "userId"> = {
            cabinetId: null,
            barcode: row.barcode || "",
            name: row.name,
            winery: row.winery || "",
            region,
            country: row.country || "",
            vintage: row.vintage ? parseInt(row.vintage, 10) : null,
            type: row.type ? inferType(row.type) : "red",
            sparkling: row.type ? isSparklingType(inferType(row.type)) : false,
            grapeVariety: row.grapeVariety || "",
            userRating: row.userRating ? parseFloat(row.userRating) : null,
            imageUrl: "",
            price: row.price ? parseImportedPrice(row.price) : null,
            retailPrice: null,
            purchaseDate,
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

          // Duplicate wine entries based on quantity
          for (let q = 0; q < Math.min(quantity, 100); q++) {
            wines.push({ ...wine });
          }
        }

        if (wines.length === 0) {
          setError("No valid wine entries found in the CSV.");
          return;
        }

        setPreview(wines);
      } catch {
        setError("Failed to parse CSV file. Please check the format.");
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!preview) return;

    setImporting(true);
    try {
      await onImport(preview);
      resetState();
      setOpen(false);
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetState();
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm" className="text-xs">
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Import CSV
            </Button>
          )
        }
      />
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Wines from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or tab-delimited file to import wines. Supports
            CellarTracker, Vivino, and custom formats.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File input */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileChange}
              className="hidden"
              id="csv-file-input"
            />
            <label
              htmlFor="csv-file-input"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                Click to select a CSV file
              </span>
              <span className="text-xs text-muted-foreground">
                Supports CellarTracker, Vivino, and custom CSV formats
              </span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Mapped fields */}
          {mappedFields.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Mapped fields:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {mappedFields.map((f) => (
                  <Badge key={f} variant="outline" className="text-xs">
                    <Check className="h-3 w-3 mr-1 text-green-500" />
                    {f}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div>
              <p className="text-sm font-medium mb-2">
                Found <strong>{preview.length}</strong> wines to import:
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {preview.slice(0, 20).map((wine, idx) => (
                  <div
                    key={idx}
                    className="text-xs flex items-center gap-2 py-1"
                  >
                    <span className="text-muted-foreground w-5 text-right">
                      {idx + 1}.
                    </span>
                    <span className="font-medium truncate flex-1">
                      {wine.name}
                    </span>
                    {wine.winery && (
                      <span className="text-muted-foreground truncate max-w-24">
                        {wine.winery}
                      </span>
                    )}
                    {wine.vintage && (
                      <span className="text-muted-foreground">
                        {wine.vintage}
                      </span>
                    )}
                  </div>
                ))}
                {preview.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    ... and {preview.length - 20} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetState();
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!preview || importing}
          >
            {importing
              ? "Importing..."
              : preview
                ? `Import ${preview.length} Wines`
                : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
