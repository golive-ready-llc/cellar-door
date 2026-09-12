"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Camera, Upload, X, RotateCcw, SwitchCamera, Loader2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNative, takeNativePhoto, pickNativePhoto, hapticTap } from "@/lib/capacitor";

/** Max pixel dimension for AI uploads — keeps payloads under server body limit */
const DEFAULT_MAX_DIM = 1280;
/** Default JPEG quality for compressed output */
const DEFAULT_QUALITY = 0.85;

interface ImageCaptureProps {
  onCapture: (imageBase64: string, mimeType: string) => void;
  label?: string;
  accept?: string;
  /** Automatically start the camera on mount */
  autoStart?: boolean;
  /** Max pixel dimension (width or height) — images are resized to fit. Default 1280 */
  maxDimension?: number;
  /** JPEG quality for output (0-1). Default 0.85 */
  quality?: number;
  /** Render as a fixed full-viewport overlay (Vivino-style) */
  fullScreen?: boolean;
  /** Content rendered below the camera in full-screen mode (e.g. mode tabs) */
  renderTabs?: React.ReactNode;
  /** Escape hatch rendered inside the camera-error overlay: "Add manually
   *  instead". A denied camera is a dead end on desktops and embedded
   *  browsers — the manual form must be one tap away, not a small tab
   *  below a full-screen error. */
  onManualEntry?: () => void;
  /** Called when the X button is tapped in full-screen mode */
  onClose?: () => void;
  /** Pre-acquired camera stream (acquired inside a user gesture so the
   * browser shows the permission prompt). When provided, the component
   * uses this stream directly instead of calling getUserMedia itself. */
  pendingStream?: MediaStream | null;
}

/** Four corner bracket guides overlaid on the live viewfinder */
function CornerBrackets() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative w-56 h-72">
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-sm opacity-80" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-sm opacity-80" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-sm opacity-80" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-sm opacity-80" />
      </div>
    </div>
  );
}

/**
 * Compress / resize an image using an off-screen canvas.
 * Returns { base64, mimeType } where base64 has NO data-url prefix.
 */
