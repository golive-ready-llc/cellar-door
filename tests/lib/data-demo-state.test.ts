import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The data layer used to switch to the in-memory demo store whenever the
 * `demo_mode` cookie was present, even for a signed-in user. A real account
 * then read an empty "demo" cellar, which also triggered the first-run
 * "Name Your Cellar" wizard. Demo data must follow the auth provider's demo
 * state, not a leftover cookie.
 */

const getWinesSpy = vi.fn(async (_uid: string) => [{ id: "real-wine" }]);
vi.mock("@/server/actions/wines", () => ({
  getWines: (uid: string) => getWinesSpy(uid),
}));

const mockGetWinesSpy = vi.fn((_uid: string) => [{ id: "demo-wine" }]);
vi.mock("@/lib/mock-store", () => ({
  mockStore: { getWines: (uid: string) => mockGetWinesSpy(uid) },
}));

import { fetchWines, invalidateReadCache } from "@/lib/data";
import { setDemoModeActive } from "@/lib/demo-state";

describe("data layer demo mode", () => {
  beforeEach(() => {
    getWinesSpy.mockClear();
    mockGetWinesSpy.mockClear();
    invalidateReadCache();
  });

  afterEach(() => {
    document.cookie = "demo_mode=; path=/; max-age=0";
    setDemoModeActive(false);
  });

  it("reads real data for a signed-in user even when a leftover demo cookie exists", async () => {
    document.cookie = "demo_mode=true; path=/";
    setDemoModeActive(false);
    const wines = await fetchWines("u-real");
    expect(wines).toEqual([{ id: "real-wine" }]);
    expect(getWinesSpy).toHaveBeenCalledWith("u-real");
    expect(mockGetWinesSpy).not.toHaveBeenCalled();
  });

  it("serves demo data when the auth provider is in demo mode", async () => {
    setDemoModeActive(true);
    const wines = await fetchWines("demo-user-001");
    expect(wines).toEqual([{ id: "demo-wine" }]);
    expect(getWinesSpy).not.toHaveBeenCalled();
  });
});
