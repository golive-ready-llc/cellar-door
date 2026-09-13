// Shared CSV/backup utilities for Cellar Door

import type { Wine, Wall, Cabinet, WineHistoryItem, BuyListItem } from "@/types/wine";
import { DISPOSITION_LABELS } from "@/types/constants";

// ============================================================
// Backup types
// ============================================================

export interface CellarBackup {
  version: string;
  exportedAt: string;
  data: {
    wines: Wine[];
    walls: Wall[];
    cabinets: Cabinet[];
    history: WineHistoryItem[];
    buyList: BuyListItem[];
  };
}

// ============================================================
// Backup validation
// ============================================================

export function validateBackup(obj: unknown): obj is CellarBackup {
  if (!obj || typeof obj !== "object") return false;
  const b = obj as Record<string, unknown>;
  if (typeof b.version !== "string") return false;
  if (typeof b.exportedAt !== "string") return false;
  if (!b.data || typeof b.data !== "object") return false;
  const d = b.data as Record<string, unknown>;
  return (
    Array.isArray(d.wines) &&
    Array.isArray(d.walls) &&
    Array.isArray(d.cabinets) &&
    Array.isArray(d.history) &&
    Array.isArray(d.buyList)
  );
}

// ============================================================
// CSV helpers
// ============================================================

export function escapeCSV(value: string): string {
  if (!value) return "";
  // Prevent CSV injection: if the value starts with =, +, -, @,
  // prepend a single quote so Excel doesn't interpret them as formulas.
  if (/^[=+\-@]/.test(value)) {
    value = `'${value}`;
  }
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function winesToCSV(
  wines: Wine[],
  cabinetMap: Map<string, string>
): string {
  const headers = [
    "Name", "Winery", "Vintage", "Type", "Grape Variety", "Region",
    "Country", "Purchase Price", "Retail Price", "Rating", "Disposition",
    "Drink Window", "Alcohol", "Barcode", "Notes", "Description",
    "Food Pairings", "Location", "Added Date",
  ];

  const csvRows = [headers.join(",")];

  for (const wine of wines) {
    const row = [
      escapeCSV(wine.name),
      escapeCSV(wine.winery),
      wine.vintage ?? "",
      wine.type,
      escapeCSV(wine.grapeVariety),
      escapeCSV(wine.region),
      escapeCSV(wine.country),
      wine.price ?? "",
      wine.retailPrice ?? "",
      wine.userRating ?? "",
      DISPOSITION_LABELS[wine.disposition] || wine.disposition || "",
      wine.drinkWindow || "",
      wine.alcohol || "",
      wine.barcode || "",
      escapeCSV(wine.notes),
      escapeCSV(wine.description),
      escapeCSV(wine.foodPairings),
      wine.cabinetId ? cabinetMap.get(wine.cabinetId) || "" : "Unassigned",
      wine.addedAt ? new Date(wine.addedAt).toLocaleDateString() : "",
    ];
    csvRows.push(row.join(","));
  }

  return csvRows.join("\n");
}
