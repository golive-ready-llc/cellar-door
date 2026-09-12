import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Real module (no mock): these tests pin the store semantics that both the
// banner and the Add-Wine FAB rely on.
import {
  useCookieConsent,
  useConsentBannerVisible,
  setCookieConsent,
  openCookieSettings,
} from "@/lib/cookie-consent";

const STORAGE_KEY = "cd_cookie_consent";

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY);
  // The store caches the storage read; the window "storage" listener it
  // registers is how a fresh read happens (same-tab tests simulate the
  // other-tab write).
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
});

describe("cookie-consent store", () => {
  it("banner is visible while consent is undecided (first visit)", () => {
    const { result } = renderHook(() => useConsentBannerVisible());
    expect(result.current).toBe(true);
  });

  it("banner hides once consent is decided", () => {
    const { result } = renderHook(() => useConsentBannerVisible());
    act(() => setCookieConsent("accepted"));
    expect(result.current).toBe(false);
  });

  it("banner reappears when reopened from Cookie settings, clears on re-decide", () => {
    const consent = renderHook(() => useCookieConsent());
    const banner = renderHook(() => useConsentBannerVisible());
    act(() => setCookieConsent("rejected"));
    expect(banner.result.current).toBe(false);

    act(() => openCookieSettings());
    expect(banner.result.current).toBe(true);
    expect(consent.result.current).toBe("rejected"); // choice itself unchanged

    act(() => setCookieConsent("rejected"));
    expect(banner.result.current).toBe(false);
  });

  it("persists the choice to localStorage", () => {
    act(() => setCookieConsent("accepted"));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("accepted");
  });
});
