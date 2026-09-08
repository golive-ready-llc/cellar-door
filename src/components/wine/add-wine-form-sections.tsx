"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Wine as WineIcon,
  Plus,
  Sparkles,
  Loader2,
  AlertCircle,
  Camera,
  ScanBarcode,
  PenLine,
  ArrowLeft,
  Receipt,
  Lock,
  PackageOpen,
  RotateCcw,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { WINE_TYPES_FOR_PICKER, WINE_TYPE_LABELS, WINE_TYPE_COLORS } from "@/types/constants";
import type { Wine, Cabinet } from "@/types/wine";
import { TagSelector } from "@/components/wine/tag-selector";
import { ImageCapture } from "./image-capture";
import { BarcodeScanner } from "./barcode-scanner";
import { WineNameAutocomplete } from "./wine-name-autocomplete";
import { AISearchDialog } from "./ai-search-dialog";
import { CdScoreBadge } from "@/components/community/community-score";
import { fetchCommunityScore } from "@/lib/data";

// Scan-result community rating — Vivino's signature "scan → see the rating".
// Looks the identified wine up in the community DB and shows its CD Score when
// real ratings exist. Renders nothing for unrated/unknown wines.
function ScanResultScore({ name, winery, vintage }: { name: string; winery: string; vintage: string }) {
  const [score, setScore] = useState<{ cdScore: number | null; cdRatingCount: number } | null>(null);
  useEffect(() => {
    let active = true;
    const n = name.trim();
    const w = winery.trim();
    if (!n || !w) {
      setScore(null);
      return;
    }
    const v = vintage ? parseInt(vintage, 10) : null;
    fetchCommunityScore(n, w, Number.isNaN(v as number) ? null : v)
      .then((r) => {
        if (active) setScore(r ? { cdScore: r.cdScore, cdRatingCount: r.cdRatingCount } : null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [name, winery, vintage]);

  if (!score || score.cdScore == null || score.cdRatingCount <= 0) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">Community rating</span>
      <CdScoreBadge score={score.cdScore} ratingCount={score.cdRatingCount} />
    </div>
  );
}

// ─── Shared small components ────────────────────────────────

export function AiIndicator({ field, aiFields }: { field: string; aiFields: Set<string> }) {
  return aiFields.has(field) ? (
    <Sparkles className="inline h-3 w-3 text-amber-500 ml-1" />
  ) : null;
}

export function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1 text-muted-foreground h-7 px-2 -ml-2"
      onClick={onBack}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back
    </Button>
  );
}

function AiErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      {error}
    </div>
  );
}

// ─── Method Picker ──────────────────────────────────────────

interface MethodPickerProps {
  /** Combined flag — true only when tier allows AI AND user toggle is on */
  hasAI: boolean;
  /** Tier-level AI access only (ignores user toggle). Lets us distinguish
   * "user turned AI off" (hide) from "user can't afford AI" (show upgrade). */
  tierHasAI: boolean;
  onLabelScan: () => void;
  onBarcodeScan: () => void;
  onManual: () => void;
  onUnfiled: () => void;
  showUnfiled: boolean;
  unfiledCount: number;
}

export function MethodPicker({
  hasAI,
  tierHasAI,
  onLabelScan,
  onBarcodeScan,
  onManual,
  onUnfiled,
  showUnfiled,
  unfiledCount,
}: MethodPickerProps) {
  // Three states per AI feature:
  //   hasAI                         → show the enabled button
  //   !hasAI && tierHasAI           → user toggled AI off → hide entirely
  //   !hasAI && !tierHasAI          → tier can't use AI → show upgrade prompt
  const showScanAI = hasAI;
  const showScanUpgrade = !hasAI && !tierHasAI;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          Add Wine
        </DialogTitle>
        <DialogDescription>
          How would you like to add a wine?
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 py-2">
        {showScanAI ? (
          <PickerButton icon={Camera} label="Scan Wine" desc="Scan a label, receipt or wine list — switch modes in the camera" onClick={onLabelScan} />
        ) : showScanUpgrade ? (
          <LockedOption label="Scan Wine" desc="Upgrade to scan wine labels, receipts and wine lists with AI" />
        ) : null}

        {showScanAI ? (
          <PickerButton icon={ScanBarcode} label="Scan Barcode" desc="Scan a UPC/EAN barcode on the bottle" onClick={onBarcodeScan} />
        ) : showScanUpgrade ? (
          <LockedOption label="Scan Barcode" desc="Upgrade to scan barcodes with AI" />
        ) : null}

        <PickerButton
          icon={PenLine}
          label="Add Manually"
          desc={hasAI ? "Type a wine name and use AI Search, or enter all details" : "Enter wine details by hand"}
          onClick={onManual}
        />

        {showUnfiled && (
          <button
            type="button"
            className={`flex items-center gap-4 p-4 rounded-lg border border-dashed text-left ${
              unfiledCount > 0
                ? "border-amber-500/40 hover:bg-amber-500/10 cursor-pointer"
                : "border-muted-foreground/20 opacity-50 cursor-not-allowed"
            } transition-colors`}
            onClick={() => unfiledCount > 0 && onUnfiled()}
            disabled={unfiledCount === 0}
          >
            <div className="shrink-0 w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <PackageOpen className={`h-5 w-5 ${unfiledCount > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="font-medium text-sm">Place Unfiled Wine</p>
              <p className="text-xs text-muted-foreground">
                {unfiledCount > 0
                  ? `${unfiledCount} wine${unfiledCount !== 1 ? "s" : ""} waiting to be placed in a rack`
                  : "Wines removed from racks will appear here"}
              </p>
            </div>
          </button>
        )}
      </div>
    </>
  );
}

