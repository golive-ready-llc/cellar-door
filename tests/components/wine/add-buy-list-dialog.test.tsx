import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { BuyListItem } from "@/types/wine";

const onAddMock = vi.fn<
  (item: Omit<BuyListItem, "id" | "addedAt" | "userId">) => Promise<void>
>();

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  default: vi.fn(),
}));
vi.mock("@/components/ui/custom-toast", () => ({ toast: toastMock }));

import { AddBuyListDialog } from "@/components/wine/add-buy-list-dialog";

/**
 * Regression: the submit handler fired onAdd without awaiting it, then
 * reset the form and closed the dialog — a failed save surfaced as an
 * unhandled rejection while the typed entry silently vanished. The save is
 * awaited now: on failure the entry stays in the open form and the user is
 * told, matching how Mark Purchased handles a failed cellar add.
 */
describe("AddBuyListDialog failed save", () => {
  beforeEach(() => {
    onAddMock.mockReset();
    toastMock.error.mockClear();
  });

  it("keeps the typed entry and toasts when the save fails", async () => {
    onAddMock.mockRejectedValue(new Error("network down"));
    render(<AddBuyListDialog onAdd={onAddMock} />);

    fireEvent.click(screen.getByRole("button", { name: "Add to List" }));
    const nameInput = await screen.findByLabelText(/Wine Name/);
    fireEvent.change(nameInput, { target: { value: "Bollinger RD" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to Buy List" }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        expect.stringContaining("Bollinger RD")
      );
    });
    // The typed entry survives — it was not saved, so it must not be lost.
    expect(screen.getByLabelText(/Wine Name/)).toHaveValue("Bollinger RD");
  });

  it("closes and clears the form when the save succeeds", async () => {
    onAddMock.mockResolvedValue(undefined);
    render(<AddBuyListDialog onAdd={onAddMock} />);

    fireEvent.click(screen.getByRole("button", { name: "Add to List" }));
    const nameInput = await screen.findByLabelText(/Wine Name/);
    fireEvent.change(nameInput, { target: { value: "Screaming Eagle" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to Buy List" }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/Wine Name/)).not.toBeInTheDocument();
    });
    expect(onAddMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Screaming Eagle" })
    );
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});
