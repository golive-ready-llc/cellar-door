import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// getScoreColor lives in community-score, which imports the data layer.
vi.mock("@/lib/data", () => ({
  submitCdRating: vi.fn(),
  fetchCommunityScore: vi.fn().mockResolvedValue(null),
  fetchCommunityRatings: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/hooks/use-tier", () => ({
  useTier: () => ({ userId: "u1", tier: "PRO", hasAI: true, can: () => true }),
}));

import { ExpertScoreInline } from "@/components/wine/expert-score";

describe("ExpertScoreInline", () => {
  it("renders the converted 0-5 score from a single critic estimate", () => {
    // 96 on the 100-pt scale → 2 + (96-80)/8 = 4.0
    render(<ExpertScoreInline aiRatings={{ rating_ws: 96 }} />);
    expect(screen.getByText("Expert Score")).toBeInTheDocument();
    expect(screen.getByText("4.0")).toBeInTheDocument();
  });

  it("averages multiple critic estimates before converting", () => {
    // avg(92, 88) = 90 → 2 + 10/8 = 3.25 → shown as 3.3
    render(
      <ExpertScoreInline aiRatings={{ rating_ws: 92, rating_rp: 88 }} />
    );
    expect(screen.getByText("3.3")).toBeInTheDocument();
  });

  it("names the underlying critics in the tooltip", () => {
    render(<ExpertScoreInline aiRatings={{ rating_ws: 92, rating_jd: 90 }} />);
    const badge = screen.getByTitle(/Wine Spectator 92 · Jeb Dunnuck 90/);
    expect(badge).toBeInTheDocument();
  });

  it("renders nothing when there are no ratings", () => {
    const { container: empty } = render(<ExpertScoreInline aiRatings={null} />);
    expect(empty).toBeEmptyDOMElement();
    const { container: allNull } = render(
      <ExpertScoreInline aiRatings={{ rating_ws: undefined, rating_rp: undefined }} />
    );
    expect(allNull).toBeEmptyDOMElement();
  });
});
