import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mocks (hoisted for vi.mock factories)
const { getIdTokenMock, toastErrorMock } = vi.hoisted(() => ({
  getIdTokenMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ getIdToken: getIdTokenMock }),
}));

vi.mock("@/components/ui/custom-toast", () => ({
  toast: { error: toastErrorMock, success: vi.fn() },
}));

import { useCheckout } from "@/hooks/use-checkout";

describe("useCheckout", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    getIdTokenMock.mockReset();
    toastErrorMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("startCheckout: token-null early return resets checkoutLoading", async () => {
    getIdTokenMock.mockResolvedValue(null);
    const { result } = renderHook(() => useCheckout());
    expect(result.current.checkoutLoading).toBe(false);

    await act(async () => {
      await result.current.startCheckout("PRO", "monthly");
    });

    expect(toastErrorMock).toHaveBeenCalledWith(
      expect.stringContaining("sign in")
    );
    expect(result.current.checkoutLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("startCheckout: fetch error resets checkoutLoading (not stuck)", async () => {
    getIdTokenMock.mockResolvedValue("token-abc");
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "boom" }),
    });

    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      await result.current.startCheckout("PRO");
    });

    expect(toastErrorMock).toHaveBeenCalledWith("boom");
    expect(result.current.checkoutLoading).toBe(false);
  });

  it("startCheckout: network rejection resets checkoutLoading", async () => {
    getIdTokenMock.mockResolvedValue("token-abc");
    fetchMock.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      await result.current.startCheckout("PRO");
    });

    expect(toastErrorMock).toHaveBeenCalledWith("network down");
    expect(result.current.checkoutLoading).toBe(false);
  });

  it("openPortal: token-null early return resets portalLoading", async () => {
    getIdTokenMock.mockResolvedValue(null);
    const { result } = renderHook(() => useCheckout());

    await act(async () => {
      await result.current.openPortal();
    });

    expect(toastErrorMock).toHaveBeenCalledWith(
      expect.stringContaining("sign in")
    );
    expect(result.current.portalLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("openPortal: fetch error resets portalLoading", async () => {
    getIdTokenMock.mockResolvedValue("token-abc");
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "portal-fail" }),
    });

    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      await result.current.openPortal();
    });

    expect(toastErrorMock).toHaveBeenCalledWith("portal-fail");
    expect(result.current.portalLoading).toBe(false);
  });

  it("flips checkoutLoading true during in-flight call", async () => {
    getIdTokenMock.mockResolvedValue("token-abc");
    let resolveFetch: (v: unknown) => void = () => {};
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    const { result } = renderHook(() => useCheckout());
    let checkoutPromise: Promise<void>;
    act(() => {
      checkoutPromise = result.current.startCheckout("PRO");
    });

    await waitFor(() => expect(result.current.checkoutLoading).toBe(true));

    await act(async () => {
      resolveFetch({ ok: false, json: async () => ({ error: "x" }) });
      await checkoutPromise!;
    });
    expect(result.current.checkoutLoading).toBe(false);
  });
});