function PickerButton({ icon: Icon, label, desc, onClick, iconColor = "text-primary", bgColor = "bg-primary/10" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  onClick: () => void;
  iconColor?: string;
  bgColor?: string;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left cursor-pointer"
      onClick={onClick}
    >
      <div className={`shrink-0 w-10 h-10 rounded-full ${bgColor} flex items-center justify-center`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}

function LockedOption({ label, desc }: { label: string; desc: string }) {
  return (
    <a
      href="/settings#subscription"
      className="flex items-center gap-4 p-4 rounded-lg border border-dashed border-muted-foreground/25 text-left opacity-60"
    >
      <div className="shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-sm">{label} <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1.5">Cellar+</Badge></p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </a>
  );
}

// ─── Camera Mode Tabs ────────────────────────────────────────

type CameraMode = "label" | "invoice" | "wine-list" | "barcode";

interface CameraModeTabsProps {
  activeMode: CameraMode;
  onLabel?: () => void;
  onInvoice?: () => void;
  onWineList?: () => void;
  onBarcode?: () => void;
  /** Optional secondary action: open the manual-entry form. Rendered as
   * a small text link below the tabs so the user can always escape the
   * camera-first flow without hunting for an icon. */
  onManualEntry?: () => void;
}

function CameraModeTabs({ activeMode, onLabel, onInvoice, onWineList, onBarcode, onManualEntry }: CameraModeTabsProps) {
  const tabs: { mode: CameraMode; label: string; onClick?: () => void }[] = [
    { mode: "label", label: "Label", onClick: onLabel },
    { mode: "barcode", label: "Barcode", onClick: onBarcode },
    { mode: "invoice", label: "Invoice", onClick: onInvoice },
    { mode: "wine-list", label: "Wine List", onClick: onWineList },
  ];

  return (
    <div className="flex flex-col items-center gap-2 py-3 px-4">
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {tabs.map(({ mode, label, onClick }) => (
          <button
            key={mode}
            type="button"
            onClick={onClick}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              mode === activeMode
                ? "bg-white text-black"
                : "text-white/60 hover:text-white active:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {onManualEntry && (
        <button
          type="button"
          onClick={onManualEntry}
          className="text-xs text-white/60 hover:text-white underline-offset-2 hover:underline"
        >
          Enter manually
        </button>
      )}
    </div>
  );
}

// ─── Label Capture View ─────────────────────────────────────

interface LabelCaptureViewProps {
  aiError: string | null;
  imageBase64: string | null;
  onCapture: (base64: string, mime: string) => void;
  onIdentify: () => void;
  onBack: () => void;
  /** Clears the captured image so the user can retake without leaving label-capture view */
  onRetake?: () => void;
  /** X button in full-screen camera — closes the add-wine dialog */
  onClose?: () => void;
  /** Switch back to wine-label mode (from invoice mode) */
  onSwitchToLabel?: () => void;
  /** Switch to receipt/invoice scan mode (stays in same camera view) */
  onSwitchToReceipt?: () => void;
  /** Switch to wine-list scan mode */
  onSwitchToWineList?: () => void;
  /** Switch to barcode scan mode */
  onSwitchToBarcode?: () => void;
  /** Open the manual-entry form (escape hatch from camera-first flow) */
  onManualEntry?: () => void;
  /** Which tab is currently active in the camera — controls tab highlight */
  cameraActiveMode?: "label" | "invoice" | "wine-list";
  /** Pre-acquired camera stream (acquired inside a user gesture) */
  pendingStream?: MediaStream | null;
}

export function LabelCaptureView({
  aiError,
  imageBase64,
  onCapture,
  onIdentify,
  onBack,
  onRetake,
  onClose,
  onSwitchToLabel,
  onSwitchToReceipt,
  onSwitchToWineList,
  onSwitchToBarcode,
  onManualEntry,
  cameraActiveMode,
  pendingStream,
}: LabelCaptureViewProps) {
  const [captureError, setCaptureError] = useState<string | null>(null);

  const handleCapture = useCallback((base64: string, mime: string) => {
    // Client-side image validation before sending to server
    const decodedSize = Math.ceil((base64.length * 3) / 4);
    const MAX_BYTES = 20 * 1024 * 1024; // 20MB (matches server limit)
    if (decodedSize > MAX_BYTES) {
      setCaptureError(
        `Image too large (${Math.round(decodedSize / (1024 * 1024))}MB). Maximum is 20MB.`
      );
      return;
    }
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!ALLOWED_TYPES.includes(mime)) {
      setCaptureError(
        `Unsupported image type: ${mime}. Allowed: JPEG, PNG, WebP, AVIF.`
      );
      return;
    }
    setCaptureError(null);
    onCapture(base64, mime);
  }, [onCapture]);

  const displayError = captureError ?? aiError;

  // ── No image yet: show full-screen camera overlay ──────────
  if (!imageBase64) {
    return (
      <>
        <AiErrorBanner error={displayError} />
        <ImageCapture
        fullScreen
        autoStart
        pendingStream={pendingStream}
        onCapture={handleCapture}
        onClose={onClose ?? onBack}
        renderTabs={
          <CameraModeTabs
            activeMode={cameraActiveMode ?? "label"}
            onLabel={onSwitchToLabel}
            onInvoice={onSwitchToReceipt}
            onWineList={onSwitchToWineList}
            onBarcode={onSwitchToBarcode}
            onManualEntry={onManualEntry}
          />
        }
        label="Capture a wine label for AI identification"
      />
      </>
    );
  }

  // ── Photo captured: show review + identify inside dialog ───
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          Review Label
        </DialogTitle>
        <DialogDescription>
          Confirm the photo looks good, then identify the wine.
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-1 -mt-1">
        <BackButton onBack={onBack} />
        {onRetake && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground h-7 px-2"
            onClick={onRetake}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retake
          </Button>
        )}
      </div>

      <div className="space-y-4 py-1">
        <AiErrorBanner error={displayError} />
        <div className="rounded-lg overflow-hidden border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/jpeg;base64,${imageBase64}`}
            alt="Captured wine label"
            className="w-full max-h-64 object-contain"
          />
        </div>
        <Button variant="ai" onClick={onIdentify} className="w-full gap-2">
          <Sparkles className="h-4 w-4" />
          Identify Wine with AI
        </Button>
      </div>
    </>
  );
}

