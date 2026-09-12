import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConsumeWineDialog } from "@/components/wine/consume-wine-dialog";
import type { Wine } from "@/types/wine";

/**
 * Regression: the reset lived in the dialog's own onOpenChange, which never
 * fires when a page drives `open` itself — so after cancelling one wine's
 * removal the next wine's dialog came up with the previous wine's reason,
 * rating and notes, and Confirm wrote them onto the wrong history record.
 */

const WINE_A = { id: "w-1", name: "Alpha", type: "red" } as Wine;
const WINE_B = { id: "w-2", name: "Beta", type: "white" } as Wine;

/** Mirrors how the cellar and inventory pages mount the dialog: the page owns
 *  `open`, and the wine can change while the dialog is mounted. */
function Host({ wine }: { wine: Wine }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Remove bottle
      </button>
      <ConsumeWineDialog
        wine={wine}
        open={open}
        onOpenChange={setOpen}
        onConsume={async () => {}}
      />
    </>
  );
}

describe("ConsumeWineDialog", () => {
  it("starts empty for the next wine after a cancelled removal", () => {
    const { rerender } = render(<Host wine={WINE_A} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove bottle" }));
    fireEvent.click(screen.getByRole("button", { name: "Drank" }));
    fireEvent.change(screen.getByLabelText(/Notes/), {
      target: { value: "Corked" },
    });
    expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    rerender(<Host wine={WINE_B} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove bottle" }));

    expect(screen.getByLabelText(/Notes/)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  it("starts empty when the same wine is removed again", () => {
    render(<Host wine={WINE_A} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove bottle" }));
    fireEvent.click(screen.getByRole("button", { name: "Gifted" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Remove bottle" }));
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });
});
