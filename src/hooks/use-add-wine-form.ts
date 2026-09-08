"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "@/components/ui/custom-toast";
import { DuplicateWineError } from "@/lib/errors";
import type { Wine, Cabinet, NewWineInput } from "@/types/wine";

// ─── Types ────────────────────────────────────────────────────

export type View =
  | "pick"
  | "label-capture"
  | "label-id"
  | "barcode-scan"
  | "barcode-id"
  | "form"
  | "unfiled"
  | "receipt-scan"
  /** Wine-list AI extraction in progress (post-capture, pre-results) */
  | "wine-list-processing"
  /** Wine-list extraction results — matched against user's cellar */
  | "wine-list-results";

export interface WineFormState {
  name: string;
  winery: string;
  vintage: string;
  type: string;
  grapeVariety: string;
  region: string;
  country: string;
  /** Market-value estimate (AI-fillable; maps to retailPrice) */
  price: string;
  /** What the user paid (manual only; maps to price) */
  purchasePrice: string;
  alcohol: string;
  cabinetId: string;
  notes: string;
  description: string;
  drinkBy: string;
  drinkWindow: string;
  disposition: string;
  foodPairings: string;
  /** User's personal 0–5 star rating (null = unrated) */
  userRating: number | null;
  tags: string[];
}

export interface UseAddWineFormOptions {
  cabinets: Cabinet[];
  onAdd: (wine: NewWineInput) => void | Promise<void>;
  pendingSlot?: { cabinetId: string; row: number; col: number } | null;
  controlledOpen?: boolean;
  controlledOnOpenChange?: (open: boolean) => void;
}

