import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// AdSense rejection root cause (2026-09-21): the landing page returned a
// "Loading..." shell for the entire server render — Firebase auth is always
// "loading" during SSR, and Google's crawler saw an empty page. The marketing
// content must render server-side for anonymous/loading visitors; only a
// resolved signed-in user (who is being redirected to /cellar) may see the
// shell.

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// Mutable auth state the mocked provider returns.
const state = vi.hoisted(() => ({ auth: { user: null as { uid: string } | null, loading: true } }));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => state.auth,
}));

import LandingPage from "@/app/landing-client";

beforeEach(() => {
  pushMock.mockReset();
});

describe("Landing page server-visible content", () => {
  it("renders the marketing content while auth is still loading (what crawlers receive)", () => {
    state.auth = { user: null, loading: true };
    render(<LandingPage />);
    expect(screen.getAllByText(/Your cellar, visualized/i).length).toBeGreaterThan(0);
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("renders the marketing content for signed-out visitors", () => {
    state.auth = { user: null, loading: false };
    render(<LandingPage />);
    expect(screen.getAllByText(/Your cellar, visualized/i).length).toBeGreaterThan(0);
  });

  it("still shows the redirect shell once a user resolves (being routed to /cellar)", () => {
    state.auth = { user: { uid: "u1" }, loading: false };
    render(<LandingPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText(/Your cellar, visualized/i)).not.toBeInTheDocument();
  });
});