// ─── Label Identifying (loading) ────────────────────────────

export function LabelIdentifyingView() {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          Identifying Wine...
        </DialogTitle>
      </DialogHeader>
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="relative">
          <WineIcon className="h-12 w-12 text-primary" />
          <Loader2 className="h-6 w-6 text-amber-500 animate-spin absolute -bottom-1 -right-1" />
        </div>
        <p className="text-sm text-muted-foreground">Analyzing wine label...</p>
      </div>
    </>
  );
}

// ─── Barcode Scan View ──────────────────────────────────────

interface BarcodeScanViewProps {
  aiError: string | null;
  open: boolean;
  onDetected: (barcode: string) => void;
  onBack: () => void;
}

export function BarcodeScanView({ aiError, open, onDetected, onBack }: BarcodeScanViewProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ScanBarcode className="h-5 w-5 text-primary" />
          Scan Barcode
        </DialogTitle>
        <DialogDescription>
          Scan a wine bottle barcode or enter it manually.
        </DialogDescription>
      </DialogHeader>
      <BackButton onBack={onBack} />
      <div className="space-y-4 py-1">
        <AiErrorBanner error={aiError} />
        <BarcodeScanner active={open} onDetected={onDetected} />
      </div>
    </>
  );
}

// ─── Barcode Looking Up (loading) ───────────────────────────

export function BarcodeLookupView({ barcodeValue }: { barcodeValue: string }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          Looking Up Wine...
        </DialogTitle>
      </DialogHeader>
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="relative">
          <WineIcon className="h-12 w-12 text-primary" />
          <Loader2 className="h-6 w-6 text-amber-500 animate-spin absolute -bottom-1 -right-1" />
        </div>
        {barcodeValue && (
          <p className="text-sm text-muted-foreground font-mono">{barcodeValue}</p>
        )}
      </div>
    </>
  );
}

