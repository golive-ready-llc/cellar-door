"use client";

import type { RefObject } from "react";
import {
  ScanBarcode,
  Sparkles,
  Loader2,
  AlertCircle,
  Check,
  Wine as WineIcon,
  Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { WINE_TYPES, WINE_TYPE_LABELS } from "@/types/constants";
import type { Cabinet } from "@/types/wine";
import type { WineFormFields } from "@/lib/barcode-lookup";
import type { ScanStep } from "@/hooks/use-barcode-scanner";

// ─── Dialog header helpers ───────────────────────────────────

export function ScanDialogTitle({ step }: { step: ScanStep }) {
  switch (step) {
    case "scan":
      return (
        <>
          <ScanBarcode className="h-5 w-5 text-primary" />
          Scan Barcode
        </>
      );
    case "looking-up":
      return (
        <>
          <Sparkles className="h-5 w-5 text-amber-500" />
          Looking Up Wine...
        </>
      );
    case "review":
      return (
        <>
          <Check className="h-5 w-5 text-green-500" />
          Wine Found
        </>
      );
  }
}

export function ScanDialogDescription({ step }: { step: ScanStep }) {
  switch (step) {
    case "scan":
      return "Scan a wine bottle barcode or enter it manually.";
    case "looking-up":
      return "Searching for this wine in our database...";
    case "review":
      return "Review the identified wine and save to your cellar.";
  }
}

// ─── Error banner ────────────────────────────────────────────

export function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      {error}
    </div>
  );
}

// ─── Step 1: Camera scanner ─────────────────────────────────

interface CameraScannerProps {
  scannerRef: RefObject<HTMLDivElement | null>;
  scannerLoading: boolean;
  onSwitchToManual: () => void;
}

export function CameraScanner({
  scannerRef,
  scannerLoading,
  onSwitchToManual,
}: CameraScannerProps) {
  return (
    <>
      <div
        ref={scannerRef}
        className="relative rounded-lg overflow-hidden border border-border bg-black"
      >
        {scannerLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/60">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
        <div
          id="barcode-scanner-view"
          className="w-full"
          style={{ minHeight: 240 }}
        />
      </div>
      <div className="flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSwitchToManual}
          className="text-xs gap-1.5"
        >
          <Keyboard className="h-3.5 w-3.5" />
          Enter barcode manually
        </Button>
      </div>
    </>
  );
}

// ─── Step 1: Manual entry ───────────────────────────────────

interface ManualEntryProps {
  barcodeValue: string;
  cameraAvailable: boolean;
  onBarcodeChange: (value: string) => void;
  onLookup: () => void;
  onSwitchToCamera: () => void;
}

export function ManualEntry({
  barcodeValue,
  cameraAvailable,
  onBarcodeChange,
  onLookup,
  onSwitchToCamera,
}: ManualEntryProps) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="barcode-manual">Barcode (UPC/EAN)</Label>
        <div className="flex gap-2">
          <Input
            id="barcode-manual"
            placeholder="Enter barcode number..."
            value={barcodeValue}
            onChange={(e) => onBarcodeChange(e.target.value)}
            autoFocus
            className="flex-1"
          />
          <Button variant="ai"
            onClick={onLookup}
            disabled={!barcodeValue.trim()}
            className="gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Look Up
          </Button>
        </div>
      </div>
      {cameraAvailable && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSwitchToCamera}
            className="text-xs gap-1.5"
          >
            <ScanBarcode className="h-3.5 w-3.5" />
            Use camera scanner
          </Button>
        </div>
      )}
    </>
  );
}

// ─── Step 2: Looking-up animation ───────────────────────────

export function LookingUpView({ barcodeValue }: { barcodeValue: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="relative">
        <WineIcon className="h-12 w-12 text-primary" />
        <Loader2 className="h-6 w-6 text-amber-500 animate-spin absolute -bottom-1 -right-1" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">Looking up barcode...</p>
        <p className="text-xs text-muted-foreground mt-1">
          {barcodeValue && (
            <span className="font-mono">{barcodeValue}</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Step 3: Review form ────────────────────────────────────

interface ReviewFormProps {
  barcodeValue: string;
  fields: WineFormFields;
  cabinets: Cabinet[];
  updateField: <K extends keyof WineFormFields>(
    key: K,
    value: WineFormFields[K]
  ) => void;
}

export function ReviewForm({
  barcodeValue,
  fields,
  cabinets,
  updateField,
}: ReviewFormProps) {
  return (
    <>
      {barcodeValue && (
        <Badge variant="outline" className="text-xs font-mono">
          <ScanBarcode className="h-3 w-3 mr-1" />
          {barcodeValue}
        </Badge>
      )}

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">Wine Name *</Label>
          <Input
            value={fields.name}
            onChange={(e) => updateField("name", e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 grid gap-1.5">
            <Label className="text-xs">Winery</Label>
            <Input
              value={fields.winery}
              onChange={(e) => updateField("winery", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Vintage</Label>
            <Input
              type="number"
              value={fields.vintage}
              onChange={(e) => updateField("vintage", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Type</Label>
            <Select
              value={fields.type}
              onValueChange={(v) => v && updateField("type", v)}
            >
              <SelectTrigger>
                <SelectValue>
                  {WINE_TYPE_LABELS[
                    fields.type as keyof typeof WINE_TYPE_LABELS
                  ] || fields.type}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {WINE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {WINE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Grape</Label>
            <Input
              value={fields.grapeVariety}
              onChange={(e) => updateField("grapeVariety", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Region</Label>
            <Input
              value={fields.region}
              onChange={(e) => updateField("region", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Country</Label>
            <Input
              value={fields.country}
              onChange={(e) => updateField("country", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Price ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={fields.price}
              onChange={(e) => updateField("price", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Alcohol</Label>
            <Input
              value={fields.alcohol}
              onChange={(e) => updateField("alcohol", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Section</Label>
            <Select
              value={fields.cabinetId}
              onValueChange={(v) => v && updateField("cabinetId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select...">
                  {cabinets.find((c) => c.id === fields.cabinetId)?.name ||
                    "Select..."}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {cabinets.map((cab) => (
                  <SelectItem key={cab.id} value={cab.id}>
                    {cab.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="grid gap-1.5">
          <Label className="text-xs">Description</Label>
          <Textarea
            value={fields.description}
            onChange={(e) => updateField("description", e.target.value)}
            rows={2}
          />
        </div>
      </div>
    </>
  );
}
