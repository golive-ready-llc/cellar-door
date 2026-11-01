import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

import { ChallengeCard } from "@/components/challenges/challenge-card";
import type { ChallengeData } from "@/server/actions/challenges";

/**
 * The card reads the clock from state (Date.now() can't run during render).
 * A card that is open when its deadline passes must still flip to expired
 * and hide "Mark Complete", not stay completable until it remounts.
 */

function challenge(expiresAt: Date): ChallengeData {
  return {
    id: "c1",
    userId: "u1",
    title: "Try a Riesling",
    description: "Open a bottle of Riesling this week.",
    type: "taste",
    criteria: {},
    completed: false,
    completedAt: null,
    expiresAt,
    createdAt: new Date("2026-10-26T00:00:00Z"),
  };
}

describe("ChallengeCard expiry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("flips to expired when the deadline passes while mounted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
    render(
      <ChallengeCard
        challenge={challenge(new Date("2026-10-29T12:00:05Z"))}
        onComplete={async () => {}}
      />
    );
    expect(screen.getByText("Mark Complete")).toBeTruthy();
    expect(screen.queryByText("Challenge expired")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.queryByText("Mark Complete")).toBeNull();
    expect(screen.getByText("Challenge expired")).toBeTruthy();
  });

  it("shows an already-past deadline as expired on first render", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
    render(
      <ChallengeCard
        challenge={challenge(new Date("2026-10-28T12:00:00Z"))}
        onComplete={async () => {}}
      />
    );
    expect(screen.queryByText("Mark Complete")).toBeNull();
    expect(screen.getByText("Challenge expired")).toBeTruthy();
  });
});