// ─── Unfiled Wines Picker ───────────────────────────────────

interface UnfiledPickerProps {
  cabinets: Cabinet[];
  unfiledWines: Wine[];
  unfiledCabinetId: string;
  setUnfiledCabinetId: (v: string) => void;
  pendingSlot?: { cabinetId: string; row: number; col: number } | null;
  onPlaceWine?: (wineId: string, cabinetId: string, row?: number, col?: number) => void;
  onBack: () => void;
  onClose: () => void;
}

export function UnfiledPicker({
  cabinets,
  unfiledWines,
  unfiledCabinetId,
  setUnfiledCabinetId,
  pendingSlot,
  onPlaceWine,
  onBack,
  onClose,
}: UnfiledPickerProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <PackageOpen className="h-5 w-5 text-amber-500" />
          Place Unfiled Wine
        </DialogTitle>
        <DialogDescription>
          Choose a wine and a section to place it in.
        </DialogDescription>
      </DialogHeader>
      <BackButton onBack={onBack} />

      <div className="space-y-4 py-2">
        {cabinets.length > 1 && (
          <div className="grid gap-2">
            <Label>Place into section</Label>
            <Select value={unfiledCabinetId} onValueChange={(v) => v && setUnfiledCabinetId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select section...">
                  {cabinets.find((c) => c.id === unfiledCabinetId)?.name || "Select..."}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {cabinets.map((cab) => (
                  <SelectItem key={cab.id} value={cab.id}>{cab.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="max-h-[350px] overflow-y-auto space-y-1">
          {unfiledWines.map((wine) => (
            <button
              key={wine.id}
              type="button"
              className="flex items-center gap-3 w-full p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left cursor-pointer"
              onClick={() => {
                const targetCabinet = unfiledCabinetId || (cabinets.length > 0 ? cabinets[0].id : "");
                if (targetCabinet && onPlaceWine) {
                  onPlaceWine(wine.id, targetCabinet, pendingSlot?.row, pendingSlot?.col);
                  onClose();
                }
              }}
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  backgroundColor: WINE_TYPE_COLORS[wine.type as keyof typeof WINE_TYPE_COLORS] ?? "#666",
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{wine.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {wine.winery}
                  {wine.vintage ? ` \u00B7 ${wine.vintage}` : ""}
                  {wine.type ? ` \u00B7 ${WINE_TYPE_LABELS[wine.type as keyof typeof WINE_TYPE_LABELS] ?? wine.type}` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </DialogFooter>
    </>
  );
}

// ─── Receipt Scan View ──────────────────────────────────────

interface ReceiptScanViewProps {
  receiptPhase: "capture" | "processing" | "review";
  receiptWines: Array<Record<string, unknown>>;
  receiptSource: string | null;
  receiptSelected: Set<number>;
  setReceiptSelected: (v: Set<number>) => void;
  aiError: string | null;
  saving: boolean;
  onCapture: (base64: string, mimeType: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  onClose: () => void;
  /** Correct a field on one extracted row before adding (vintage / quantity). */
  onEditReceiptWine?: (index: number, patch: Record<string, unknown>) => void;
}

export function ReceiptScanView({
  receiptPhase,
  receiptWines,
  receiptSource,
  receiptSelected,
  setReceiptSelected,
  aiError,
  saving,
  onCapture,
  onSubmit,
  onBack,
  onClose,
  onEditReceiptWine,
}: ReceiptScanViewProps) {
  const [captureError, setCaptureError] = useState<string | null>(null);

  const handleCapture = useCallback((base64: string, mime: string) => {
    // Client-side image validation before sending to server
    const decodedSize = Math.ceil((base64.length * 3) / 4);
    const MAX_BYTES = 20 * 1024 * 1024; // 20MB (matches server limit)
    if (decodedSize > MAX_BYTES) {
      setCaptureError(
        `Image too large (${Math.round(decodedSize / (1024 * 1024))}MB). Maximum is 20MB.`
      );
      return;
    }
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!ALLOWED_TYPES.includes(mime)) {
      setCaptureError(
        `Unsupported image type: ${mime}. Allowed: JPEG, PNG, WebP, AVIF.`
      );
      return;
    }
    setCaptureError(null);
    onCapture(base64, mime);
  }, [onCapture]);

  const displayError = captureError ?? aiError;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-emerald-500" />
          {receiptPhase === "capture" ? "Scan Receipt" : receiptPhase === "processing" ? "Extracting Wines..." : "Wines Found"}
        </DialogTitle>
        <DialogDescription>
          {receiptPhase === "capture"
            ? "Take a photo of a receipt or wine list to add multiple wines."
            : receiptPhase === "processing"
              ? "AI is identifying wines from your photo..."
              : `Found ${receiptWines.length} wines. Select which to add.`}
        </DialogDescription>
      </DialogHeader>
      <BackButton onBack={onBack} />

      {receiptPhase === "capture" && (
        <div className="space-y-4 py-1">
          <AiErrorBanner error={displayError} />
          <ImageCapture
            fullScreen
            autoStart
            onCapture={handleCapture}
            onClose={onClose ?? onBack}
          />
        </div>
      )}

      {receiptPhase === "processing" && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analyzing receipt...</p>
        </div>
      )}

      {receiptPhase === "review" && (
        <div className="space-y-3 py-2">
          {receiptSource && (
            <p className="text-xs text-muted-foreground">Source: <strong>{receiptSource}</strong></p>
          )}
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-xs text-primary hover:underline cursor-pointer"
              onClick={() => {
                if (receiptSelected.size === receiptWines.length) setReceiptSelected(new Set());
                else setReceiptSelected(new Set(receiptWines.map((_, i) => i)));
              }}
            >
              {receiptSelected.size === receiptWines.length ? "Deselect All" : "Select All"}
            </button>
            <span className="text-xs text-muted-foreground">{receiptSelected.size} selected</span>
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {receiptWines.map((w, idx) => (
              <button
                key={idx}
                type="button"
                className={`flex items-center gap-3 w-full p-3 rounded-lg border transition-colors text-left cursor-pointer ${
                  receiptSelected.has(idx) ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
                }`}
                onClick={() => {
                  const next = new Set(receiptSelected);
                  if (next.has(idx)) next.delete(idx); else next.add(idx);
                  setReceiptSelected(next);
                }}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                  receiptSelected.has(idx) ? "border-primary bg-primary text-white" : "border-muted-foreground/30"
                }`}>
                  {receiptSelected.has(idx) && <span className="text-xs">{"\u2713"}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{w.name as string}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {w.winery as string}
                  </p>
                  {/* Vintage + quantity are the two fields invoices most often
                      lose (cramped print, qty column). Always show them and let
                      the user correct them before adding. */}
                  {onEditReceiptWine && (
                    <div
                      className="flex items-center gap-3 mt-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        Vintage
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="\u2014"
                          value={(w.vintage as number | null) ?? ""}
                          onChange={(e) =>
                            onEditReceiptWine(idx, {
                              vintage: e.target.value ? parseInt(e.target.value, 10) : null,
                            })
                          }
                          className="h-7 w-20 text-xs px-2"
                        />
                      </label>
                      <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        Qty
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={(w.quantity as number | undefined) ?? 1}
                          onChange={(e) =>
                            onEditReceiptWine(idx, {
                              quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                            })
                          }
                          className="h-7 w-16 text-xs px-2"
                        />
                      </label>
                    </div>
                  )}
                </div>
                {w.estimatedPrice ? (
                  <span className="text-xs text-muted-foreground shrink-0">${String(w.estimatedPrice)}</span>
                ) : null}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              disabled={receiptSelected.size === 0 || saving}
              onClick={onSubmit}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Add {receiptSelected.size} Wine{receiptSelected.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </div>
      )}
    </>
  );
}

// ─── Wine Form ──────────────────────────────────────────────

interface WineFormProps {
  entryMethod: "label" | "barcode" | "manual";
  aiFilled: boolean;
  aiFields: Set<string>;
  aiError: string | null;
  aiLoading: boolean;
  /** Combined flag — tier + user toggle */
  hasAI: boolean;
  /** Tier-level AI only — used to decide between "hide" (toggle off) and
   * "show locked upgrade prompt" (tier can't use AI). */
  tierHasAI: boolean;
  saving: boolean;
  cabinets: Cabinet[];
  allTags: string[];
  formFields: {
    name: string; setName: (v: string) => void;
    winery: string; setWinery: (v: string) => void;
    vintage: string; setVintage: (v: string) => void;
    type: string; setType: (v: string) => void;
    sparkling: boolean; setSparkling: (v: boolean) => void;
    grapeVariety: string; setGrapeVariety: (v: string) => void;
    region: string; setRegion: (v: string) => void;
    country: string; setCountry: (v: string) => void;
    price: string; setPrice: (v: string) => void;
    purchasePrice: string; setPurchasePrice: (v: string) => void;
    alcohol: string; setAlcohol: (v: string) => void;
    cabinetId: string; setCabinetId: (v: string) => void;
    notes: string; setNotes: (v: string) => void;
    description: string; setDescription: (v: string) => void;
    drinkBy: string; setDrinkBy: (v: string) => void;
    drinkWindow: string; setDrinkWindow: (v: string) => void;
    disposition: string; setDisposition: (v: string) => void;
    foodPairings: string; setFoodPairings: (v: string) => void;
    userRating: number | null; setUserRating: (v: number | null) => void;
    quantity: string; setQuantity: (v: string) => void;
    tags: string[]; setTags: (v: string[]) => void;
  };
  onSubmit: (e: React.FormEvent) => void;
  /** @deprecated No longer wired — clicking the AI Search button opens the
   * AISearchDialog which fills the form directly. Kept for API stability
   * so existing parents don't break; safe to remove once all callers drop it. */
  onAIAutoFill?: () => void;
  onScanAgain: () => void;
  onBack: () => void;
  onClose: () => void;
  setAiFilled: (v: boolean) => void;
  /** Captured label photo (base64, no data-url prefix). Shown at the top of the
   *  identified-wine form so the user sees the screenshot they just took. */
  imageBase64?: string | null;
}

export function WineForm({
  entryMethod,
  aiFilled,
  aiFields,
  aiError,
  aiLoading,
  hasAI,
  tierHasAI,
  saving,
  cabinets,
  allTags,
  formFields: f,
  onSubmit,
  onScanAgain,
  onBack,
  onClose,
  setAiFilled,
  imageBase64,
}: WineFormProps) {
  const showDrinkRow = aiFilled || f.drinkWindow || f.drinkBy || f.disposition;
  const [aiSearchOpen, setAiSearchOpen] = useState(false);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <WineIcon className="h-5 w-5 text-primary" />
          {entryMethod === "manual" ? "Add Wine" : entryMethod === "label" ? "Wine Identified" : "Wine Found"}
        </DialogTitle>
        <DialogDescription>
          {entryMethod === "manual"
            ? "Type a wine name and use AI Search, or enter details manually."
            : "Review the details and edit if needed."}
        </DialogDescription>
      </DialogHeader>

      {entryMethod === "manual" && !aiFilled && !f.name.trim() && <BackButton onBack={onBack} />}

      <div className="grid gap-4 py-4">
        {imageBase64 && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${imageBase64}`}
              alt="Captured wine label"
              className="max-h-48 rounded-lg border border-border object-contain shadow-sm"
            />
          </div>
        )}
        {aiFilled && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              <Sparkles className="h-3 w-3 mr-1" />
              AI filled {aiFields.size} fields
            </Badge>
            <span className="text-xs text-muted-foreground">Review and edit as needed</span>
          </div>
        )}
        {aiFilled && <ScanResultScore name={f.name} winery={f.winery} vintage={f.vintage} />}
        <AiErrorBanner error={aiError} />

        {/* Name + AI Search */}
        <div className="grid gap-2">
          <Label htmlFor="wine-name">Wine Name <span className="text-destructive">*</span></Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <WineNameAutocomplete
                id="wine-name"
                placeholder="e.g. Opus One 2019"
                value={f.name}
                autoFocus={entryMethod === "manual"}
                onChange={(v) => { f.setName(v); if (aiFilled) setAiFilled(false); }}
                onPickSuggestion={(s) => {
                  // Fill other fields from the picked candidate — only if empty,
                  // so we never clobber something the user already typed.
                  if (!f.winery && s.winery) f.setWinery(s.winery);
                  if (!f.vintage && s.vintage) f.setVintage(String(s.vintage));
                  if (s.type) f.setType(s.type);
                  if (!f.region && s.region) f.setRegion(s.region);
                  if (!f.country && s.country) f.setCountry(s.country);
                  if (!f.grapeVariety && s.grapeVariety) f.setGrapeVariety(s.grapeVariety);
                }}
              />
            </div>
            {hasAI ? (
              <Button
                type="button"
                variant={aiFilled ? "outline" : "default"}
                size="sm"
                onClick={() => setAiSearchOpen(true)}
                disabled={aiLoading}
                className="shrink-0 gap-1.5"
              >
                {aiLoading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Searching...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" />AI Search</>
                )}
              </Button>
            ) : !tierHasAI ? (
              /* Only show locked upgrade prompt to users whose tier can't
                 use AI. If they just toggled AI off, hide entirely. */
              <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5 opacity-50" disabled>
                <Lock className="h-3.5 w-3.5" />
                AI Search
              </Button>
            ) : null}
          </div>
        </div>

        {/* Winery + Vintage */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 grid gap-2">
            <Label htmlFor="wine-winery">Winery<AiIndicator field="winery" aiFields={aiFields} /></Label>
            <Input id="wine-winery" placeholder="e.g. Caymus Vineyards" value={f.winery} onChange={(e) => f.setWinery(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wine-vintage">Vintage<AiIndicator field="vintage" aiFields={aiFields} /></Label>
            <Input id="wine-vintage" type="number" placeholder="2021" min={1900} max={2099} value={f.vintage} onChange={(e) => f.setVintage(e.target.value)} />
          </div>
        </div>

        {/* Type + Grape */}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Type<AiIndicator field="type" aiFields={aiFields} /></Label>
            <Select value={f.type} onValueChange={(v) => v && f.setType(v)}>
              <SelectTrigger>
                <SelectValue>{WINE_TYPE_LABELS[f.type as keyof typeof WINE_TYPE_LABELS] || f.type}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {WINE_TYPES_FOR_PICKER.map((t) => (<SelectItem key={t} value={t}>{WINE_TYPE_LABELS[t]}</SelectItem>))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none mt-1">
              <input
                type="checkbox"
                checked={f.sparkling}
                onChange={(e) => f.setSparkling(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Sparkling
            </label>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wine-grape">Grape Variety<AiIndicator field="grapeVariety" aiFields={aiFields} /></Label>
            <Input id="wine-grape" placeholder="e.g. Cabernet Sauvignon" value={f.grapeVariety} onChange={(e) => f.setGrapeVariety(e.target.value)} />
          </div>
        </div>

        {/* Region + Country */}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="wine-region">Region<AiIndicator field="region" aiFields={aiFields} /></Label>
            <Input id="wine-region" placeholder="e.g. Napa Valley" value={f.region} onChange={(e) => f.setRegion(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wine-country">Country<AiIndicator field="country" aiFields={aiFields} /></Label>
            <Input id="wine-country" placeholder="e.g. USA" value={f.country} onChange={(e) => f.setCountry(e.target.value)} />
          </div>
        </div>

        {/* Quantity — how many identical bottles to add */}
        <div className="grid gap-2">
          <Label htmlFor="wine-quantity">Quantity</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label="Decrease quantity"
              onClick={() =>
                f.setQuantity(String(Math.max(1, (parseInt(f.quantity, 10) || 1) - 1)))
              }
            >
              −
            </Button>
            <Input
              id="wine-quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={f.quantity}
              onChange={(e) => {
                // Free-typing: allow empty while editing, clamp on submit.
                const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
                f.setQuantity(v);
              }}
              onBlur={() => {
                if (!f.quantity) f.setQuantity("1");
              }}
              className="h-9 w-20 text-center"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label="Increase quantity"
              onClick={() =>
                f.setQuantity(String(Math.min(99, (parseInt(f.quantity, 10) || 1) + 1)))
              }
            >
              +
            </Button>
            <span className="text-xs text-muted-foreground">
              {(parseInt(f.quantity, 10) || 1) > 1
                ? `Adds ${parseInt(f.quantity, 10)} bottles`
                : "bottle"}
            </span>
          </div>
        </div>

        {/* Your Rating */}
        <div className="grid gap-2">
          <Label>Your Rating</Label>
          <div className="flex items-center gap-1 h-8">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="p-0.5 transition-transform hover:scale-110"
                aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                onClick={() => f.setUserRating(f.userRating === star ? null : star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(null)}
              >
                <Star
                  className={cn(
                    "h-6 w-6 transition-colors",
                    (hoverRating ?? f.userRating ?? 0) >= star
                      ? "text-yellow-500 fill-yellow-500"
                      : "text-muted-foreground/30"
                  )}
                />
              </button>
            ))}
            {f.userRating != null && (
              <button
                type="button"
                className="ml-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => f.setUserRating(null)}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Purchase Price + Market Value */}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            {/* Deliberately NO AiIndicator: purchase price is what the user
                paid — never AI-filled, manual entry only. */}
            <Label htmlFor="wine-purchase-price">Purchase Price ($)</Label>
            <Input id="wine-purchase-price" type="number" step="0.01" min="0" placeholder="0.00" value={f.purchasePrice} onChange={(e) => f.setPurchasePrice(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wine-price">Market Value ($)<AiIndicator field="price" aiFields={aiFields} /></Label>
            <Input id="wine-price" type="number" step="0.01" min="0" placeholder="0.00" value={f.price} onChange={(e) => f.setPrice(e.target.value)} />
          </div>
        </div>

        {/* Alcohol + Section */}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="wine-alcohol">Alcohol<AiIndicator field="alcohol" aiFields={aiFields} /></Label>
            <Input id="wine-alcohol" placeholder="14.5%" value={f.alcohol} onChange={(e) => f.setAlcohol(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Section</Label>
            <Select value={f.cabinetId || "__unfiled__"} onValueChange={(v) => v && f.setCabinetId(v === "__unfiled__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Unfiled">{cabinets.find((c) => c.id === f.cabinetId)?.name || "Unfiled"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unfiled__">Unfiled (place later)</SelectItem>
                {cabinets.map((cab) => (<SelectItem key={cab.id} value={cab.id}>{cab.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Drink Window + Disposition. On mobile drink-window gets a
            full row of its own — at 3-col / 375px the input was clipping
            the trailing year digit ("2026-202" with the "8" hidden). */}
        {showDrinkRow && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="grid gap-2 col-span-2 sm:col-span-1">
              <Label htmlFor="wine-drink-window">Drink Window<AiIndicator field="drinkWindow" aiFields={aiFields} /></Label>
              <Input id="wine-drink-window" placeholder="2025-2030" value={f.drinkWindow} onChange={(e) => f.setDrinkWindow(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wine-drink-by">Drink By<AiIndicator field="drinkBy" aiFields={aiFields} /></Label>
              <Input id="wine-drink-by" placeholder="2030" value={f.drinkBy} onChange={(e) => f.setDrinkBy(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Readiness<AiIndicator field="disposition" aiFields={aiFields} /></Label>
              <Select value={f.disposition} onValueChange={(v) => v && f.setDisposition(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select...">{f.disposition === "D" ? "Drink Now" : f.disposition === "H" ? "Hold" : f.disposition === "P" ? "Past Peak" : "Select..."}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="D">Drink Now</SelectItem>
                  <SelectItem value="H">Hold</SelectItem>
                  <SelectItem value="P">Past Peak</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Tags */}
        <div className="grid gap-2">
          <Label>Tags</Label>
          <TagSelector tags={f.tags} onChange={f.setTags} allTags={allTags} />
        </div>

        {/* Description */}
        <div className="grid gap-2">
          <Label htmlFor="wine-description">Description<AiIndicator field="description" aiFields={aiFields} /></Label>
          <Textarea id="wine-description" placeholder="Tasting notes, appearance, etc." value={f.description} onChange={(e) => f.setDescription(e.target.value)} rows={2} />
        </div>

        {/* Notes */}
        <div className="grid gap-2">
          <Label htmlFor="wine-notes">Personal Notes<AiIndicator field="notes" aiFields={aiFields} /></Label>
          <Textarea id="wine-notes" placeholder="Your personal notes about this wine..." value={f.notes} onChange={(e) => f.setNotes(e.target.value)} rows={2} />
        </div>
      </div>

      <DialogFooter>
        {entryMethod !== "manual" && (
          <Button type="button" variant="outline" onClick={onScanAgain}>
            Scan Again
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving || !f.name.trim()}>
          {saving ? "Adding..." : "Add Wine"}
        </Button>
      </DialogFooter>

      {/* AI Search — opens on the "AI Search" button. Picking a result
          fills any empty form fields (never clobbers what the user has
          already typed). Silences the `onAIAutoFill` prop's old one-shot
          flow; the old path is still exported for any legacy caller. */}
      <AISearchDialog
        open={aiSearchOpen}
        onOpenChange={setAiSearchOpen}
        initialQuery={[f.name, f.winery, f.vintage].filter(Boolean).join(" ")}
        onPick={(pick, fill) => {
          // Core fields from the light suggestion — always overwrite name
          // (user explicitly picked) but respect anything else they typed.
          f.setName(pick.name);
          if (!f.winery && pick.winery) f.setWinery(pick.winery);
          if (!f.vintage && pick.vintage) f.setVintage(String(pick.vintage));
          if (pick.type) f.setType(pick.type);
          if (!f.region && pick.region) f.setRegion(pick.region);
          if (!f.country && pick.country) f.setCountry(pick.country);
          if (!f.grapeVariety && pick.grapeVariety) f.setGrapeVariety(pick.grapeVariety);
          // Rich fields from the full AI identification call
          if (fill.sparkling !== undefined) f.setSparkling(fill.sparkling);
          if (!f.description && fill.description) f.setDescription(fill.description);
          if (!f.alcohol && fill.alcohol) f.setAlcohol(fill.alcohol);
          if (!f.price && fill.estimatedPrice != null) f.setPrice(String(fill.estimatedPrice));
          if (!f.drinkBy && fill.drinkBy) f.setDrinkBy(fill.drinkBy);
          if (!f.drinkWindow && fill.drinkWindow) f.setDrinkWindow(fill.drinkWindow);
          if (!f.disposition && fill.disposition) f.setDisposition(fill.disposition);
          // Mark form as AI-filled so the AI field indicator badges show
          setAiFilled(true);
        }}
      />
    </form>
  );
}
