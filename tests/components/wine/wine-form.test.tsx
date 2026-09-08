import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Cabinet } from "@/types/wine";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/** WineForm uses DialogHeader/DialogTitle which require a Dialog root
 *  context — wrap every render in an open Dialog so base-ui has the
 *  context it needs. */
function renderInDialog(node: React.ReactElement) {
  return render(
    <Dialog open onOpenChange={() => {}}>
      <DialogContent>{node}</DialogContent>
    </Dialog>
  );
}

// Stubs for in-form children we don't care about here.
vi.mock("@/components/wine/wine-name-autocomplete", () => ({
  WineNameAutocomplete: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value: string;
    onChange: (v: string) => void;
    onPickSuggestion?: (s: unknown) => void;
    autoFocus?: boolean;
  }) => (
    <input
      data-testid="autocomplete-name"
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/wine/tag-selector", () => ({
  TagSelector: () => <div data-testid="tag-selector-stub" />,
}));

vi.mock("@/components/wine/ai-search-dialog", () => ({
  AISearchDialog: () => null,
}));

import { WineForm } from "@/components/wine/add-wine-form-sections";

interface FieldsState {
  name: string;
  winery: string;
  vintage: string;
  type: string;
  sparkling: boolean;
  grapeVariety: string;
  region: string;
  country: string;
  price: string;
  alcohol: string;
  cabinetId: string;
  notes: string;
  description: string;
  drinkBy: string;
  drinkWindow: string;
  disposition: string;
  foodPairings: string;
  userRating: number | null;
  quantity: string;
  tags: string[];
  purchasePrice: string;
}

/** Build a formFields object whose setters mutate a shared object — gives
 *  the tests a way to read out the current value after a fireEvent without
 *  also re-rendering with new props. */
function makeFormFields(initial: Partial<FieldsState> = {}) {
  const state: FieldsState = {
    name: "",
    winery: "",
    vintage: "",
    type: "red",
    sparkling: false,
    grapeVariety: "",
    region: "",
    country: "",
    price: "",
    alcohol: "",
    cabinetId: "",
    notes: "",
    description: "",
    drinkBy: "",
    drinkWindow: "",
    disposition: "",
    foodPairings: "",
    userRating: null,
    quantity: "1",
    tags: [],
    purchasePrice: "",
    ...initial,
  };
  const make = <K extends keyof FieldsState>(k: K) => (v: FieldsState[K]) => {
    state[k] = v;
  };
  return {
    state,
    fields: {
      name: state.name,
      setName: make("name"),
      winery: state.winery,
      setWinery: make("winery"),
      vintage: state.vintage,
      setVintage: make("vintage"),
      type: state.type,
      setType: make("type"),
      sparkling: state.sparkling,
      setSparkling: make("sparkling"),
      grapeVariety: state.grapeVariety,
      setGrapeVariety: make("grapeVariety"),
      region: state.region,
      setRegion: make("region"),
      country: state.country,
      setCountry: make("country"),
      price: state.price,
      setPrice: make("price"),
      purchasePrice: state.purchasePrice,
      setPurchasePrice: make("purchasePrice"),
      alcohol: state.alcohol,
      setAlcohol: make("alcohol"),
      cabinetId: state.cabinetId,
      setCabinetId: make("cabinetId"),
      notes: state.notes,
      setNotes: make("notes"),
      description: state.description,
      setDescription: make("description"),
      drinkBy: state.drinkBy,
      setDrinkBy: make("drinkBy"),
      drinkWindow: state.drinkWindow,
      setDrinkWindow: make("drinkWindow"),
      disposition: state.disposition,
      setDisposition: make("disposition"),
      foodPairings: state.foodPairings,
      setFoodPairings: make("foodPairings"),
      userRating: state.userRating,
      setUserRating: make("userRating"),
      quantity: state.quantity,
      setQuantity: make("quantity"),
      tags: state.tags,
      setTags: make("tags"),
    },
  };
}

const cabinets: Cabinet[] = [];

function renderForm(opts: {
  fields?: Partial<FieldsState>;
  onSubmit?: (e: React.FormEvent) => void;
}) {
  const { fields, onSubmit = vi.fn((e) => e.preventDefault()) } = opts;
  const { fields: formFields, state } = makeFormFields(fields);
  renderInDialog(
    <WineForm
      entryMethod="manual"
      aiFilled={false}
      aiFields={new Set()}
      aiError={null}
      aiLoading={false}
      hasAI={false}
      tierHasAI={false}
      saving={false}
      cabinets={cabinets}
      allTags={[]}
      formFields={formFields}
      onSubmit={onSubmit}
      onScanAgain={vi.fn()}
      onBack={vi.fn()}
      onClose={vi.fn()}
      setAiFilled={vi.fn()}
    />
  );
  return { state, onSubmit };
}

describe("WineForm — manual entry mode", () => {
  it("renders the required Wine Name field with a required marker", () => {
    renderForm({});
    expect(screen.getByLabelText(/wine name/i)).toBeInTheDocument();
    // The asterisk indicating required
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("renders winery, vintage, region, country inputs", () => {
    renderForm({});
    expect(screen.getByLabelText(/winery/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/vintage/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/region/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
  });

  it("Save button is disabled when the name is empty", () => {
    renderForm({ fields: { name: "" } });
    const save = screen.getByRole("button", { name: /add wine/i });
    expect(save).toBeDisabled();
  });

  it("Save button enables once the name has content", () => {
    renderForm({ fields: { name: "Opus One" } });
    const save = screen.getByRole("button", { name: /add wine/i });
    expect(save).not.toBeDisabled();
  });

  it("submitting (with a valid name) calls onSubmit", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    renderForm({ fields: { name: "Opus One" }, onSubmit });
    fireEvent.click(screen.getByRole("button", { name: /add wine/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it("vintage input accepts numeric and writes through setVintage", () => {
    const { state } = renderForm({ fields: { name: "X" } });
    const vintage = screen.getByLabelText(/vintage/i);
    fireEvent.change(vintage, { target: { value: "2018" } });
    expect(state.vintage).toBe("2018");
  });

  it("vintage input enforces type=number with min/max", () => {
    renderForm({});
    const vintage = screen.getByLabelText(/vintage/i) as HTMLInputElement;
    expect(vintage.type).toBe("number");
    expect(vintage.min).toBe("1900");
    expect(vintage.max).toBe("2099");
  });

  it("typing in the wine-name field flows through the autocomplete stub", () => {
    const { state } = renderForm({ fields: { name: "" } });
    fireEvent.change(screen.getByTestId("autocomplete-name"), {
      target: { value: "Caymus" },
    });
    expect(state.name).toBe("Caymus");
  });

  it("renders an AI error banner when aiError is set", () => {
    const { fields } = makeFormFields({ name: "X" });
    renderInDialog(
      <WineForm
        entryMethod="manual"
        aiFilled={false}
        aiFields={new Set()}
        aiError="AI is down"
        aiLoading={false}
        hasAI={false}
        tierHasAI={false}
        saving={false}
        cabinets={cabinets}
        allTags={[]}
        formFields={fields}
        onSubmit={vi.fn()}
        onScanAgain={vi.fn()}
        onBack={vi.fn()}
        onClose={vi.fn()}
        setAiFilled={vi.fn()}
      />
    );
    expect(screen.getByText(/ai is down/i)).toBeInTheDocument();
  });
});
