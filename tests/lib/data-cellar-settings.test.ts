import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The data layer's cellar settings: signed-in users read and save them on
 * their account through the server, passing their user id. Demo visitors
 * browse a sample cellar, so they never see first-run setup and can't save.
 */

const serverGet = vi.fn();
const serverSave = vi.fn();
vi.mock("@/server/actions/cellar-settings", () => ({
  getCellarSettings: (...args: unknown[]) => serverGet(...args),
  saveCellarSettings: (...args: unknown[]) => serverSave(...args),
}));

import { fetchCellarSettings, saveCellarSettings } from "@/lib/data";
import { setDemoModeActive } from "@/lib/demo-state";

describe("cellar settings in the data layer", () => {
  beforeEach(() => {
    serverGet.mockReset();
    serverSave.mockReset();
    setDemoModeActive(false);
  });

  afterEach(() => setDemoModeActive(false));

  it("reads a signed-in user's settings from the account", async () => {
    serverGet.mockResolvedValue({ onboarded: true, cellarName: "The Vault" });
    expect(await fetchCellarSettings("u1")).toEqual({ onboarded: true, cellarName: "The Vault" });
    expect(serverGet).toHaveBeenCalledWith("u1");
  });

  it("saves a signed-in user's settings to the account", async () => {
    serverSave.mockResolvedValue({ onboarded: false, cellarName: "The Vault" });
    await saveCellarSettings({ cellarName: "The Vault" }, "u1");
    expect(serverSave).toHaveBeenCalledWith({ cellarName: "The Vault" }, "u1");
  });

  it("never shows first-run setup to a demo visitor", async () => {
    setDemoModeActive(true);
    expect(await fetchCellarSettings("demo-user-001")).toEqual({ onboarded: true, cellarName: "" });
    expect(serverGet).not.toHaveBeenCalled();
  });

  it("refuses to save in demo mode", async () => {
    setDemoModeActive(true);
    await expect(saveCellarSettings({ cellarName: "X" }, "demo-user-001")).rejects.toThrow("read-only");
    expect(serverSave).not.toHaveBeenCalled();
  });
});
