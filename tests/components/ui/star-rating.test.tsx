import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StarRating, RatingDistribution } from "@/components/ui/star-rating";

describe("StarRating (full mode)", () => {
  it("clips the gold row to the fractional rating", () => {
    const { container } = render(<StarRating value={3.6} />);
    // 3.6 / 5 = 72% — the overlay fill row is a span[aria-hidden] (the lucide
    // star svgs also carry aria-hidden, so scope to the span).
    const fill = container.querySelector("span[aria-hidden]") as HTMLElement;
    expect(fill).not.toBeNull();
    expect(fill.style.width).toBe("72%");
  });

  it("clamps out-of-range values", () => {
    const { container: over } = render(<StarRating value={7} />);
    expect((over.querySelector("span[aria-hidden]") as HTMLElement).style.width).toBe("100%");
    const { container: under } = render(<StarRating value={-2} />);
    expect((under.querySelector("span[aria-hidden]") as HTMLElement).style.width).toBe("0%");
  });

  it("exposes the value via aria-label and optional text", () => {
    render(<StarRating value={4.25} showValue />);
    expect(screen.getByLabelText("4.3 out of 5")).toBeInTheDocument();
    expect(screen.getByText("4.3")).toBeInTheDocument();
  });
});

describe("StarRating (compact mode)", () => {
  it("renders a single star + numeric value", () => {
    const { container } = render(<StarRating value={4.8} compact />);
    expect(screen.getByText("4.8")).toBeInTheDocument();
    // Exactly one star icon in compact mode (svg)
    expect(container.querySelectorAll("svg").length).toBe(1);
  });
});

describe("RatingDistribution", () => {
  it("buckets ratings 5→1 and shows the total", () => {
    render(<RatingDistribution ratings={[5, 5, 4.6, 3, 1, 1.4]} />);
    // 4.6 rounds to 5 → three 5s; 1.4 rounds to 1 → two 1s
    expect(screen.getByText("6 ratings")).toBeInTheDocument();
    // Row counts render as text: 3 (5★), 0 (4★), 1 (3★), 0 (2★), 2 (1★)
    const counts = screen.getAllByText(/^[0-9]+$/).map((el) => el.textContent);
    expect(counts).toEqual(expect.arrayContaining(["3", "1", "2"]));
  });

  it("singularizes a lone rating", () => {
    render(<RatingDistribution ratings={[4]} />);
    expect(screen.getByText("1 rating")).toBeInTheDocument();
  });
});
