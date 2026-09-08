"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  lookupBarcode,
  buildWineFromFields,
  type WineFormFields,
} from "@/lib/barcode-lookup";
import type { Wine, Cabinet } from "@/types/wine";

export type ScanStep = "scan" | "looking-up" | "review";

const DEFAULT_FIELDS: WineFormFields = {
  name: "",
  winery: "",
  vintage: "",
  type: "red",
  grapeVariety: "",
  region: "",
  country: "",
  price: "",
  alcohol: "",
  description: "",
  drinkBy: "",
  drinkWindow: "",
  disposition: "",
  notes: "",
  cabinetId: "",
};

export function useBarcodeScannerHook(cabinets: Cabinet[]) {
  const defaultCabinetId = cabinets.length > 0 ? cabinets[0].id : "";

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ScanStep>("scan");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState("");

  // Scanner DOM/instance refs
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<unknown>(null);
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [scannerLoading, setScannerLoading] = useState(false);

  // Wine form fields
  const [fields, setFields] = useState<WineFormFields>({
    ...DEFAULT_FIELDS,
    cabinetId: defaultCabinetId,
  });

  const updateField = useCallback(
    <K extends keyof WineFormFields>(key: K, value: WineFormFields[K]) => {
      setFields((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetAll = useCallback(() => {
    setStep("scan");
    setError(null);
    setBarcodeValue("");
    setManualEntry(false);
    setFields({ ...DEFAULT_FIELDS, cabinetId: defaultCabinetId });
  }, [defaultCabinetId]);

  // --- Scanner lifecycle ---
  useEffect(() => {
    if (!open || step !== "scan" || manualEntry) return;

    // Minimal structural type for html5-qrcode instances. Upstream types are
    // awkward to import dynamically, so we capture just the methods we use.
    type Html5QrcodeInstance = {
      start: (
        camera: MediaTrackConstraints | string,
        config: { fps?: number; qrbox?: { width: number; height: number } | number; aspectRatio?: number },
        onSuccess: (decodedText: string) => void,
        onError?: (err: string) => void
      ) => Promise<void>;
      stop: () => Promise<void>;
      clear: () => void;
    };
    let cancelled = false;
    let scanner: Html5QrcodeInstance | null = null;
    // html5-qrcode's stop() REJECTS while start() is still pending, and the
    // camera that start() acquires afterwards keeps running — a leaked live
    // track locks the (Android) camera for the whole app until restart.
    // Cleanup must await the pending start before stopping.
    let startPromise: Promise<void> | null = null;

    const initScanner = async () => {
      if (cancelled) return;
      setScannerLoading(true);
      try {
        if (navigator.permissions) {
          try {
            const perm = await navigator.permissions.query({
              name: "camera" as PermissionName,
            });
            if (perm.state === "denied") {
              if (cancelled) return;
              setCameraAvailable(false);
              setManualEntry(true);
              setScannerLoading(false);
              return;
            }
          } catch {
            // permissions API not supported
          }
        }

        if (cancelled) return;
        const { Html5Qrcode } = await import("html5-qrcode");
        const scannerId = "barcode-scanner-view";

        if (cancelled) return;
        if (!document.getElementById(scannerId)) {
          setScannerLoading(false);
          return;
        }

        scanner = new Html5Qrcode(scannerId) as unknown as Html5QrcodeInstance;
        html5QrCodeRef.current = scanner;

        startPromise = scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 100 }, aspectRatio: 1.5 },
          (decodedText: string) => {
            setBarcodeValue(decodedText);
            handleLookupRef.current(decodedText);
            scanner?.stop().catch(() => {});
          },
          () => {
            // no code found in frame -- normal
          }
        );
        await startPromise;
        // Cleanup may have run while start() was pending — it awaited this
        // promise and stopped the scanner; don't undo the loading state.
        if (cancelled) return;
        setScannerLoading(false);
      } catch {
        if (cancelled) return;
        setScannerLoading(false);
        setCameraAvailable(false);
        setManualEntry(true);
      }
    };

    const timer = setTimeout(initScanner, 600);

    const stopSafely = (s: { stop: () => Promise<void> } | null) => {
      if (!s) return;
      void (async () => {
        try { if (startPromise) await startPromise.catch(() => {}); } catch { /* ignore */ }
        try { await s.stop(); } catch { /* not running — fine */ }
      })();
    };

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopSafely(scanner);
      const refScanner = html5QrCodeRef.current as { stop: () => Promise<void> } | null;
      if (refScanner && refScanner !== scanner) {
        stopSafely(refScanner);
      }
    };
  }, [open, step, manualEntry]);

  // --- Lookup ---
  const handleLookup = useCallback(
    async (barcode: string) => {
      setStep("looking-up");
      setError(null);

      try {
        const result = await lookupBarcode(barcode, defaultCabinetId);

        if (!result.success) {
          setError(result.error);
          setStep("scan");
          return;
        }

        setFields(result.fields);
        setStep("review");
      } catch {
        setError(
          "Failed to look up barcode. Please try again or enter manually."
        );
        setStep("scan");
      }
    },
    [defaultCabinetId]
  );

  // Ref so scanner lifecycle effect always calls the latest handleLookup
  const handleLookupRef = useRef(handleLookup);
  handleLookupRef.current = handleLookup;

  const handleManualLookup = useCallback(() => {
    if (!barcodeValue.trim()) return;
    handleLookup(barcodeValue.trim());
  }, [barcodeValue, handleLookup]);

  // --- Save ---
  const handleSave = useCallback(
    async (
      onAdd: (
        wine: Omit<Wine, "id" | "addedAt" | "updatedAt" | "userId">
      ) => void
    ) => {
      if (!fields.name.trim()) return;
      setSaving(true);
      try {
        onAdd(buildWineFromFields(fields, barcodeValue));
        resetAll();
        setOpen(false);
      } finally {
        setSaving(false);
      }
    },
    [fields, barcodeValue, resetAll]
  );

  // --- Dialog open/close ---
  const handleOpenChange = useCallback(
    (o: boolean) => {
      setOpen(o);
      if (!o) {
        const scanner = html5QrCodeRef.current as {
          stop: () => Promise<void>;
          clear: () => void;
        } | null;
        if (scanner) {
          scanner.stop().catch(() => {});
        }
        resetAll();
      }
    },
    [resetAll]
  );

  return {
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
  };
}
