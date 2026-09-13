import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * The banner used to read the `demo_mode` cookie on its own, so a leftover
 * cookie from a /demo visit showed "Demo mode" over a signed-in owner's real
 * cellar. It must follow the auth provider's demo state instead.
 */

const auth = vi.hoisted(() => ({ demoMode: false }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => auth }));

import { DemoBanner } from "@/components/demo-banner";

describe("DemoBanner", () => {
  afterEach(() => {
    document.cookie = "demo_mode=; path=/; max-age=0";
  });

  it("stays hidden for a signed-in user even when a leftover demo cookie exists", () => {
    document.cookie = "demo_mode=true; path=/";
    auth.demoMode = false;
    render(<DemoBanner />);
    expect(screen.queryByRole("status", { name: "Demo mode" })).toBeNull();
  });

  it("shows when the app is in demo mode", () => {
    auth.demoMode = true;
    render(<DemoBanner />);
    expect(screen.getByRole("status", { name: "Demo mode" })).toBeInTheDocument();
  });
});
