"use client";

import { ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Wine, Cabinet } from "@/types/wine";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import {
  ScanDialogTitle,
  ScanDialogDescription,
  ErrorBanner,
  CameraScanner,
  ManualEntry,
  LookingUpView,
  ReviewForm,
} from "@/components/wine/barcode-scan-parts";

interface BarcodeScanDialogProps {
  cabinets: Cabinet[];
  onAdd: (
    wine: Omit<Wine, "id" | "addedAt" | "updatedAt" | "userId">
  ) => void;
  trigger?: React.ReactElement;
}

export function BarcodeScanDialog({
  cabinets,
  onAdd,
  trigger,
}: BarcodeScanDialogProps) {
  const {
    open,
    step,
    saving,
    error,
    manualEntry,
    barcodeValue,
    cameraAvailable,
    scannerLoading,
    scannerRef,
    fields,
    updateField,
    setManualEntry,
    setBarcodeValue,
    setStep,
    setError,
    handleManualLookup,
    handleSave,
    handleOpenChange,
  } = useBarcodeScanner(cabinets);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm" className="gap-1.5">
              <ScanBarcode className="h-4 w-4" />
              Scan
            </Button>
          )
        }
      />
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanDialogTitle step={step} />
          </DialogTitle>
          <DialogDescription>
            <ScanDialogDescription step={step} />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <ErrorBanner error={error} />

          {step === "scan" &&
            (!manualEntry ? (
              <CameraScanner
                scannerRef={scannerRef}
                scannerLoading={scannerLoading}
                onSwitchToManual={() => setManualEntry(true)}
              />
            ) : (
              <ManualEntry
                barcodeValue={barcodeValue}
                cameraAvailable={cameraAvailable}
                onBarcodeChange={setBarcodeValue}
                onLookup={handleManualLookup}
                onSwitchToCamera={() => setManualEntry(false)}
              />
            ))}

          {step === "looking-up" && (
            <LookingUpView barcodeValue={barcodeValue} />
          )}

          {step === "review" && (
            <ReviewForm
              barcodeValue={barcodeValue}
              fields={fields}
              cabinets={cabinets}
              updateField={updateField}
            />
          )}
        </div>

        <DialogFooter>
          {step === "scan" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
          )}
          {step === "review" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("scan");
                  setError(null);
                }}
              >
                Scan Again
              </Button>
              <Button
                onClick={() => handleSave(onAdd)}
                disabled={saving || !fields.name.trim()}
              >
                {saving ? "Saving..." : "Save to Cellar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
