import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Controllable stand-in for the consent store. Mirrors the real module's
// semantics (reactive value + reopen-event subscription) so the component's
// visibility logic is exercised against lifelike behavior.
const state = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    consent: null as "accepted" | "rejected" | null,
    listeners,
    notify() {
      listeners.forEach((l) => l());
    },
  };
});

vi.mock("@/lib/cookie-consent", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useCookieConsent: () =>
      useSyncExternalStore(
        (cb: () => void) => {
          state.listeners.add(cb);
          return () => state.listeners.delete(cb);
        },
        () => state.consent
      ),
    setCookieConsent: (value: "accepted" | "rejected") => {
      state.consent = value;
      state.notify();
    },
    onOpenCookieSettings: (cb: () => void) => {
      state.listeners.add(cb);
      return () => state.listeners.delete(cb);
    },
  };
});

// Stub next/link so we render a vanilla <a>.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href}>{children}</a>
  ),
}));

import { CookieConsent } from "@/components/consent/cookie-consent";

beforeEach(() => {
  state.consent = null;
});

describe("CookieConsent banner", () => {
  it("renders when consent is undecided", () => {
    render(<CookieConsent />);
    expect(screen.getByRole("dialog", { name: "Cookie consent" })).toBeTruthy();
  });

  it("does not render once consent is decided", () => {
    state.consent = "accepted";
    render(<CookieConsent />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lets clicks pass through the full-width wrapper but not the card", () => {
    render(<CookieConsent />);
    // The wrapper spans the whole bottom strip; without pointer-events-none
    // it swallowed clicks on the desktop Add-Wine FAB even where the card
    // doesn't reach (fixed inset-x-0 overlay).
    const wrapper = screen.getByRole("dialog", { name: "Cookie consent" });
    expect(wrapper.className).toContain("pointer-events-none");

    // The visible card must keep receiving clicks for its own buttons.
    const accept = screen.getByRole("button", { name: "Accept all" });
    const card = accept.closest('div[class*="pointer-events-auto"]');
    expect(card).toBeTruthy();
  });

  it("hides after choosing", () => {
    render(<CookieConsent />);
    fireEvent.click(screen.getByRole("button", { name: "Reject non-essential" }));
    expect(state.consent).toBe("rejected");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
