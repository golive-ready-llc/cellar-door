"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Keyboard, Loader2, ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// BarcodeDetector ambient types live in src/types/barcode-detector.d.ts

interface BarcodeScannerProps {
  /** Called when a barcode is detected */
  onDetected: (barcode: string) => void;
  /** Whether the scanner is active (mount/unmount camera) */
  active: boolean;
}

// Supported barcode formats for wine bottles
const BARCODE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
] as const;

/**
 * Barcode scanner using the native BarcodeDetector API (like Cork Dork).
 *
 * Uses getUserMedia for a live camera feed and BarcodeDetector for
 * continuous frame-by-frame barcode detection via requestAnimationFrame.
 *
 * Falls back to manual barcode entry when BarcodeDetector is not available
 * or camera access is denied.
 */
export function BarcodeScanner({ onDetected, active }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectedRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [hasDetectorSupport, setHasDetectorSupport] = useState(true);

  // Stop camera and scanning
  const stopScanning = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  // Start camera + continuous barcode detection. `isCancelled` is checked
  // after every await — if the effect that started us has already cleaned
  // up (tab switch, dialog close), we stop the just-acquired stream HERE
  // instead of parking it in a ref nobody will ever stop. A leaked live
  // track holds the Android camera HAL open and makes every subsequent
  // getUserMedia in the app fail with NotReadableError until app restart.
  const startScanning = useCallback(async (isCancelled: () => boolean = () => false) => {
    detectedRef.current = false;
    setCameraLoading(true);
    setError(null);

    // Check for BarcodeDetector support
    if (typeof (globalThis as unknown as { BarcodeDetector?: unknown }).BarcodeDetector === "undefined") {
      setHasDetectorSupport(false);

      // Try html5-qrcode as fallback
      try {
        await startHtml5QrCodeFallback(isCancelled);
        return;
      } catch {
        setManualMode(true);
        setCameraLoading(false);
        return;
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (isCancelled()) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Re-check after play()'s await: if cleanup ran during it, stop now
      // rather than spinning up a detector + RAF loop on a torn-down scanner
      // (which could fire onDetected after unmount).
      if (isCancelled()) {
        stopScanning();
        return;
      }

      setCameraReady(true);
      setCameraLoading(false);

      // Create detector and start scanning loop.
      // BarcodeDetector is declared ambient in src/types/barcode-detector.d.ts
      // but TS doesn't surface it on globalThis reliably across configs.
      const BD = (globalThis as unknown as { BarcodeDetector: typeof BarcodeDetector }).BarcodeDetector;
      const detector = new BD({
        formats: BARCODE_FORMATS as unknown as string[],
      });

      const scan = async () => {
        if (detectedRef.current || !videoRef.current || !streamRef.current) return;

        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0 && !detectedRef.current) {
            detectedRef.current = true;
            const value = barcodes[0].rawValue;
            stopScanning();
            onDetected(value);
            return;
          }
        } catch {
          // Detection error on this frame, continue scanning
        }

        rafRef.current = requestAnimationFrame(scan);
      };

      rafRef.current = requestAnimationFrame(scan);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera access denied";
      if (msg.includes("NotAllowed") || msg.includes("Permission")) {
        setError("Camera access denied. Please allow camera access or enter barcode manually.");
      } else {
        setError("Could not access camera. Enter barcode manually.");
      }
      setManualMode(true);
      setCameraLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDetected, stopScanning]);

  // html5-qrcode fallback for browsers without BarcodeDetector
  const html5QrCodeRef = useRef<unknown>(null);
  // The in-flight scanner.start() promise. html5-qrcode's stop() REJECTS if
  // called while start() is still pending — and the camera that start()
  // acquires afterwards keeps running (leaked). Cleanup must await this
  // before stopping.
  const html5StartPromiseRef = useRef<Promise<void> | null>(null);

  const startHtml5QrCodeFallback = useCallback(async (isCancelled: () => boolean = () => false) => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const containerId = "barcode-fallback-scanner";

      // Wait for DOM element
      await new Promise((resolve) => setTimeout(resolve, 100));
      // Bail if the effect that started us was torn down during the import /
      // DOM wait — otherwise scanner.start() below acquires a camera no one
      // will release (Android then locks the HAL app-wide).
      if (isCancelled()) return;
      if (!document.getElementById(containerId)) {
        setCameraLoading(false);
        setManualMode(true);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scanner: any = new Html5Qrcode(containerId);
      html5QrCodeRef.current = scanner;

      const startPromise = scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 100 }, aspectRatio: 2.0 },
        (decodedText: string) => {
          if (!detectedRef.current) {
            detectedRef.current = true;
            try {
              const state = scanner.getState?.();
              if (state === 1 || state === 2) scanner.stop().catch(() => {});
            } catch { /* ignore */ }
            onDetected(decodedText);
          }
        },
        () => {}
      );
      html5StartPromiseRef.current = startPromise;
      await startPromise;
      setCameraReady(true);
      setCameraLoading(false);
    } catch {
      setCameraLoading(false);
      setManualMode(true);
    }
  }, [onDetected]);

  // Cleanup html5-qrcode on unmount — await any pending start() first so
  // the stop actually lands on a running scanner (see html5StartPromiseRef).
  const stopHtml5QrCode = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = html5QrCodeRef.current as any;
    if (!s) return;
    html5QrCodeRef.current = null;
    const pending = html5StartPromiseRef.current;
    html5StartPromiseRef.current = null;
    void (async () => {
      try { if (pending) await pending.catch(() => {}); } catch { /* ignore */ }
      try {
        const state = s.getState?.();
        if (state === 2 || state === 3) await s.stop().catch(() => {});
      } catch { /* ignore */ }
    })();
  }, []);

  // Start/stop based on active prop
  useEffect(() => {
    let cancelled = false;
    if (active && !manualMode) {
      startScanning(() => cancelled);
    }
    return () => {
      cancelled = true;
      stopScanning();
      stopHtml5QrCode();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, manualMode]);

  const handleManualSubmit = () => {
    const trimmed = manualValue.trim();
    if (trimmed) {
      onDetected(trimmed);
    }
  };

  // ── Manual entry mode ──
  if (manualMode) {
    return (
      <div className="space-y-4">
        {error && (
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
            {error}
          </p>
        )}
        <div className="grid gap-2">
          <label htmlFor="barcode-manual-input" className="text-sm font-medium">
            Barcode (UPC/EAN)
          </label>
          <div className="flex gap-2">
            <Input
              id="barcode-manual-input"
              placeholder="Enter barcode number..."
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleManualSubmit();
                }
              }}
              autoFocus
              className="flex-1"
              inputMode="numeric"
            />
            <Button
              onClick={handleManualSubmit}
              disabled={!manualValue.trim()}
              className="gap-1.5"
            >
              Look Up
            </Button>
          </div>
        </div>
        {hasDetectorSupport && (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setManualMode(false);
                setError(null);
              }}
              className="text-xs gap-1.5"
            >
              <ScanBarcode className="h-3.5 w-3.5" />
              Use camera scanner
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Camera scanner mode ──
  return (
    <div className="space-y-3">
      <div className="relative rounded-lg overflow-hidden border border-border bg-black">
        {cameraLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        {/* Native BarcodeDetector: video element */}
        {hasDetectorSupport ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full"
              style={{
                display: cameraReady ? "block" : "none",
                maxHeight: 280,
                objectFit: "cover",
              }}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning overlay with animated line and corner guides */}
            {cameraReady && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Scan region box */}
                <div className="relative w-[70%] h-24">
                  {/* Corner guides */}
                  <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-red-500 rounded-tl-sm" />
                  <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-red-500 rounded-tr-sm" />
                  <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-red-500 rounded-bl-sm" />
                  <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-red-500 rounded-br-sm" />
                  {/* Animated scan line */}
                  <ScanLine />
                </div>
              </div>
            )}
          </>
        ) : (
          /* html5-qrcode fallback container */
          <div
            id="barcode-fallback-scanner"
            className="w-full"
            style={{ minHeight: 200, display: cameraReady ? "block" : "none" }}
          />
        )}
      </div>

      {/* Switch to manual entry */}
      <div className="flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setManualMode(true)}
          className="text-xs gap-1.5"
        >
          <Keyboard className="h-3.5 w-3.5" />
          Enter barcode manually
        </Button>
      </div>
    </div>
  );
}

/** Animated red scan line for the barcode viewfinder */
function ScanLine() {
  return (
    <>
      <div
        className="absolute left-1 right-1 h-0.5 bg-red-500 opacity-80"
        style={{ animation: "bscan 2s ease-in-out infinite", top: 4 }}
      />
      {/* Inject keyframes once — harmless if duplicated */}
      <style dangerouslySetInnerHTML={{ __html: `@keyframes bscan{0%,100%{top:4px}50%{top:calc(100% - 6px)}}` }} />
    </>
  );
}
