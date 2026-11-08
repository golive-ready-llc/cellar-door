// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Wine lists mount a page of 60 rows at once, and every row that has a label
 * photo renders it through a plain <img> the size of an avatar (40–56 px).
 * Eager <img>s fetch the full-size photo for every mounted row during page
 * paint — measured on the demo cellar's inventory (60 rows, 27 label photos,
 * all below the fold): 7–9 label fetches fire in the load window with none
 * visible on screen, and the rest queue behind them. `loading="lazy"` holds
 * off-screen avatars until the user scrolls near them (the demo page fires 0
 * at load), and `decoding="async"` keeps the decode of the ones that do load
 * off the first-paint critical path.
 *
 * Full-size displays (the label lightbox, the dialog hero) stay eager on
 * purpose — they are the "view large" surfaces. This test pins the list
 * avatars only.
 */

const CASES = [
  // Canonical wine row — inventory, buy list, history, discover, stats sheets.
  { file: "src/components/inventory/wine-list-item.tsx", src: "src={wine.imageUrl}" },
  // Inventory grid card.
  { file: "src/components/inventory/wine-grid-item.tsx", src: "src={wine.imageUrl}" },
  // Activity feed row.
  { file: "src/app/(app)/activity/page.tsx", src: "src={event.imageUrl}" },
  // Guest shared-cellar voting list.
  { file: "src/app/guest/[code]/page.tsx", src: "src={wine.imageUrl}" },
] as const;

/** The portrait thumbnail in wine-label-thumbnail.tsx — the only small
 *  display there; its lightbox/hero imgs show the label large and stay eager. */
const PORTRAIT_FILE = "src/components/wine/wine-label-thumbnail.tsx";

function imgTags(text: string): string[] {
  return text.match(/<img\b[^>]*>/g) ?? [];
}

describe("label-photo avatars in lists defer their fetch and decode", () => {
  it.each(CASES)("$file renders every label photo with loading=lazy decoding=async", ({ file, src }) => {
    const text = fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
    const avatars = imgTags(text).filter((tag) => tag.includes(src));
    expect(avatars.length, `expected at least one <img> with ${src}`).toBeGreaterThan(0);
    for (const tag of avatars) {
      expect(tag, tag).toContain(`loading="lazy"`);
      expect(tag, tag).toContain(`decoding="async"`);
    }
  });

  it("the dialog portrait thumbnail defers its fetch and decode", () => {
    const text = fs.readFileSync(path.resolve(process.cwd(), PORTRAIT_FILE), "utf8");
    const portrait = imgTags(text).filter(
      (tag) => tag.includes("src={imageUrl}") && tag.includes("w-full h-full object-cover"),
    );
    expect(portrait, "expected the portrait thumbnail <img>").toHaveLength(1);
    expect(portrait[0]).toContain(`loading="lazy"`);
    expect(portrait[0]).toContain(`decoding="async"`);
  });
});
