// Constants for Cellar Door
// Based on ha-wine-cellar const.py + models.ts

import type { WineType, StorageRowType } from "./wine";

export const WINE_TYPES: WineType[] = [
  "red",
  "white",
  "rosé",
  "sparkling",
  "dessert",
  "orange",
  "green",
  "fortified",
];

/** Types shown in the user-facing Type picker. "sparkling" is intentionally
 * excluded — sparkling is a quality (handled by the separate Sparkling
 * checkbox), not a grape color. The full WINE_TYPES list above stays for
 * legacy data display + filter chips on existing wines tagged
 * type="sparkling" (which we treat as white sparkling on read). */
export const WINE_TYPES_FOR_PICKER: WineType[] = [
  "red",
  "white",
  "rosé",
  "dessert",
  "orange",
  "green",
  "fortified",
];

/** Fill colors — used for backgrounds (circles, selected badges, indicators) */
export const WINE_TYPE_COLORS: Record<WineType, string> = {
  red: "#9B2335",
  white: "#F5E6CA",
  rosé: "#E8A0BF",
  sparkling: "#C5D86D",
  champagne: "#C5D86D",
  prosecco: "#C5D86D",
  cava: "#C5D86D",
  crémant: "#C5D86D",
  cremant: "#C5D86D",
  franciacorta: "#C5D86D",
  dessert: "#E6A817",
  orange: "#E07B39",
  green: "#4A7C59",
  fortified: "#6B3A5D",
};

/** Text-safe colors — variants that work as text/borders on any background.
 *  For light mode, these are darker; for dark mode, brighter. Use with CSS variables. */
export const WINE_TYPE_TEXT_COLORS: Record<WineType, { light: string; dark: string }> = {
  red:       { light: "#9B2335", dark: "#D4616E" },
  white:     { light: "#8B7A5E", dark: "#F5E6CA" },
  rosé:      { light: "#B5507A", dark: "#F0B8D0" },
  sparkling: { light: "#6B8E23", dark: "#D4E89F" },
  champagne: { light: "#6B8E23", dark: "#D4E89F" },
  prosecco:  { light: "#6B8E23", dark: "#D4E89F" },
  cava:      { light: "#6B8E23", dark: "#D4E89F" },
  crémant:   { light: "#6B8E23", dark: "#D4E89F" },
  cremant:   { light: "#6B8E23", dark: "#D4E89F" },
  franciacorta: { light: "#6B8E23", dark: "#D4E89F" },
  dessert:   { light: "#A07A10", dark: "#F0C040" },
  orange:    { light: "#C06A2E", dark: "#F0A060" },
  green:     { light: "#3A6648", dark: "#7BC48E" },
  fortified: { light: "#6B3A5D", dark: "#B87AA8" },
};

export const WINE_TYPE_LABELS: Record<WineType, string> = {
  red: "Red",
  white: "White",
  rosé: "Rosé",
  sparkling: "Sparkling",
  champagne: "Champagne",
  prosecco: "Prosecco",
  cava: "Cava",
  crémant: "Crémant",
  cremant: "Cremant",
  franciacorta: "Franciacorta",
  dessert: "Dessert",
  orange: "Orange",
  green: "Green",
  fortified: "Fortified",
};

export const STORAGE_ROW_TYPE_LABELS: Record<StorageRowType, string> = {
  bulk: "Bulk Bin",
  box: "Wine Box", // legacy — treated as bulk in UI
};

/** Standard wine case sizes for case storage within bulk bins */
/** Compact bottle-size labels for chips and mini-UI. */
export const BOTTLE_SIZE_SHORT: Record<string, string> = {
  half: "375ml",
  standard: "750ml",
  magnum: "Magnum",
  large: "3L+",
};

export const CASE_SIZES = [6, 12, 24] as const;

/** @deprecated Use CASE_SIZES instead */
export const BOX_SIZES = [1, 3, 6, 12, 24] as const;

export const REMOVAL_REASONS = [
  { id: "drank", label: "Drank" },
  { id: "gifted", label: "Gifted" },
  { id: "sold", label: "Sold" },
  { id: "broken", label: "Broken" },
  { id: "spoiled", label: "Spoiled" },
  { id: "other", label: "Other" },
] as const;

export type RemovalReasonId = (typeof REMOVAL_REASONS)[number]["id"];

export const DISPOSITION_LABELS: Record<string, string> = {
  D: "Drink Now",
  H: "Hold",
  P: "Past Peak",
};

export const DISPOSITION_COLORS: Record<string, string> = {
  D: "#22c55e", // green
  H: "#3b82f6", // blue
  P: "#ef4444", // red
};

/** Picker options for setting a wine's disposition, including the unset choice */
export const DISPOSITION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Not set" },
  { value: "D", label: "Drink Now" },
  { value: "H", label: "Hold" },
  { value: "P", label: "Past Peak" },
];

// Default cabinet configuration for new users
export const DEFAULT_CABINETS = [
  {
    name: "Section 1",
    rows: 10,
    cols: 9,
    depth: 1,
    storageRows: [
      { row: 9, name: "Bulk Storage", type: "bulk" as const, capacity: 20 },
    ],
    sortOrder: 0,
  },
];

// AI rating source labels
export const AI_RATING_LABELS: Record<string, string> = {
  rating_ws: "Wine Spectator",
  rating_rp: "Robert Parker",
  rating_jd: "Jeb Dunnuck",
  rating_ag: "Antonio Galloni",
};
