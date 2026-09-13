import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";

/**
 * A /demo visit leaves a site-wide `demo_mode` cookie for an hour. Signing in
 * with a real account afterwards used to keep the app in demo mode: the auth
 * provider checked the cookie once on mount and never subscribed to Firebase,
 * so the owner saw the demo banner and demo data over their own account.
 * A real sign-in must always win over a leftover demo cookie.
 */

const h = vi.hoisted(() => ({
  listener: null as null | ((user: unknown) => void | Promise<void>),
  getUserProfile: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  auth: () => ({ currentUser: null }),
  isFirebaseConfigured: true,
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    h.listener = cb;
    return () => {};
  },
  prewarmNativeAuth: () => Promise.resolve(),
}));
vi.mock("firebase/auth", () => ({ getRedirectResult: () => Promise.resolve(null) }));
vi.mock("@/lib/single-user", () => ({ isSingleUserMode: () => false }));
vi.mock("@/server/actions/auth", () => ({
  getUserProfile: (...args: unknown[]) => h.getUserProfile(...args),
  getSingleUserProfile: vi.fn(),
}));

import { AuthProvider, useAuth } from "@/components/auth-provider";
import { isDemoModeActive, setDemoModeActive } from "@/lib/demo-state";

function Probe() {
  const { demoMode, userId, loading } = useAuth();
  return <div data-testid="state">{JSON.stringify({ demoMode, userId, loading })}</div>;
}

function state() {
  return JSON.parse(screen.getByTestId("state").textContent || "{}");
}

describe("AuthProvider demo mode", () => {
  beforeEach(() => {
    h.listener = null;
    h.getUserProfile.mockReset();
    setDemoModeActive(false);
  });

  afterEach(() => {
    document.cookie = "demo_mode=; path=/; max-age=0";
  });

  it("stays in demo mode when a demo cookie is set and nobody signs in", async () => {
    document.cookie = "demo_mode=true; path=/";
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await act(async () => {
      await h.listener?.(null);
    });
    expect(state()).toMatchObject({ demoMode: true, userId: "demo-user-001", loading: false });
    expect(isDemoModeActive()).toBe(true);
  });

  it("leaves demo mode and clears the cookie when a real user signs in", async () => {
    document.cookie = "demo_mode=true; path=/";
    h.getUserProfile.mockResolvedValue({ id: "u-real", tier: "PREMIUM" });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(h.listener).toBeTypeOf("function");
    await act(async () => {
      await h.listener?.({ email: "owner@example.com", getIdToken: async () => "token" });
    });
    await waitFor(() => expect(state()).toMatchObject({ demoMode: false, userId: "u-real" }));
    expect(document.cookie).not.toContain("demo_mode=true");
    expect(isDemoModeActive()).toBe(false);
  });
});
