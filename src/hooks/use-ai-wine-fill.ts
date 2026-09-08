"use client";

import { useCallback } from "react";
import { toast } from "@/components/ui/custom-toast";
import { aiSearchWine, aiScanLabel, aiBarcodeLookup } from "@/server/actions/ai";
import type { View } from "@/hooks/use-add-wine-form";
import type { Wine, NewWineInput } from "@/types/wine";

// ─── Types ────────────────────────────────────────────────────

interface FormFieldValues {
  name: string;
  winery: string;
  vintage: string;
  type: string;
  grapeVariety: string;
  region: string;
  country: string;
  price: string;
  alcohol: string;
  description: string;
  drinkBy: string;
  drinkWindow: string;
  disposition: string;
}

interface FormFieldSetters {
  setName: (v: string) => void;
  setWinery: (v: string) => void;
  setVintage: (v: string) => void;
  setType: (v: string) => void;
  /** Sparkling is a quality (orthogonal to color), set true when the AI
   * returns type="sparkling" OR the name matches a sparkling indicator
   * (Champagne, Cremant, Prosecco, Cava, Brut, etc.). */
  setSparkling: (v: boolean) => void;
  setGrapeVariety: (v: string) => void;
  setRegion: (v: string) => void;
  setCountry: (v: string) => void;
  setPrice: (v: string) => void;
  setAlcohol: (v: string) => void;
  setDescription: (v: string) => void;
  setDrinkBy: (v: string) => void;
  setDrinkWindow: (v: string) => void;
  setDisposition: (v: string) => void;
}

interface UseAIWineFillOptions {
  userId: string | null | undefined;
  formValues: FormFieldValues;
  formSetters: FormFieldSetters;
  setAiLoading: (v: boolean) => void;
  setAiError: (v: string | null) => void;
  setAiFilled: (v: boolean) => void;
  setAiFields: (v: Set<string>) => void;
  setView: (v: View) => void;
  setSaving: (v: boolean) => void;
  imageBase64: string | null;
  imageMimeType: string;
  onAdd: (wine: NewWineInput) => void | Promise<void>;
}

// ─── Fill from AI result (only fills empty fields) ──────

function fillFromAIResult(
  wine: Record<string, unknown>,
  formValues: FormFieldValues,
  formSetters: FormFieldSetters,
  setAiFields: (v: Set<string>) => void,
  setAiFilled: (v: boolean) => void,
) {
  const filled = new Set<string>();
  if (wine.name && !formValues.name) { formSetters.setName(String(wine.name)); filled.add("name"); }
  if (wine.winery && !formValues.winery) { formSetters.setWinery(String(wine.winery)); filled.add("winery"); }
  if (wine.vintage != null && !formValues.vintage) { formSetters.setVintage(String(wine.vintage)); filled.add("vintage"); }
  // ALWAYS overwrite type + sparkling from the AI classification. The
  // form defaults to type="red" sparkling=false, so the previous
  // `!formValues.type` guard meant AI's white/rosé identification was
  // thrown away every time. Sparkling is a separate quality (independent
  // of color) — when AI returns type="sparkling" we set sparkling=true
  // AND derive the actual color from the grape/name.
  const grape = String(wine.grapeVariety || formValues.grapeVariety || "").toLowerCase();
  const name = String(wine.name || formValues.name || "").toLowerCase();
  const WHITE_GRAPES = ["chardonnay","riesling","sauvignon blanc","pinot grigio","pinot gris","garganega","godello","albariño","viognier","chenin blanc","gewürztraminer","grüner veltliner","marsanne","roussanne","verdejo","vermentino","torrontés","melon de bourgogne","muscadet","sémillon","fiano","arneis","cortese","trebbiano","friulano","müller-thurgau","pinot blanc","auxerrois"];
  const SPARKLING_NAMES = ["crémant","cremant","champagne","prosecco","cava","brut","sparkling","spumante","sekt","franciacorta","blanquette","metodo classico"];
  // Detect sparkling from name even when AI didn't tag the type — e.g.
  // "Les Comtes de Ribeauvillé Crémant d'Alsace" should be sparkling.
  const looksSparkling = SPARKLING_NAMES.some((s) => name.includes(s));

  if (wine.type) {
    let wineType = String(wine.type).toLowerCase();
    // AI returned "sparkling" as the TYPE — sparkling is actually a
    // quality, not a color. Set the checkbox + derive the actual color
    // from grape/name. Default to white since most sparkling is white-grape.
    if (wineType === "sparkling") {
      formSetters.setSparkling(true);
      filled.add("sparkling");
      if (name.includes("rosé") || /\brose\b/.test(name) || (grape.includes("pinot noir") && !grape.includes("blanc"))) {
        wineType = "rosé";
      } else {
        wineType = "white";
      }
    } else {
      // Color sanity-checks for non-sparkling type
      if (wineType === "red" && WHITE_GRAPES.some((g) => grape.includes(g))) wineType = "white";
      if (name.includes("rosé") || /\brose\b/.test(name)) wineType = "rosé";
      // If AI didn't tag sparkling but the name screams it, set both.
      if (looksSparkling) {
        formSetters.setSparkling(true);
        filled.add("sparkling");
      }
    }
    formSetters.setType(wineType); filled.add("type");
  } else if (wine.grapeVariety) {
    // AI didn't return type but we have a grape — derive from the grape.
    if (WHITE_GRAPES.some((g) => grape.includes(g))) {
      formSetters.setType("white"); filled.add("type");
    }
    if (looksSparkling) {
      formSetters.setSparkling(true);
      filled.add("sparkling");
    }
  } else if (looksSparkling) {
    // Last resort — only the name to go on, but it's clearly sparkling.
    formSetters.setSparkling(true);
    filled.add("sparkling");
  }

  // Honor an explicit sparkling boolean from the AI when present.
  if (typeof wine.sparkling === "boolean" && wine.sparkling) {
    formSetters.setSparkling(true);
    filled.add("sparkling");
  }
  if (wine.grapeVariety && !formValues.grapeVariety) { formSetters.setGrapeVariety(String(wine.grapeVariety)); filled.add("grapeVariety"); }
  if (wine.region && !formValues.region) { formSetters.setRegion(String(wine.region)); filled.add("region"); }
  if (wine.country && !formValues.country) { formSetters.setCountry(String(wine.country)); filled.add("country"); }
  if (wine.estimatedPrice != null && !formValues.price) { formSetters.setPrice(String(wine.estimatedPrice)); filled.add("price"); }
  if (wine.alcohol && !formValues.alcohol) { formSetters.setAlcohol(String(wine.alcohol)); filled.add("alcohol"); }
  if (wine.description && !formValues.description) { formSetters.setDescription(String(wine.description)); filled.add("description"); }
  if (wine.drinkBy && !formValues.drinkBy) { formSetters.setDrinkBy(String(wine.drinkBy)); filled.add("drinkBy"); }
  if (wine.drinkWindow && !formValues.drinkWindow) { formSetters.setDrinkWindow(String(wine.drinkWindow)); filled.add("drinkWindow"); }
  if (wine.disposition && !formValues.disposition) { formSetters.setDisposition(String(wine.disposition)); filled.add("disposition"); }
  // Never fill purchase date or personal notes from AI
  setAiFields(filled);
  setAiFilled(true);
}