export function useAddWineForm({
  cabinets,
  onAdd,
  pendingSlot,
  controlledOpen,
  controlledOnOpenChange,
}: UseAddWineFormOptions) {
  // Dialog open state
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (v: boolean) => {
      if (isControlled) controlledOnOpenChange?.(v);
      else setInternalOpen(v);
    },
    [isControlled, controlledOnOpenChange]
  );

  const [view, setView] = useState<View>("pick");
  const [saving, setSaving] = useState(false);
  const [entryMethod, setEntryMethod] = useState<"label" | "barcode" | "manual">("manual");

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFilled, setAiFilled] = useState(false);
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());

  // Label scan state
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");

  // Barcode state
  const [barcodeValue, setBarcodeValue] = useState("");

  // Receipt scan state
  const [receiptPhase, setReceiptPhase] = useState<"capture" | "processing" | "review">("capture");
  const [receiptWines, setReceiptWines] = useState<Array<Record<string, unknown>>>([]);
  const [receiptSource, setReceiptSource] = useState<string | null>(null);
  const [receiptSelected, setReceiptSelected] = useState<Set<number>>(new Set());

  // Form fields
  const [name, setName] = useState("");
  const [winery, setWinery] = useState("");
  const [vintage, setVintage] = useState("");
  const [type, setType] = useState("red");
  const [sparkling, setSparkling] = useState(false);
  const [grapeVariety, setGrapeVariety] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  // `price` is the MARKET VALUE estimate (AI-fillable, maps to retailPrice).
  // `purchasePrice` is what the user actually paid (manual only, maps to price).
  const [price, setPrice] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [alcohol, setAlcohol] = useState("");
  // No section pre-selected: defaulting to cabinets[0] silently filed wines
  // into whatever section happened to sort first ("Wine Fridge") even when
  // the user was adding from a different rack. Unselected → saved as
  // Unfiled, which the UI surfaces explicitly for placement.
  const [cabinetId, setCabinetId] = useState("");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [drinkBy, setDrinkBy] = useState("");
  const [drinkWindow, setDrinkWindow] = useState("");
  const [disposition, setDisposition] = useState("");
  const [foodPairings, setFoodPairings] = useState("");
  const [userRating, setUserRating] = useState<number | null>(null);
  // How many identical bottles to add. Kept as a string so the field can be
  // cleared while typing (same pattern as the duplicate-count input).
  const [quantity, setQuantity] = useState("1");
  const [tags, setTags] = useState<string[]>([]);
  const [unfiledCabinetId, setUnfiledCabinetId] = useState(
    pendingSlot?.cabinetId ?? (cabinets.length > 0 ? cabinets[0].id : "")
  );

  // Sync pendingSlot cabinetId
  useEffect(() => {
    if (pendingSlot?.cabinetId) {
      setUnfiledCabinetId(pendingSlot.cabinetId);
    }
  }, [pendingSlot?.cabinetId]);

  // When the add flow was launched from a specific empty slot, reflect that
  // cabinet in the Section dropdown so what the user sees matches where the
  // wine will actually go. (No other auto-default — see cabinetId above.)
  useEffect(() => {
    if (pendingSlot?.cabinetId) {
      setCabinetId(pendingSlot.cabinetId);
    }
  }, [pendingSlot?.cabinetId]);

  const resetForm = useCallback(() => {
    setView("pick");
    setAiLoading(false);
    setAiError(null);
    setAiFilled(false);
    setAiFields(new Set());
    setEntryMethod("manual");
    setImageBase64(null);
    setBarcodeValue("");
    setName("");
    setWinery("");
    setVintage("");
    setType("red");
    setSparkling(false);
    setGrapeVariety("");
    setRegion("");
    setCountry("");
    setPrice("");
    setPurchasePrice("");
    setAlcohol("");
    setCabinetId(pendingSlot?.cabinetId ?? "");
    setNotes("");
    setDescription("");
    setDrinkBy("");
    setDrinkWindow("");
    setDisposition("");
    setFoodPairings("");
    setUserRating(null);
    setQuantity("1");
    setTags([]);
    setReceiptPhase("capture");
    setReceiptWines([]);
    setReceiptSource(null);
    setReceiptSelected(new Set());
    setUnfiledCabinetId(pendingSlot?.cabinetId ?? (cabinets.length > 0 ? cabinets[0].id : ""));
  }, [cabinets, pendingSlot?.cabinetId]);

  const submitWine = useCallback(async (skipDuplicateCheck: boolean) => {
    setSaving(true);
    try {
      // Quantity > 1 adds that many identical bottles. Only the first goes
      // through the duplicate check — the rest are intentional copies, so they
      // skip it (same rule the Duplicate action uses).
      const qty = Math.max(1, Math.min(99, parseInt(quantity, 10) || 1));
      for (let n = 0; n < qty; n++) {
      await onAdd({
        cabinetId: cabinetId || null,
        barcode: barcodeValue,
        name: name.trim(),
        winery: winery.trim(),
        region: region.trim(),
        country: country.trim(),
        vintage: vintage ? parseInt(vintage, 10) : null,
        type: type as Wine["type"],
        sparkling,
        grapeVariety: grapeVariety.trim(),
        userRating,
        imageUrl: imageBase64 ? `data:${imageMimeType};base64,${imageBase64}` : "",
        price: purchasePrice ? parseFloat(purchasePrice) : null,
        retailPrice: price ? parseFloat(price) : null,
        purchaseDate: new Date().toISOString().split("T")[0],
        drinkBy: drinkBy.trim(),
        notes: notes.trim(),
        description: description.trim(),
        foodPairings: foodPairings.trim(),
        alcohol: alcohol.trim(),
        row: null,
        col: null,
        depth: 0,
        zone: "",
        tags,
        tastingNotes: null,
        disposition: disposition.trim(),
        drinkWindow: drinkWindow.trim(),
        aiRatings: null,
        skipDuplicateCheck: skipDuplicateCheck || n > 0,
      });
      }
      resetForm();
      setOpen(false);
    } catch (err) {
      if (err instanceof DuplicateWineError) {
        // Expected outcome, not a failure: offer a one-tap "Add anyway".
        toast.warning(`You already have "${err.existingWineName}" in your cellar`, {
          description: "Same name, winery and vintage.",
          // Decision toast — give the user time to read and tap on mobile.
          duration: 12000,
          action: { label: "Add anyway", onClick: () => { void submitWineRef.current(true); } },
        });
        return;
      }
      console.error("[Add Wine Error]", err);
      toast.error(err instanceof Error ? err.message : "Failed to add wine. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [
    onAdd, cabinetId, barcodeValue, name, winery, region, country, vintage, type,
    sparkling, grapeVariety, imageBase64, imageMimeType, purchasePrice, price,
    drinkBy, notes, description, foodPairings, alcohol, tags, disposition,
    drinkWindow, userRating, quantity, resetForm, setOpen,
  ]);

  // Ref so the toast's "Add anyway" always calls the latest submit closure
  // (the toast outlives the render that created it).
  const submitWineRef = useRef(submitWine);
  submitWineRef.current = submitWine;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!type) {
      toast.error("Please select a wine type (red, white, etc.)");
      return;
    }
    // Scanning a label/barcode is an explicit "add this bottle" — a duplicate
    // is almost always intentional (another bottle of a wine you own), so skip
    // the duplicate prompt for scans. Manual entry still gets the gentle
    // "already in your cellar — add anyway?" warning to catch accidental retypes.
    await submitWine(entryMethod !== "manual");
  };

  const handleOpenChange = useCallback(
    (o: boolean) => {
      setOpen(o);
      if (!o) resetForm();
    },
    [setOpen, resetForm]
  );

  // Form field setters grouped for convenience
  const formFields = {
    name, setName,
    winery, setWinery,
    vintage, setVintage,
    type, setType,
    sparkling, setSparkling,
    grapeVariety, setGrapeVariety,
    region, setRegion,
    country, setCountry,
    price, setPrice,
    purchasePrice, setPurchasePrice,
    alcohol, setAlcohol,
    cabinetId, setCabinetId,
    notes, setNotes,
    description, setDescription,
    drinkBy, setDrinkBy,
    drinkWindow, setDrinkWindow,
    disposition, setDisposition,
    foodPairings, setFoodPairings,
    userRating, setUserRating,
    quantity, setQuantity,
    tags, setTags,
  };

  return {
    // Dialog
    open,
    setOpen,
    isControlled,
    handleOpenChange,

    // View
    view,
    setView,
    entryMethod,
    setEntryMethod,
    saving,
    setSaving,

    // AI state
    aiLoading,
    setAiLoading,
    aiError,
    setAiError,
    aiFilled,
    setAiFilled,
    aiFields,
    setAiFields,

    // Label
    imageBase64,
    setImageBase64,
    imageMimeType,
    setImageMimeType,

    // Barcode
    barcodeValue,
    setBarcodeValue,

    // Receipt
    receiptPhase,
    setReceiptPhase,
    receiptWines,
    setReceiptWines,
    receiptSource,
    setReceiptSource,
    receiptSelected,
    setReceiptSelected,

    // Unfiled
    unfiledCabinetId,
    setUnfiledCabinetId,

    // Form
    formFields,
    resetForm,
    handleSubmit,
  };
}
