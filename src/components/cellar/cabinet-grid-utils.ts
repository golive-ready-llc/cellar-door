import { WINE_TYPE_COLORS } from "@/types/constants";
import type { WineType } from "@/types/wine";

/** Brighten a hex color for use as border on filled cells */
export function brightenColor(hex: string, amount = 0.3): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const br = Math.min(255, Math.round(r + (255 - r) * amount));
  const bg = Math.min(255, Math.round(g + (255 - g) * amount));
  const bb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${br.toString(16).padStart(2, "0")}${bg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
}

export const DISPOSITION_COLORS: Record<string, string> = {
  D: "#2e7d32",
  H: "#1565c0",
  P: "#c62828",
};

export function getWineColor(type: string): string {
  return WINE_TYPE_COLORS[type as WineType] || "#666";
}

export function getDispositionLabel(disposition: string): string {
  if (disposition === "D" || disposition === "H" || disposition === "P") {
    return disposition;
  }
  return "";
}

export function isTouchDevice(): boolean {
  return typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
}