function compressImage(
  src: string, // full data-url or img src
  maxDim: number,
  jpegQuality: number
): Promise<{ base64: string; mimeType: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      // Scale down if either dimension exceeds maxDim
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));
      ctx.drawImage(img, 0, 0, width, height);
      const mimeType = "image/jpeg";
      const dataUrl = canvas.toDataURL(mimeType, jpegQuality);
      const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        resolve({ base64: match[2], mimeType: match[1], dataUrl });
      } else {
        reject(new Error("Failed to encode image"));
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/**
 * Map a getUserMedia / camera failure to a clear, user-facing message.
 * Detection keys off the DOMException *name* (e.g. "NotFoundError"), which is
 * reliable — the human-readable message ("Requested device not found") does NOT
 * contain those identifiers, so matching the message alone silently missed the
 * no-camera and permission cases and always showed the generic fallback.
 */
/** Async web-path mapping: when the Permissions API reports the site as
 *  denied, the browser will never show a prompt — the message must point at
 *  browser settings instead of implying a retry will ask. */
async function webCameraErrorMessage(err: unknown): Promise<string> {
  const mapped = cameraErrorMessage(err);
  try {
    const perm = await navigator.permissions?.query({
      name: "camera" as PermissionName,
    });
    if (perm?.state === "denied") {
      return "Camera is blocked for this site — no prompt will appear. Allow it via the camera icon in the address bar (or your browser's camera settings), then retry — or upload a photo or add manually instead.";
    }
  } catch {
    /* Permissions API unsupported/unusual name — keep the mapped message. */
  }
  return mapped;
}

function cameraErrorMessage(err: unknown): string {
  const id = `${err instanceof Error ? err.name : ""} ${err instanceof Error ? err.message : String(err)}`;
  if (/NotAllowed|Permission|SecurityError/i.test(id)) {
    return "Camera access denied. Allow camera access in your browser (camera icon in the address bar), then retry — or upload a photo instead.";
  }
  if (/NotFound|DevicesNotFound|Overconstrained/i.test(id)) {
    return "No camera found on this device — upload a photo instead. (A live camera needs a device with a webcam.)";
  }
  if (/NotReadable|TrackStart|Abort/i.test(id)) {
    return "Your camera is busy or unavailable (another app may be using it). Close that app and retry, or upload a photo.";
  }
  return "Couldn't access the camera — upload a photo instead.";
}

/**
 * Image capture component with live camera viewfinder.
 *
 * On native (Android/iOS via Capacitor): uses the native camera plugin
 * for a full-screen native camera experience.
 *
 * On web: uses getUserMedia for a real camera feed with a capture button overlay.
 * Falls back to file upload if camera access is denied.
 */
export function ImageCapture({
  onCapture,
  label = "Take a photo or upload an image",
  accept = "image/*",
  autoStart = false,
  maxDimension = DEFAULT_MAX_DIM,
  quality = DEFAULT_QUALITY,
  fullScreen = false,
  renderTabs,
  onManualEntry,
  onClose,
  pendingStream,
}: ImageCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Tracks unmount so a late-resolving native camera promise can't try
  // to update state on a torn-down component (or worse, surface a stale
  // photo from a previous session).
  const unmountedRef = useRef(false);

  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // Mark unmounted so any in-flight native Camera.getPhoto promise that
  // resolves after the user closes the dialog is silently dropped instead
  // of trying to set state on a dead component.
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  // ─── Native camera (Capacitor) ──────────────────────────────
  // takeNativePhoto / pickNativePhoto return a discriminated union so
  // we can show the right UI for each outcome (cancellation is silent,
  // permission denial points at settings, real errors surface details).
  const handleNativeCamera = useCallback(async () => {
    setCameraLoading(true);
    setCameraError(null);
    try {
      const result = await takeNativePhoto();
      if (unmountedRef.current) return;
      if (result.ok) {
        hapticTap();
        const srcUrl = `data:${result.mimeType};base64,${result.base64}`;
        const compressed = await compressImage(srcUrl, maxDimension, quality);
        if (unmountedRef.current) return;
        setPreview(compressed.dataUrl);
        setFileName("camera-capture.jpg");
        onCapture(compressed.base64, compressed.mimeType);
      } else if (result.reason === "cancelled") {
        // User backed out — no error UI. Just clear loading state and
        // leave the picker showing so they can try again or pick gallery.
      } else if (result.reason === "permission") {
        setCameraError("Camera permission denied. Enable it in your phone's app settings, or use Upload from Gallery.");
      } else if (result.reason === "timeout") {
        setCameraError("The camera didn't respond. Try again or use Upload from Gallery.");
      } else {
        setCameraError(result.message || "Could not capture photo. Try again or use Upload.");
      }
    } finally {
      if (!unmountedRef.current) setCameraLoading(false);
    }
  }, [onCapture, maxDimension, quality]);

  const handleNativeGallery = useCallback(async () => {
    setCameraLoading(true);
    try {
      const result = await pickNativePhoto();
      if (unmountedRef.current) return;
      if (result.ok) {
        const srcUrl = `data:${result.mimeType};base64,${result.base64}`;
        const compressed = await compressImage(srcUrl, maxDimension, quality);
        if (unmountedRef.current) return;
        setPreview(compressed.dataUrl);
        setFileName("gallery-photo.jpg");
        onCapture(compressed.base64, compressed.mimeType);
      } else if (result.reason === "permission") {
        setCameraError("Photo library permission denied. Enable it in app settings.");
      } else if (result.reason === "error") {
        setCameraError(result.message || "Could not access gallery.");
      }
      // cancelled / timeout: silent, just stop loading
    } finally {
      if (!unmountedRef.current) setCameraLoading(false);
    }
  }, [onCapture, maxDimension, quality]);

  // ─── Web camera (getUserMedia) ─────────────────────────────

  // Stop the camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Start the camera stream. Returns true on success, false on failure
  // so the caller can decide whether to try a fallback (e.g. native
  // camera intent on Capacitor when WebView's getUserMedia is blocked).
  const startCamera = useCallback(
    async (facing: "environment" | "user" = facingMode): Promise<boolean> => {
      setCameraLoading(true);
      setCameraError(null);
      try {
        // Stop any existing stream first
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("getUserMedia not available");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setCameraActive(true);
        setFacingMode(facing);
        return true;
      } catch (err) {
        // On native Capacitor we don't surface an error here — the caller falls
        // back to the native intent. On web we set a clear error (mapped from
        // the DOMException name). When the Permissions API says the site is
        // outright denied, no prompt will EVER appear, so say that instead
        // of implying a retry could ask.
        if (!isNative) {
          setCameraError(await webCameraErrorMessage(err));
        }
        setCameraActive(false);
        return false;
      } finally {
        setCameraLoading(false);
      }
    },
    [facingMode]
  );

  // Auto-start camera on mount.
  //
  // Both web AND native (Capacitor) try getUserMedia first. On web that's
  // the only option. On native we ALSO want it — gives the user the same
  // in-app live preview with tappable mode tabs (Label / Barcode /
  // Invoice / Wine List) instead of the system camera app intent that
  // hides our UI. WebView camera works on native because the Capacitor
  // app declares CAMERA permission in AndroidManifest, and the
  // BridgeWebChromeClient grants getUserMedia by default in v8.
  //
  // If getUserMedia fails on native (e.g. older WebView, permission
  // denied at the WebView layer), we fall back to the native
  // Camera.getPhoto intent — slightly worse UX (full system camera app)
  // but still functional.
  useEffect(() => {
    if (!autoStart || preview) return;
    // StrictMode dev double-invokes effects: cleanup runs while the first
    // getUserMedia() is still pending. If we naively assigned the resolved
    // stream into streamRef.current AFTER cleanup, the first stream would
    // leak (camera light stuck on). Inline the start logic so the resolution
    // path can check `cancelled` BEFORE assignment and stop the stream
    // locally if so.
    let cancelled = false;

    (async () => {
      setCameraLoading(true);
      setCameraError(null);
      let ok = false;
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        // Use a pre-acquired stream if available (acquired inside a user
        // gesture so the browser shows the permission prompt) — but ONLY if
        // its tracks are still live. The parent holds this stream until the
        // dialog closes, yet the first capture's stopCamera() ends its tracks.
        // On a remount (e.g. wine-list "Scan Another" / a failed scan returns
        // to the camera, or label "Scan Again") the parent re-passes that same
        // now-dead stream; adopting it shows a black viewfinder with live
        // controls. When it's dead, fall through to a fresh getUserMedia.
        const pendingUsable =
          !!pendingStream &&
          pendingStream.getVideoTracks().some((t) => t.readyState === "live");

        if (pendingStream && pendingUsable) {
          if (cancelled || unmountedRef.current) {
            // Nobody else will adopt this stream — stop it or the camera
            // stays locked (tracks live in a stream no ref points to).
            pendingStream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = pendingStream;
          if (videoRef.current) {
            videoRef.current.srcObject = pendingStream;
            await videoRef.current.play();
          }
          setCameraActive(true);
          ok = true;
        } else {
          if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("getUserMedia not available");
          }
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode,
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
          // Critical: check cancellation BEFORE assigning to streamRef so
          // a torn-down effect doesn't park a live stream on a dead component.
          if (cancelled || unmountedRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
          setCameraActive(true);
          ok = true;
        }
      } catch (err) {
        if (cancelled || unmountedRef.current) return;
        if (!isNative) {
          setCameraError(await webCameraErrorMessage(err));
        }
        setCameraActive(false);
      } finally {
        if (!cancelled && !unmountedRef.current) setCameraLoading(false);
      }

      if (cancelled || unmountedRef.current) return;
      if (!ok && isNative) {
        // WebView blocked getUserMedia on native — fall back to the
        // system camera intent so the user can still take a photo
        // (just without our in-app live preview + mode tabs).
        // Re-check unmountedRef in case the dialog was dismissed while
        // startCamera() was rejecting — otherwise the system camera
        // intent launches over a closed dialog.
        if (unmountedRef.current) return;
        handleNativeCamera();
      }
    })();

    // Cleanup on unmount/StrictMode-rerun. Only stop tracks if streamRef
    // was actually populated (i.e. assignment survived past the cancellation
    // check). The async path's own cancelled-check handles the leak when
    // the stream resolves AFTER cleanup runs.
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // #28 fix: when the camera transitions inactive → active (e.g. parent
  // forces a retake by re-mounting or a manual retake), any stale `preview`
  // would otherwise render the fullScreen spinner forever. A fresh camera
  // start unambiguously means "user wants to capture again" — clear preview.
  const prevCameraActiveRef = useRef(false);
  useEffect(() => {
    if (cameraActive && !prevCameraActiveRef.current && preview) {
      setPreview(null);
      setFileName(null);
    }
    prevCameraActiveRef.current = cameraActive;
  }, [cameraActive, preview]);

  // Capture a frame from the video
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    // Capture at native video resolution first
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const rawDataUrl = canvas.toDataURL("image/jpeg", 0.95);

    // Stop the camera immediately — we already have the frame in
    // rawDataUrl, so the live MediaStream is no longer needed. Doing it
    // before the (potentially slow) compressImage call prevents the
    // camera LED from staying on for hundreds of ms on slow devices,
    // and guarantees the stream is released even if compression throws.
    stopCamera();

    // Compress/resize to target dimensions
    try {
      const compressed = await compressImage(rawDataUrl, maxDimension, quality);
      setPreview(compressed.dataUrl);
      setFileName("camera-capture.jpg");
      onCapture(compressed.base64, compressed.mimeType);
    } catch {
      // Fallback: use raw capture without compression
      setPreview(rawDataUrl);
      setFileName("camera-capture.jpg");
      const match = rawDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) onCapture(match[2], match[1]);
    }
  }, [onCapture, stopCamera, maxDimension, quality]);

  // Switch between front and back camera
  const switchCamera = useCallback(() => {
    const newFacing = facingMode === "environment" ? "user" : "environment";
    startCamera(newFacing);
  }, [facingMode, startCamera]);

  // Handle file upload
  const processFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      stopCamera();
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawDataUrl = event.target?.result as string;
        try {
          const compressed = await compressImage(rawDataUrl, maxDimension, quality);
          setPreview(compressed.dataUrl);
          onCapture(compressed.base64, compressed.mimeType);
        } catch {
          // Fallback: use raw without compression
          setPreview(rawDataUrl);
          const match = rawDataUrl.match(
            /^data:(image\/[a-zA-Z+]+);base64,(.+)$/
          );
          if (match) onCapture(match[2], match[1]);
        }
      };
      reader.readAsDataURL(file);
    },
    [onCapture, stopCamera, maxDimension, quality]
  );

  const handleUploadChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleClear = useCallback(() => {
    setPreview(null);
    setFileName(null);
    if (uploadRef.current) uploadRef.current.value = "";
  }, []);

  const handleRetake = useCallback(() => {
    handleClear();
    startCamera();
  }, [handleClear, startCamera]);

  // ─── Full-screen overlay render (Vivino-style) ────────────
  // Rendered INLINE (no body portal): a Base UI modal marks every direct
  // <body> child outside its own popup aria-hidden + inert, which used to
  // hide this entire overlay from screen readers. The host dialog renders
  // edge-to-edge for camera views (no centering transform), so fixed
  // inset-0 still covers the viewport from inside the popup.
  if (fullScreen) {
    const hiddenEls = (
      <>
        <canvas ref={canvasRef} className="hidden" />
        <input ref={uploadRef} type="file" accept={accept} onChange={handleUploadChange} className="hidden" />
      </>
    );

    // Brief loading state after capture — parent will unmount us once imageBase64 propagates
    if (preview) {
      return (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
          {hiddenEls}
          <Loader2 className="h-10 w-10 animate-spin text-white" />
        </div>
      );
    }

    return (
      <div data-camera-overlay className="fixed inset-0 z-[200] bg-black flex flex-col">
        {hiddenEls}

        {/* Top bar — pt accounts for the device status-bar safe area on
            native, otherwise "Scan Wine" + the X overlap the notch / clock */}
        <div
          className="flex items-center justify-between px-4 pb-3 shrink-0"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <span className="text-white font-medium text-base">Scan Wine</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-white p-1.5 rounded-full hover:bg-white/20 active:bg-white/30 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Camera / viewfinder area */}
        <div className="flex-1 relative overflow-hidden bg-black">
          {/* Loading spinner */}
          {cameraLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            </div>
          )}

          {/* Live video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Corner bracket guide overlay */}
          {cameraActive && !cameraLoading && <CornerBrackets />}

          {/* Camera error / upload fallback */}
          {cameraError && !cameraLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
              <p className="text-amber-400 text-sm text-center">{cameraError}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => uploadRef.current?.click()}
                className="gap-2 border-white/30 text-white hover:bg-white/10"
              >
                <Upload className="h-4 w-4" />
                Upload from Gallery
              </Button>
              {onManualEntry && (
                <Button
                  type="button"
                  onClick={onManualEntry}
                  className="gap-2 min-w-36"
                >
                  <PenLine className="h-4 w-4" />
                  Add manually instead
                </Button>
              )}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm text-white/70 underline underline-offset-2 hover:text-white"
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {/* Native retry state (after dismissing native camera). Only show
              when the WEB camera is NOT live — otherwise these buttons hover
              over the in-app live viewfinder. */}
          {isNative && !cameraActive && !cameraLoading && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
              <Button type="button" onClick={handleNativeCamera} className="gap-2 min-w-36">
                <Camera className="h-4 w-4" />
                Take Photo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleNativeGallery}
                className="gap-2 min-w-36 border-white/30 text-white hover:bg-white/10"
              >
                <Upload className="h-4 w-4" />
                Gallery
              </Button>
            </div>
          )}

          {/* Web camera bottom controls */}
          {cameraActive && !cameraLoading && (
            <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-10 px-8 pb-6 pt-12 bg-gradient-to-t from-black/70 to-transparent">
              {/* Gallery / upload */}
              <button
                type="button"
                onClick={() => uploadRef.current?.click()}
                className="text-white flex flex-col items-center gap-1.5"
              >
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Upload className="h-5 w-5" />
                </div>
                <span className="text-xs text-white/70">Gallery</span>
              </button>

              {/* Shutter */}
              <button
                type="button"
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 active:scale-95 transition-all flex items-center justify-center"
              >
                <div className="w-12 h-12 rounded-full bg-white" />
              </button>

              {/* Switch camera */}
              <button
                type="button"
                onClick={switchCamera}
                className="text-white flex flex-col items-center gap-1.5"
              >
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <SwitchCamera className="h-5 w-5" />
                </div>
                <span className="text-xs text-white/70">Flip</span>
              </button>
            </div>
          )}
        </div>

        {/* Mode tabs rendered by parent. The bottom padding must clear the
            Android nav bar / iOS home indicator — without the safe-area inset
            the mode tabs + "Enter manually" sit under the system navigation
            bar (3-button nav especially) and become hard to read and tap. */}
        {renderTabs && (
          <div
            className="shrink-0 bg-black"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            {renderTabs}
          </div>
        )}
      </div>
    );
  }

  // ─── Normal (inline) render ────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input for upload */}
      <input
        ref={uploadRef}
        type="file"
        accept={accept}
        onChange={handleUploadChange}
        className="hidden"
      />

      {/* Preview mode — photo taken */}
      {preview ? (
        <div className="relative">
          <div className="rounded-lg overflow-hidden border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Captured wine label"
              className="w-full max-h-64 object-contain"
            />
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground truncate max-w-48">
              {fileName}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRetake}
                className="h-7 px-2 text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Retake
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 px-2 text-xs text-destructive"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        </div>
      ) : cameraActive || cameraLoading ? (
        /* Live camera viewfinder */
        <div className="relative rounded-lg overflow-hidden border border-border bg-black">
          {cameraLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-h-80 object-contain bg-black"
          />

          {/* Camera controls overlay */}
          {cameraActive && (
            <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-4 p-4 bg-gradient-to-t from-black/60 to-transparent">
              {/* Upload fallback */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => uploadRef.current?.click()}
                className="text-white hover:bg-white/20 h-10 w-10 p-0"
              >
                <Upload className="h-5 w-5" />
              </Button>

              {/* Capture button — large shutter */}
              <button
                type="button"
                onClick={capturePhoto}
                className="w-14 h-14 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 active:bg-white/60 transition-colors flex items-center justify-center"
              >
                <div className="w-10 h-10 rounded-full bg-white" />
              </button>

              {/* Switch camera */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={switchCamera}
                className="text-white hover:bg-white/20 h-10 w-10 p-0"
              >
                <SwitchCamera className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Initial state or camera error — show buttons */
        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
          <div className="flex flex-col items-center gap-3">
            {cameraError && (
              <p className="text-xs text-amber-600 dark:text-amber-400 max-w-64">
                {cameraError}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => isNative ? handleNativeCamera() : startCamera()}
                className="gap-2"
              >
                <Camera className="h-4 w-4" />
                Camera
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => isNative ? handleNativeGallery() : uploadRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                {isNative ? "Gallery" : "Upload"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      )}
    </div>
  );
}
