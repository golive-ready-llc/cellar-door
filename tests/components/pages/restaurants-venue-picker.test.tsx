import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/server/actions/business-leads", () => ({
  submitBusinessLead: async () => {},
}));

import { RestaurantsClient } from "@/app/restaurants/restaurants-client";

/**
 * AGENTS.md selection-tile rule: every venue-type option shows its
 * distinguishing accent at ALL times (the icon), and selection turns that
 * accent into the pill's border — not a generic primary fill that leaves
 * the four options identical until tapped.
 */

const VENUE_ACCENTS: Record<string, string> = {
  Restaurant: "#f59e0b",
  "Wine bar": "#a855f7",
  "Wine shop / retail": "#10b981",
  Other: "#3b82f6",
};

/** jsdom normalizes hex inline colors to rgb(). */
function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(", ");
}

function pill(label: string) {
  return screen.getByRole("button", { name: label });
}

describe("restaurants venue-type picker", () => {
  it("shows each option's accent on its icon before anything is selected", () => {
    render(<RestaurantsClient />);

    const accents = new Set<string>();
    for (const [label, hex] of Object.entries(VENUE_ACCENTS)) {
      const icon = pill(label).querySelector("svg");
      expect(icon).not.toBeNull();
      expect(icon!.style.color).toMatch(new RegExp(rgb(hex)));
      accents.add(icon!.style.color);
    }
    // Four options, four distinguishable accents.
    expect(accents.size).toBe(4);
  });

  it("selects with the option's own accent as its border", () => {
    render(<RestaurantsClient />);

    fireEvent.click(pill("Wine bar"));

    expect(pill("Wine bar").style.borderColor).toMatch(new RegExp(rgb("#a855f7")));
    for (const label of Object.keys(VENUE_ACCENTS)) {
      if (label === "Wine bar") continue;
      expect(pill(label).style.borderColor).toBe("");
    }
  });
});
