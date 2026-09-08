import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Wine, Cabinet } from "@/types/wine";

// WineNameAutocomplete reaches into a server action / network — replace
// it with a plain controlled <input> so we can read/write the name field
// without firing real autocomplete requests.
vi.mock("@/components/wine/wine-name-autocomplete", () => ({
  WineNameAutocomplete: ({
    id,
    value,
    onChange,
    autoFocus,
  }: {
    id?: string;
    value: string;
    onChange: (v: string) => void;
    autoFocus?: boolean;
    onPickSuggestion?: (s: unknown) => void;
  }) => (
    <input
      data-testid="autocomplete-name"
      id={id}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// TagSelector is non-trivial — stub to a div so it doesn't pull anything
// extra into the test render.
vi.mock("@/components/wine/tag-selector", () => ({
  TagSelector: () => <div data-testid="tag-selector-stub" />,
}));

import { EditWineDialog } from "@/components/wine/edit-wine-dialog";

const wine: Wine = {
  id: "w-edit",
  userId: "u1",
  cabinetId: "cab-1",
  barcode: "",
  name: "Existing Wine",
  winery: "Existing Winery",
  region: "Bordeaux",
  country: "France",
  vintage: 2015,
  type: "red",
  sparkling: false,
  grapeVariety: "Merlot",
  userRating: 4,
  imageUrl: "",
  price: 42,
  retailPrice: null,
  purchaseDate: "",
  drinkBy: "",
  notes: "Tastes great",
  description: "A classic.",
  foodPairings: "Steak",
  alcohol: "13.5%",
  row: null,
  col: null,
  depth: 0,
  zone: "",
  tastingNotes: null,
  disposition: "H",
  drinkWindow: "2020-2030",
  aiRatings: null,
  tags: ["fav"],
  addedAt: "",
  updatedAt: "",
};

const cabinets: Cabinet[] = [
  {
    id: "cab-1",
    userId: "u1",
    wallId: "wall-1",
    name: "Cab One",
    rows: [],
    storageType: "slots",
    width: 1,
    height: 1,
    depth: 1,
  } as unknown as Cabinet,
];

describe("EditWineDialog", () => {
  it("pre-populates form fields from the wine prop when opened", () => {
    render(
      <EditWineDialog
        wine={wine}
        cabinets={cabinets}
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByTestId("autocomplete-name")).toHaveValue("Existing Wine");
    expect(screen.getByLabelText(/winery/i)).toHaveValue("Existing Winery");
    expect(screen.getByLabelText(/vintage/i)).toHaveValue(2015);
    expect(screen.getByLabelText(/grape variety/i)).toHaveValue("Merlot");
    expect(screen.getByLabelText(/region/i)).toHaveValue("Bordeaux");
    expect(screen.getByLabelText(/country/i)).toHaveValue("France");
    expect(screen.getByLabelText(/drink window/i)).toHaveValue("2020-2030");
  });

  it("submitting calls onSave with the wine id and trimmed payload", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <EditWineDialog
        wine={wine}
        cabinets={cabinets}
        open={true}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      "w-edit",
      expect.objectContaining({
        name: "Existing Wine",
        winery: "Existing Winery",
        vintage: 2015,
        type: "red",
        disposition: "H",
        drinkWindow: "2020-2030",
      })
    );
    // Closes after a successful save
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("Cancel does not call onSave but closes the dialog", () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <EditWineDialog
        wine={wine}
        cabinets={cabinets}
        open={true}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("blocks submit when the name is cleared (Save Changes is disabled)", () => {
    render(
      <EditWineDialog
        wine={wine}
        cabinets={cabinets}
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />
    );
    const nameInput = screen.getByTestId("autocomplete-name");
    fireEvent.change(nameInput, { target: { value: "" } });
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });
});
