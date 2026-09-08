"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Loader2, UtensilsCrossed, Wine as WineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Wine, Cabinet, NewWineInput } from "@/types/wine";
import { useTier } from "@/hooks/use-tier";
import { useAddWineForm } from "@/hooks/use-add-wine-form";
import { useAIWineFill } from "@/hooks/use-ai-wine-fill";
import { useWineData } from "@/contexts/wine-data-context";
import { useAddWine } from "@/components/add-wine-context";
import { aiExtractWineList } from "@/server/actions/ai";
import type { WineIdentification } from "@/lib/ai/types";
import {
  MethodPicker,
  LabelCaptureView,
  LabelIdentifyingView,
  BarcodeScanView,
  BarcodeLookupView,
  UnfiledPicker,
  ReceiptScanView,
  WineForm,
} from "@/components/wine/add-wine-form-sections";
import {
  WineListResults,
  WineListResultsFooter,
  type UserWineForScan,
} from "@/components/wine/wine-list-results";

// ─── Types ────────────────────────────────────────────────────

interface AddWineDialogProps {
  cabinets: Cabinet[];
  onAdd: (wine: NewWineInput) => void | Promise<void>;
  trigger?: React.ReactElement;
  allTags?: string[];
  /** Controlled open state */
  open?: boolean;
  /** Controlled open change handler */
  onOpenChange?: (open: boolean) => void;
  /** Wines that are not placed in any rack */
  unfiledWines?: Wine[];
  /** Called when user picks an unfiled wine to place into a cabinet slot */
  onPlaceWine?: (wineId: string, cabinetId: string, row?: number, col?: number) => void;
  /** Pre-selected slot from clicking a specific empty slot */
  pendingSlot?: { cabinetId: string; row: number; col: number } | null;
  /** Called when user wants to scan a wine list (opens external dialog) */
  onScanWineList?: () => void;
}

// ─── Component ────────────────────────────────────────────────

