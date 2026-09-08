import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const {
  ensurePermissionsMock,
  getPermissionStateMock,
  reconcileWineNotificationsMock,
  scheduleMonthlyDigestMock,
  cancelAllScheduledMock,
  useWineDataMock,
  capacitorMock,
} = vi.hoisted(() => ({
  ensurePermissionsMock: vi.fn(),
  getPermissionStateMock: vi.fn(),
  reconcileWineNotificationsMock: vi.fn(),
  scheduleMonthlyDigestMock: vi.fn(),
  cancelAllScheduledMock: vi.fn(),
  useWineDataMock: vi.fn(),
  capacitorMock: { isNative: true },
}));

vi.mock("@/lib/notifications", () => ({
  ensurePermissions: ensurePermissionsMock,
  getPermissionState: getPermissionStateMock,
  reconcileWineNotifications: reconcileWineNotificationsMock,
  scheduleMonthlyDigest: scheduleMonthlyDigestMock,
  cancelAllScheduled: cancelAllScheduledMock,
}));

vi.mock("@/contexts/wine-data-context", () => ({
  useWineData: () => useWineDataMock(),
}));

vi.mock("@/lib/capacitor", () => ({
  get isNative() {
    return capacitorMock.isNative;
  },
}));

import { useNotifications } from "@/hooks/use-notifications";

const TOGGLE_KEY = "cd:notifications:enabled";
const LAST_RECONCILE_KEY = "cd:notifications:lastReconcileWineCount";

function makeWine(id: string, drinkWindow = "2025-2030") {
  return { id, drinkWindow } as never;
}

describe("useNotifications", () => {
  beforeEach(() => {
    localStorage.clear();
    ensurePermissionsMock.mockReset().mockResolvedValue(true);
    getPermissionStateMock.mockReset().mockResolvedValue("granted");
    reconcileWineNotificationsMock.mockReset().mockResolvedValue(undefined);
    scheduleMonthlyDigestMock.mockReset().mockResolvedValue(undefined);
    cancelAllScheduledMock.mockReset().mockResolvedValue(undefined);
    useWineDataMock.mockReset().mockReturnValue({ wines: [] });
    capacitorMock.isNative = true;
  });

  it("default `enabled` is true when localStorage is empty", async () => {
    const { result } = renderHook(() => useNotifications());
    // hydration effect runs synchronously after mount
    await waitFor(() => expect(result.current.enabled).toBe(true));
  });

  it("toggling off calls cancelAllScheduled and persists 'false'", async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.enabled).toBe(true));

    await act(async () => {
      await result.current.setEnabled(false);
    });

    expect(localStorage.getItem(TOGGLE_KEY)).toBe("false");
    expect(cancelAllScheduledMock).toHaveBeenCalledTimes(1);
    expect(result.current.enabled).toBe(false);
  });

  it("toggling on calls ensurePermissions; granted → permission becomes 'granted'", async () => {
    localStorage.setItem(TOGGLE_KEY, "false");
    ensurePermissionsMock.mockResolvedValue(true);

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.enabled).toBe(false));

    await act(async () => {
      await result.current.setEnabled(true);
    });

    expect(ensurePermissionsMock).toHaveBeenCalledTimes(1);
    expect(result.current.enabled).toBe(true);
    expect(result.current.permission).toBe("granted");
  });

  it("toggling on with denied permission sets permission='denied'", async () => {
    localStorage.setItem(TOGGLE_KEY, "false");
    ensurePermissionsMock.mockResolvedValue(false);

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.enabled).toBe(false));

    await act(async () => {
      await result.current.setEnabled(true);
    });

    expect(result.current.permission).toBe("denied");
  });

  it("reconciler effect skips when isNative is false", async () => {
    capacitorMock.isNative = false;
    useWineDataMock.mockReturnValue({ wines: [makeWine("w1")] });

    renderHook(() => useNotifications());
    // give effects a chance to run
    await new Promise((r) => setTimeout(r, 20));

    expect(reconcileWineNotificationsMock).not.toHaveBeenCalled();
    expect(scheduleMonthlyDigestMock).not.toHaveBeenCalled();
  });

  it("reconciler runs once per fingerprint; same wines on rerender does not re-run", async () => {
    const wines = [makeWine("w1", "2025-2030")];
    useWineDataMock.mockReturnValue({ wines });

    const { rerender } = renderHook(() => useNotifications());

    await waitFor(() =>
      expect(reconcileWineNotificationsMock).toHaveBeenCalledTimes(1)
    );
    expect(scheduleMonthlyDigestMock).toHaveBeenCalledTimes(1);

    // Re-render with the SAME wine list reference contents — the
    // fingerprint guard short-circuits before calling reconcile again.
    rerender();
    await new Promise((r) => setTimeout(r, 20));

    expect(reconcileWineNotificationsMock).toHaveBeenCalledTimes(1);
  });

  it("adding a wine triggers a new reconcile", async () => {
    const wines = [makeWine("w1")];
    useWineDataMock.mockReturnValue({ wines });

    const { rerender } = renderHook(() => useNotifications());
    await waitFor(() =>
      expect(reconcileWineNotificationsMock).toHaveBeenCalledTimes(1)
    );

    // change the underlying data — fingerprint changes → reconcile runs
    useWineDataMock.mockReturnValue({
      wines: [makeWine("w1"), makeWine("w2")],
    });
    rerender();

    await waitFor(() =>
      expect(reconcileWineNotificationsMock).toHaveBeenCalledTimes(2)
    );
  });

  it("supported reflects isNative", async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.supported).toBe(true));
  });

  it("toggling off removes the lastReconcile key so next toggle-on re-runs", async () => {
    localStorage.setItem(LAST_RECONCILE_KEY, "stale-fingerprint");
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.enabled).toBe(true));

    await act(async () => {
      await result.current.setEnabled(false);
    });
    expect(localStorage.getItem(LAST_RECONCILE_KEY)).toBeNull();
  });
});