// ─── Hook ────────────────────────────────────────────────────

export function useAIWineFill({
  userId,
  formValues,
  formSetters,
  setAiLoading,
  setAiError,
  setAiFilled,
  setAiFields,
  setView,
  setSaving,
  imageBase64,
  imageMimeType,
  onAdd,
}: UseAIWineFillOptions) {
  const fillFromAI = useCallback(
    (wine: Record<string, unknown>) => {
      fillFromAIResult(wine, formValues, formSetters, setAiFields, setAiFilled);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formValues.name, formValues.winery, formValues.vintage, formValues.type, formValues.grapeVariety,
     formValues.region, formValues.country, formValues.price, formValues.alcohol, formValues.description,
     formValues.drinkBy, formValues.drinkWindow, formValues.disposition]
  );

  // Optional overrideBase64/overrideMime let callers pass freshly-captured
  // image bytes WITHOUT waiting for the imageBase64 state to round-trip
  // through React. Used by the camera-first flow which auto-identifies
  // immediately after shutter — no "Review Label → Identify with AI"
  // confirm step.
  const handleLabelIdentify = useCallback(async (overrideBase64?: string, overrideMime?: string) => {
    const b64 = overrideBase64 ?? imageBase64;
    const mime = overrideMime ?? imageMimeType;
    if (!b64) return;
    setView("label-id");
    setAiError(null);
    try {
      const result = await aiScanLabel(b64, mime, userId ?? undefined);
      if (!result.success) {
        const msg = result.error === "not_a_wine_label"
          ? "This doesn't appear to be a wine label. Please try another image."
          : result.error;
        setAiError(msg);
        toast.error(msg || "Label scan failed");
        setView("label-capture");
        return;
      }
      fillFromAI(result.data as unknown as Record<string, unknown>);
      toast.success("Wine identified from label");
      setView("form");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Label Scan Error]", msg);
      setAiError(`Failed to identify wine: ${msg.includes("body") || msg.includes("size") ? "Image too large — try a lower resolution." : "Please try again."}`);
      toast.error("Failed to identify wine");
      setView("label-capture");
    }
  }, [imageBase64, imageMimeType, fillFromAI, userId, setView, setAiError]);

  const handleBarcodeLookup = useCallback(
    async (barcode: string) => {
      setView("barcode-id");
      setAiError(null);
      try {
        // Use the dedicated barcode-lookup endpoint, NOT aiSearchWine.
        // The latter treats the input as a fuzzy text query — passing
        // "UPC barcode 1234" as a search string returned the most popular
        // wine match (Meiomi Pinot Noir) for every barcode the user
        // scanned. aiBarcodeLookup hits the barcode cache + Open Food
        // Facts + a barcode-specific AI prompt instead.
        const result = await aiBarcodeLookup(barcode, userId ?? undefined);
        if (!result.success) {
          setAiError(result.error);
          toast.error(result.error || "Barcode lookup failed");
          setView("barcode-scan");
          return;
        }
        fillFromAI(result.data as unknown as Record<string, unknown>);
        toast.success("Wine identified from barcode");
        setView("form");
      } catch (err) {
        console.error("[Barcode Lookup Error]", err instanceof Error ? err.message : err);
        setAiError("Failed to look up barcode. Please try again.");
        toast.error("Failed to look up barcode");
        setView("barcode-scan");
      }
    },
    [fillFromAI, userId, setView, setAiError]
  );

  const handleAIAutoFill = useCallback(async () => {
    if (!formValues.name.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      let query = formValues.name.trim();
      if (formValues.winery.trim()) query += ` ${formValues.winery.trim()}`;
      if (formValues.vintage.trim()) query += ` ${formValues.vintage.trim()}`;
      const result = await aiSearchWine(query, userId ?? undefined);
      if (!result.success) { setAiError(result.error); toast.error(result.error || "AI Search failed"); return; }
      fillFromAI(result.data as unknown as Record<string, unknown>);
      toast.success("Wine details filled with AI");
    } catch (err) {
      console.error("[AI Search Error]", err instanceof Error ? err.message : err);
      setAiError("AI Search failed. You can still add the wine manually.");
      toast.error("AI Search failed");
    } finally {
      setAiLoading(false);
    }
  }, [formValues.name, formValues.winery, formValues.vintage, fillFromAI, userId, setAiLoading, setAiError]);

  const handleReceiptCapture = useCallback(async (base64: string, mimeType: string, setReceiptPhase: (v: "capture" | "processing" | "review") => void, setReceiptWines: (v: Array<Record<string, unknown>>) => void, setReceiptSource: (v: string | null) => void, setReceiptSelected: (v: Set<number>) => void) => {
    setReceiptPhase("processing");
    setAiError(null);
    try {
      const { aiExtractWineList } = await import("@/server/actions/ai");
      const result = await aiExtractWineList(base64, mimeType, userId ?? undefined);
      if (!result.success) {
        const msg = result.error || "Could not analyze the image. Please try again.";
        setAiError(msg);
        toast.error(msg);
        setReceiptPhase("capture");
        return;
      }
      if (!result.data?.wines?.length) {
        const msg = "No wines found in the image. Try a clearer photo.";
        setAiError(msg);
        toast.error(msg);
        setReceiptPhase("capture");
        return;
      }
      setReceiptWines(result.data.wines as unknown as Array<Record<string, unknown>>);
      setReceiptSource(result.data.sourceName || null);
      setReceiptSelected(new Set(result.data.wines.map((_: unknown, i: number) => i)));
      setReceiptPhase("review");
    } catch {
      const msg = "Failed to process image. Please try again.";
      setAiError(msg);
      toast.error(msg);
      setReceiptPhase("capture");
    }
  }, [userId, setAiError]);

  const handleReceiptSubmit = useCallback(async (
    receiptWines: Array<Record<string, unknown>>,
    receiptSelected: Set<number>,
    resetForm: () => void,
    setOpen: (v: boolean) => void,
  ) => {
    setSaving(true);
    try {
      for (const idx of receiptSelected) {
        const w = receiptWines[idx] as Record<string, unknown>;
        // Invoices carry a quantity column ("2 x Barolo") — add that many
        // bottles rather than a single one.
        const qty = Math.max(1, Math.round(Number(w.quantity) || 1));
        for (let n = 0; n < qty; n++) {
        await onAdd({
          cabinetId: null,
          barcode: "",
          name: (w.name as string) || "",
          winery: (w.winery as string) || "",
          region: (w.region as string) || "",
          country: (w.country as string) || "",
          vintage: w.vintage as number | null,
          type: ((w.type as string) || "red") as Wine["type"],
          sparkling: w.sparkling === true,
          grapeVariety: (w.grapeVariety as string) || "",
          userRating: null,
          imageUrl: "",
          // The price printed on an invoice/receipt IS what the user paid.
          price: (w.estimatedPrice as number | null) ?? null,
          retailPrice: null,
          purchaseDate: new Date().toISOString().split("T")[0],
          drinkBy: (w.drinkBy as string) || "",
          notes: "",
          description: (w.description as string) || "",
          foodPairings: "",
          alcohol: (w.alcohol as string) || "",
          row: null,
          col: null,
          depth: 0,
          zone: "",
          tags: [],
          tastingNotes: null,
          disposition: (w.disposition as string) || "",
          drinkWindow: (w.drinkWindow as string) || "",
          aiRatings: null,
          // Invoices regularly list multiple bottles of the same wine and
          // wines the user already owns — both are intentional adds here.
          skipDuplicateCheck: true,
        });
        }
      }
      toast.success(`Added ${receiptSelected.size} wines`);
      resetForm();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add wines");
    } finally {
      setSaving(false);
    }
  }, [onAdd, setSaving]);

  return {
    handleLabelIdentify,
    handleBarcodeLookup,
    handleAIAutoFill,
    handleReceiptCapture,
    handleReceiptSubmit,
  };
}
