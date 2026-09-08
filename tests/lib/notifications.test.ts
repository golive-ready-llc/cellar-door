import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the notifications module. Two things to pin down:
 *
 *   1. hashWineId behaves like a stable hash — same input → same output,
 *      different inputs rarely collide. The function isn't exported, but
 *      it's exercised via cancelWineNotifications: when isNative is true
 *      and we mock the plugin, we can read back the id passed to plugin.cancel.
 *
 *   2. Every public function returns early without ever importing the
 *      Capacitor plugin when isNative is false. We assert this by
 *      mocking @/lib/capacitor with isNative:false and confirming the
 *      plugin module is never dynamically imported.
 */

// ─── Mocks ──────────────────────────────────────────────────────────

const checkPermissionsMock = vi.fn();
const requestPermissionsMock = vi.fn();
const scheduleMock = vi.fn();
const cancelMock = vi.fn();
const getPendingMock = vi.fn();

// Track whether the plugin module was ever loaded (it should NOT be on web).
let pluginImportCount = 0;

vi.mock("@capacitor/local-notifications", () => {
  pluginImportCount++;
  return {
    LocalNotifications: {
      checkPermissions: checkPermissionsMock,
      requestPermissions: requestPermissionsMock,
      schedule: scheduleMock,
      cancel: cancelMock,
      getPending: getPendingMock,
    },
  };
});

// Default to web (isNative=false) — individual tests can re-mock to flip.
vi.mock("@/lib/capacitor", () => ({ isNative: false }));

import {
  ensurePermissions,
  getPermissionState,
  scheduleWinePastPeakWarning,
  scheduleMonthlyDigest,
  cancelWineNotifications,
  cancelAllScheduled,
  reconcileWineNotifications,
} from "@/lib/notifications";
import type { Wine } from "@/types/wine";

function makeWine(partial: Partial<Wine>): Wine {
  return {
    id: "wine-1",
    userId: "u",
    cabinetId: null,
    barcode: "",
    name: "Test",
    winery: "",
    region: "",
    country: "",
    vintage: null,
    type: "red",
    sparkling: false,
    grapeVariety: "",
    userRating: null,
    imageUrl: "",
    price: null,
    retailPrice: null,
    purchaseDate: "",
    drinkBy: "",
    notes: "",
    description: "",
    foodPairings: "",
    alcohol: "",
    row: null,
    col: null,
    depth: 0,
    zone: "",
    tastingNotes: null,
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    tags: [],
    addedAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("notifications — web (isNative=false)", () => {
  beforeEach(() => {
    pluginImportCount = 0;
    checkPermissionsMock.mockReset();
    requestPermissionsMock.mockReset();
    scheduleMock.mockReset();
    cancelMock.mockReset();
    getPendingMock.mockReset();
  });

  it("ensurePermissions returns false on web without loading the plugin", async () => {
    expect(await ensurePermissions()).toBe(false);
    expect(pluginImportCount).toBe(0);
    expect(checkPermissionsMock).not.toHaveBeenCalled();
  });

  it("getPermissionState returns 'unsupported' on web", async () => {
    expect(await getPermissionState()).toBe("unsupported");
    expect(pluginImportCount).toBe(0);
  });

  it("scheduleWinePastPeakWarning is a no-op on web", async () => {
    await scheduleWinePastPeakWarning(makeWine({ drinkWindow: "2099-2100" }));
    expect(pluginImportCount).toBe(0);
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("scheduleMonthlyDigest is a no-op on web", async () => {
    await scheduleMonthlyDigest();
    expect(pluginImportCount).toBe(0);
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("cancelWineNotifications is a no-op on web", async () => {
    await cancelWineNotifications("wine-1");
    expect(pluginImportCount).toBe(0);
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it("cancelAllScheduled is a no-op on web", async () => {
    await cancelAllScheduled();
    expect(pluginImportCount).toBe(0);
    expect(getPendingMock).not.toHaveBeenCalled();
  });

  it("reconcileWineNotifications is a no-op on web", async () => {
    await reconcileWineNotifications([makeWine({ drinkWindow: "2099-2100" })]);
    expect(pluginImportCount).toBe(0);
  });
});

/**
 * hashWineId is private to the module, so we verify its behavior indirectly:
 * use vi.resetModules + a re-mock of @/lib/capacitor to flip isNative=true,
 * then call cancelWineNotifications which forwards the hashed id to plugin.cancel.
 */
describe("notifications — hashWineId stability/distinctness (via cancel id)", () => {
  beforeEach(() => {
    vi.resetModules();
    pluginImportCount = 0;
    cancelMock.mockReset();
    cancelMock.mockResolvedValue(undefined);
  });

  async function loadNative() {
    vi.doMock("@/lib/capacitor", () => ({ isNative: true }));
    const mod = await import("@/lib/notifications");
    return mod;
  }

  it("produces a stable id for the same wineId across calls", async () => {
    const mod = await loadNative();
    await mod.cancelWineNotifications("alpha");
    await mod.cancelWineNotifications("alpha");
    expect(cancelMock).toHaveBeenCalledTimes(2);
    const id1 = (cancelMock.mock.calls[0][0] as { notifications: { id: number }[] })
      .notifications[0].id;
    const id2 = (cancelMock.mock.calls[1][0] as { notifications: { id: number }[] })
      .notifications[0].id;
    expect(id1).toBe(id2);
  });

  it("ids land in the [100, 2^31) range and avoid the digest reserved id (1)", async () => {
    const mod = await loadNative();
    await mod.cancelWineNotifications("anything");
    const id = (cancelMock.mock.calls[0][0] as { notifications: { id: number }[] })
      .notifications[0].id;
    expect(id).toBeGreaterThanOrEqual(100);
    expect(id).toBeLessThan(2 ** 31);
    expect(id).not.toBe(1);
  });

  it("100 distinct wineIds collide on fewer than 5% of pairs", async () => {
    const mod = await loadNative();
    const ids = new Set<number>();
    for (let i = 0; i < 100; i++) {
      cancelMock.mockClear();
      await mod.cancelWineNotifications(`wine-${i}-${Math.random()}`);
      const id = (cancelMock.mock.calls[0][0] as { notifications: { id: number }[] })
        .notifications[0].id;
      ids.add(id);
    }
    // Allow up to 5% collisions (expected near 0 for 100 random ids in a 30-bit space).
    expect(ids.size).toBeGreaterThanOrEqual(95);
  });
});