export function AddWineDialog({
  cabinets,
  onAdd,
  trigger,
  allTags = [],
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  unfiledWines = [],
  onPlaceWine,
  pendingSlot,
  // onScanWineList is accepted for API stability — wine-list scanning now
  // happens inline in this dialog's own camera session.
  onScanWineList: _onScanWineList,
}: AddWineDialogProps) {
  const { hasAI, tierHasAI, userId } = useTier();
  const { _readyStream } = useAddWine();

  const form = useAddWineForm({
    cabinets,
    onAdd,
    pendingSlot,
    controlledOpen,
    controlledOnOpenChange,
  });

  const ai = useAIWineFill({
    userId,
    formValues: {
      name: form.formFields.name,
      winery: form.formFields.winery,
      vintage: form.formFields.vintage,
      type: form.formFields.type,
      grapeVariety: form.formFields.grapeVariety,
      region: form.formFields.region,
      country: form.formFields.country,
      price: form.formFields.price,
      alcohol: form.formFields.alcohol,
      description: form.formFields.description,
      drinkBy: form.formFields.drinkBy,
      drinkWindow: form.formFields.drinkWindow,
      disposition: form.formFields.disposition,
    },
    formSetters: {
      setName: form.formFields.setName,
      setWinery: form.formFields.setWinery,
      setVintage: form.formFields.setVintage,
      setType: form.formFields.setType,
      setSparkling: form.formFields.setSparkling,
      setGrapeVariety: form.formFields.setGrapeVariety,
      setRegion: form.formFields.setRegion,
      setCountry: form.formFields.setCountry,
      setPrice: form.formFields.setPrice,
      setAlcohol: form.formFields.setAlcohol,
      setDescription: form.formFields.setDescription,
      setDrinkBy: form.formFields.setDrinkBy,
      setDrinkWindow: form.formFields.setDrinkWindow,
      setDisposition: form.formFields.setDisposition,
    },
    setAiLoading: form.setAiLoading,
    setAiError: form.setAiError,
    setAiFilled: form.setAiFilled,
    setAiFields: form.setAiFields,
    setView: form.setView,
    setSaving: form.setSaving,
    imageBase64: form.imageBase64,
    imageMimeType: form.imageMimeType,
    onAdd,
  });

  // Tracks which scan mode is active inside the full-screen camera.
  // Determines whether a captured photo is processed as a wine label,
  // a receipt, or a restaurant wine list. Wine-list & invoice both stay
  // in this same camera session — no close+reopen, no flicker.
  const [cameraMode, setCameraMode] = useState<"label" | "invoice" | "wine-list">("label");

  // Wine-list scan state — kept local because it's only meaningful
  // between capture and results, and lives entirely inside this dialog.
  const [wineListExtracted, setWineListExtracted] = useState<WineIdentification[]>([]);
  const [wineListSource, setWineListSource] = useState<string | null>(null);
  const [wineListAdded, setWineListAdded] = useState<Set<string>>(new Set());
  const [wineListError, setWineListError] = useState<string | null>(null);

  // The user's cellar — needed by the results view to fuzzy-match
  // extracted wines against bottles already in the collection.
  const { wines: cellarWines } = useWineData();
  const userWinesForScan: UserWineForScan[] = cellarWines.map((w) => ({
    id: w.id,
    name: w.name,
    winery: w.winery,
    vintage: w.vintage,
    type: w.type,
    region: w.region,
    grapeVariety: w.grapeVariety,
    disposition: w.disposition,
    drinkWindow: w.drinkWindow,
    userRating: w.userRating,
    aiRatings: w.aiRatings,
    cdScore: w.cdScore ?? null,
  }));

  // Reset cameraMode + wine-list state whenever the dialog closes —
  // covers Esc, outside-click, and any path that bypasses the explicit
  // Back/Close buttons.
  useEffect(() => {
    if (!form.open) {
      setCameraMode("label");
      setWineListExtracted([]);
      setWineListSource(null);
      setWineListAdded(new Set());
      setWineListError(null);
    }
  }, [form.open]);

  const handleWineListCapture = useCallback(
    async (base64: string, mimeType: string) => {
      setWineListError(null);
      form.setView("wine-list-processing");
      try {
        const result = await aiExtractWineList(base64, mimeType, userId ?? undefined);
        if (!result.success) {
          setWineListError(result.error || "Failed to extract wine list. Please try again.");
          // Drop back to camera so the user can retry without restarting
          // the dialog. cameraMode is still "wine-list" so the right tab
          // stays highlighted.
          form.setImageBase64(null);
          form.setView("label-capture");
          return;
        }
        if (!result.data.wines || result.data.wines.length === 0) {
          setWineListError("Couldn't identify any wines in that image. Try a clearer photo, or switch to the label scan tab.");
          form.setImageBase64(null);
          form.setView("label-capture");
          return;
        }
        setWineListExtracted(result.data.wines);
        setWineListSource(result.data.sourceName);
        form.setView("wine-list-results");
      } catch {
        setWineListError("Failed to process wine list. Please try again.");
        form.setImageBase64(null);
        form.setView("label-capture");
      }
    },
    [form, userId]
  );

  // Camera-first default: the moment the dialog opens, skip the
  // MethodPicker and jump straight into the label-capture camera. Users
  // reach barcode / wine-list / invoice / manual entry via the tabs and
  // "Enter manually" link rendered inside the camera view. Unfiled-wine
  // placement is surfaced by the cellar page's own unfiled-wines panel,
  // so the header Add-Wine flow stays focused on adding NEW wines.
  const { open: formOpen, view: formView, setEntryMethod, setView } = form;
  // Track whether we've already auto-jumped from "pick" → "label-capture" for
  // this dialog session. Without this guard, hitting Back from label-capture
  // (which routes to "pick") instantly bounces back to label-capture and the
  // MethodPicker is unreachable. Reset on close so the next open auto-jumps.
  const didAutoOpenRef = useRef(false);
  useEffect(() => {
    if (!formOpen) {
      didAutoOpenRef.current = false;
      return;
    }
    if (formView !== "pick" || didAutoOpenRef.current) return;
    didAutoOpenRef.current = true;
    setEntryMethod("label");
    setView("label-capture");
  }, [formOpen, formView, setEntryMethod, setView]);

  const goBack = () => {
    form.setAiError(null);
    // Clear any stale capture so re-entering label-capture starts the
    // camera fresh instead of falling into the "Review Label" branch.
    form.setImageBase64(null);
    form.setView("pick");
    setCameraMode("label");
  };
  const closeDialog = () => { form.resetForm(); form.setOpen(false); setCameraMode("label"); };

  const dialogContent = (
    <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
      {form.view === "pick" && (
        <MethodPicker
          hasAI={hasAI}
          tierHasAI={tierHasAI}
          onLabelScan={() => { form.setEntryMethod("label"); form.setView("label-capture"); }}
          onBarcodeScan={() => { form.setEntryMethod("barcode"); form.setView("barcode-scan"); }}
          onManual={() => { form.setEntryMethod("manual"); form.setView("form"); }}
          onUnfiled={() => form.setView("unfiled")}
          showUnfiled={!!onPlaceWine}
          unfiledCount={unfiledWines.length}
        />
      )}

      {form.view === "label-capture" && (
        <LabelCaptureView
          aiError={form.aiError ?? wineListError}
          imageBase64={form.imageBase64}
          cameraActiveMode={cameraMode}
          pendingStream={_readyStream}
          onCapture={(base64, mime) => {
            if (cameraMode === "invoice") {
              ai.handleReceiptCapture(
                base64, mime,
                form.setReceiptPhase, form.setReceiptWines,
                form.setReceiptSource, form.setReceiptSelected,
              );
              form.setView("receipt-scan");
            } else if (cameraMode === "wine-list") {
              // Same camera session — capture flows directly into AI
              // wine-list extraction, then the dialog body switches to
              // the results view. No second dialog, no flicker.
              handleWineListCapture(base64, mime);
            } else {
              // Auto-identify on capture — no "Review Label → Identify
              // with AI" intermediate confirm step. The AI almost always
              // identifies the wine correctly; the user can edit on the
              // results form if it's wrong. Stash the image too so any
              // downstream code (debug, retry) still has it.
              form.setImageBase64(base64);
              form.setImageMimeType(mime);
              ai.handleLabelIdentify(base64, mime);
            }
          }}
          onIdentify={ai.handleLabelIdentify}
          onBack={goBack}
          onRetake={() => { form.setImageBase64(null); }}
          onClose={closeDialog}
          onSwitchToLabel={() => { form.setAiError(null); setWineListError(null); setCameraMode("label"); }}
          onSwitchToReceipt={() => { form.setAiError(null); setWineListError(null); setCameraMode("invoice"); }}
          onSwitchToWineList={() => {
            // Inline wine-list mode — stay in the same camera session.
            // Capture handler above routes wine-list shots through
            // handleWineListCapture. No more close+reopen dance.
            form.setAiError(null);
            setWineListError(null);
            setCameraMode("wine-list");
          }}
          onSwitchToBarcode={() => {
            form.setAiError(null);
            form.setEntryMethod("barcode");
            form.setView("barcode-scan");
          }}
          onManualEntry={() => {
            form.setAiError(null);
            form.setEntryMethod("manual");
            form.setView("form");
          }}
        />
      )}

      {form.view === "wine-list-processing" && (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WineIcon className="h-5 w-5 text-primary animate-pulse" />
              Analyzing Wine List...
            </DialogTitle>
            <DialogDescription>
              Our AI sommelier is reading the wine list and matching it against your cellar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="relative">
              <WineIcon className="h-16 w-16 text-primary animate-pulse" />
              <Loader2 className="h-7 w-7 text-amber-500 animate-spin absolute -bottom-1 -right-1" />
            </div>
            <div className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
              <span className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: "0.2s" }} />
              <span className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: "0.4s" }} />
            </div>
          </div>
        </>
      )}

      {form.view === "wine-list-results" && (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-primary" />
              Wine List Results
            </DialogTitle>
            <DialogDescription>
              Found {wineListExtracted.length} wine{wineListExtracted.length !== 1 ? "s" : ""} on the list.
            </DialogDescription>
          </DialogHeader>
          <WineListResults
            extractedWines={wineListExtracted}
            sourceName={wineListSource}
            userWines={userWinesForScan}
            addedWines={wineListAdded}
            footer={
              <WineListResultsFooter
                onScanAnother={() => {
                  setWineListExtracted([]);
                  setWineListSource(null);
                  setWineListAdded(new Set());
                  setWineListError(null);
                  setCameraMode("wine-list");
                  form.setView("label-capture");
                }}
                onDone={closeDialog}
              />
            }
          />
        </>
      )}

      {form.view === "label-id" && <LabelIdentifyingView />}

      {form.view === "barcode-scan" && (
        <BarcodeScanView
          aiError={form.aiError}
          open={form.open && form.view === "barcode-scan"}
          onDetected={(barcode) => { form.setBarcodeValue(barcode); ai.handleBarcodeLookup(barcode); }}
          onBack={goBack}
        />
      )}

      {form.view === "barcode-id" && <BarcodeLookupView barcodeValue={form.barcodeValue} />}

      {form.view === "unfiled" && (
        <UnfiledPicker
          cabinets={cabinets}
          unfiledWines={unfiledWines}
          unfiledCabinetId={form.unfiledCabinetId}
          setUnfiledCabinetId={form.setUnfiledCabinetId}
          pendingSlot={pendingSlot}
          onPlaceWine={onPlaceWine}
          onBack={goBack}
          onClose={closeDialog}
        />
      )}

      {form.view === "receipt-scan" && (
        <ReceiptScanView
          receiptPhase={form.receiptPhase}
          receiptWines={form.receiptWines}
          receiptSource={form.receiptSource}
          receiptSelected={form.receiptSelected}
          setReceiptSelected={form.setReceiptSelected}
          aiError={form.aiError}
          saving={form.saving}
          onCapture={(base64, mimeType) => {
            ai.handleReceiptCapture(
              base64, mimeType,
              form.setReceiptPhase, form.setReceiptWines,
              form.setReceiptSource, form.setReceiptSelected,
            );
          }}
          onEditReceiptWine={(index, patch) => {
            form.setReceiptWines(
              form.receiptWines.map((w, i) => (i === index ? { ...w, ...patch } : w))
            );
          }}
          onSubmit={() => {
            ai.handleReceiptSubmit(form.receiptWines, form.receiptSelected, form.resetForm, form.setOpen);
          }}
          onBack={goBack}
          onClose={closeDialog}
        />
      )}

      {form.view === "form" && (
        <WineForm
          entryMethod={form.entryMethod}
          imageBase64={form.imageBase64}
          aiFilled={form.aiFilled}
          aiFields={form.aiFields}
          aiError={form.aiError}
          aiLoading={form.aiLoading}
          hasAI={hasAI}
          tierHasAI={tierHasAI}
          saving={form.saving}
          cabinets={cabinets}
          allTags={allTags}
          formFields={form.formFields}
          onSubmit={form.handleSubmit}
          onAIAutoFill={ai.handleAIAutoFill}
          onScanAgain={() => {
            // Clear the previous capture so LabelCaptureView reopens the
            // camera instead of showing the "Review Label" confirm screen.
            form.setImageBase64(null);
            form.setView(form.entryMethod === "label" ? "label-capture" : "barcode-scan");
            form.setAiError(null);
          }}
          onBack={goBack}
          onClose={closeDialog}
          setAiFilled={form.setAiFilled}
        />
      )}
    </DialogContent>
  );

  if (form.isControlled) {
    return (
      <Dialog open={form.open} onOpenChange={form.handleOpenChange}>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={form.open} onOpenChange={form.handleOpenChange}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Wine
            </Button>
          )
        }
      />
      {dialogContent}
    </Dialog>
  );
}
