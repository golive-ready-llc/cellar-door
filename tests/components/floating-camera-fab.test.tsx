import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// The banner-visibility derivation lives in the consent store (covered by
// tests/lib/cookie-consent.test.ts); here it's a plain toggle so the FAB's
// positioning contract is tested in isolation.
const state = vi.hoisted(() => ({
  bannerUp: false,
}));

vi.mock("@/lib/cookie-consent", () => ({
  useConsentBannerVisible: () => state.bannerUp,
}));

const openCameraFirstMock = vi.fn();

vi.mock("@/components/add-wine-context", () => ({
  useAddWine: () => ({
    ready: true,
    _onAdd: () => {},
    _openCameraFirst: openCameraFirstMock,
  }),
}));

vi.mock("@/components/chat/chat-open-store", () => ({
  subscribeChatPanelOpen: (cb: () => void) => {
    window.addEventListener("chat-open-test", cb);
    return () => window.removeEventListener("chat-open-test", cb);
  },
  getChatPanelOpen: () => false,
}));

import { FloatingCameraFab } from "@/components/floating-camera-fab";

function fabClass(): string {
  return screen.getByRole("button", { name: "Add wine" }).className;
}

beforeEach(() => {
  state.bannerUp = false;
  openCameraFirstMock.mockReset();
});

describe("FloatingCameraFab vs cookie-consent banner", () => {
  it("lifts above the banner while the banner is visible (first visit)", () => {
    state.bannerUp = true;
    render(<FloatingCameraFab />);
    expect(fabClass()).toContain("bottom-[13.5rem]");
    expect(fabClass()).not.toContain("bottom-6");
  });

  it("sits at the normal corner when no banner is up", () => {
    render(<FloatingCameraFab />);
    expect(fabClass()).toContain("bottom-6");
    expect(fabClass()).not.toContain("bottom-[13.5rem]");
  });

  it("still opens the add-wine camera flow on click", () => {
    render(<FloatingCameraFab />);
    screen.getByRole("button", { name: "Add wine" }).click();
    expect(openCameraFirstMock).toHaveBeenCalled();
  });
});
