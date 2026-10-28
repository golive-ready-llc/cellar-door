import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { generateStatsCard } from "@/lib/share-utils";

/**
 * jsdom has no canvas backend — stub the 2d context and record the text the
 * card actually draws.
 */
const fillTextArgs: string[] = [];
const gradient = { addColorStop: () => {} };
const ctxStub = {
  fillText: (text: unknown) => fillTextArgs.push(String(text)),
  createLinearGradient: () => gradient,
  measureText: (t: string) => ({ width: t.length * 8 }),
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  quadraticCurveTo: () => {},
  closePath: () => {},
  fill: () => {},
} as unknown as CanvasRenderingContext2D;

const originalGetContext = HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctxStub);
});
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

/**
 * Regression: the share card hardcoded `$${totalValue}` while every screen
 * in the app formats prices through useCurrency (stored values are USD; the
 * display currency converts). A EUR user shared an image claiming their
 * cellar was worth a dollar amount the app itself never shows. The caller
 * now injects its display formatter so the card matches the hero cards.
 */
describe("generateStatsCard currency", () => {
  it("draws the caller-formatted collection value, not a hardcoded $ amount", () => {
    const stats = {
      totalBottles: 12,
      totalValue: 12400,
      byType: { red: 12 },
      topRegion: "Bordeaux",
      topGrape: "Cabernet",
    };
    const eur = (usd: number) => `€${Math.round(usd * 0.92).toLocaleString("de-DE")}`;

    generateStatsCard(stats, eur);

    expect(fillTextArgs).toContain(eur(12400));
    expect(fillTextArgs).not.toContain("$12,400");
  });
});
