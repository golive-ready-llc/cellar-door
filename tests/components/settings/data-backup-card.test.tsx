import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * The Settings CSV import used to call bulkCreateWines without the signed-in
 * user's id. In production the data layer refuses a missing id before any
 * request is sent, so every import failed with "Failed to import wines",
 * while local development (which substitutes a dev user) worked fine.
 */

const bulkCreateWines = vi.fn();
vi.mock("@/lib/data", () => ({
  bulkCreateWines: (...args: unknown[]) => bulkCreateWines(...args),
  fetchAllDataForBackup: vi.fn(),
  restoreFromBackup: vi.fn(),
  fetchWines: vi.fn(),
  fetchCabinets: vi.fn(),
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ userId: "user-1" }),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui/custom-toast", () => ({ toast }));

vi.mock("@/lib/capacitor", () => ({ saveAndShareFile: vi.fn() }));

// The real dialog parses a file; a stub that hands back parsed rows is enough
// to exercise the card's import handler.
vi.mock("@/components/wine/csv-import-dialog", () => ({
  CSVImportDialog: ({ onImport }: { onImport: (wines: unknown[]) => Promise<void> }) => (
    <button onClick={() => onImport([{ name: "Alpha" }, { name: "Bravo" }])}>Import CSV</button>
  ),
}));

import { DataBackupCard } from "@/components/settings/data-backup-card";

describe("DataBackupCard CSV import", () => {
  beforeEach(() => {
    bulkCreateWines.mockReset();
    toast.success.mockReset();
    toast.warning.mockReset();
    toast.error.mockReset();
  });

  it("passes the signed-in user's id to the import", async () => {
    bulkCreateWines.mockResolvedValue([{ id: "1" }, { id: "2" }]);
    render(<DataBackupCard />);
    fireEvent.click(screen.getByText("Import CSV"));
    await waitFor(() =>
      expect(bulkCreateWines).toHaveBeenCalledWith([{ name: "Alpha" }, { name: "Bravo" }], "user-1")
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Imported 2 wines"));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
