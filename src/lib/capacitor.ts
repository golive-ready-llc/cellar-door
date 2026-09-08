/**
 * Capacitor native bridge utilities.
 *
 * Provides helpers to detect the native runtime and access native plugins.
 * Falls back to web APIs when running in a regular browser.
 */

import { Capacitor } from "@capacitor/core";

// ─── Platform Detection ────────────────────────────────────────

/** True when running inside a Capacitor native shell (Android/iOS) */
export const isNative = Capacitor.isNativePlatform();

/** "android" | "ios" | "web" */
export const platform = Capacitor.getPlatform() as
  | "android"
  | "ios"
  | "web";

/** True when running on a real device (not web, not simulator check) */
export const isAndroid = platform === "android";
export const isIOS = platform === "ios";
export const isWeb = platform === "web";

// ─── Native Camera ─────────────────────────────────────────────

/**
 * Camera intent watchdog timeout in milliseconds.
 *
 * Why: there's been at least one report of the Android camera intent
 * hanging indefinitely, locking the camera resource at the OS level so
 * badly that even force-stopping the app didn't recover — only a phone
 * reboot freed the camera. Without a JS-side timeout, our `await
 * Camera.getPhoto()` never resolves, the loading spinner sits forever,
 * and the user has no escape.
 *
 * Sixty seconds is generous enough that real users taking a photo (which
 * involves opening a native UI, framing, tapping shutter, confirming)
 * will basically never trip it; but if Camera.getPhoto truly hangs it
 * fires soon enough to feel like an honest failure.
 */
const NATIVE_CAMERA_TIMEOUT_MS = 60_000;

/** Race a promise against a timeout. The timeout returns null instead
 * of throwing — the camera helpers already use null to signal "user
 * cancelled / no photo," and treating a hung intent the same way keeps
 * the caller's recovery logic uniform. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn(`[capacitor] native camera intent timed out after ${ms}ms`);
      resolve(null);
    }, ms);
    p.then(
      (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

/**
 * Result shape for native photo helpers — uses a discriminated union so
 * the caller can distinguish "user cancelled" from "actually failed."
 * The previous `null` return collapsed both into one signal which made
 * error UX confusing ("camera didn't capture a photo" for what was
 * really a clean cancellation).
 */
export type NativePhotoResult =
  | { ok: true; base64: string; mimeType: string }
  | { ok: false; reason: "cancelled" | "permission" | "timeout" | "error"; message?: string };

/**
 * Take a photo using the native camera. Returns a discriminated union
 * so callers can show the right UI for the actual outcome.
 *
 * - ok=true: photo data ready
 * - reason=cancelled: user backed out of the camera intent — no error UI
 * - reason=permission: user denied or revoked camera permission
 * - reason=timeout: 60s watchdog fired (Camera.getPhoto hung)
 * - reason=error: anything else, message contains the underlying error
 */
export async function takeNativePhoto(): Promise<NativePhotoResult> {
  if (!isNative) return { ok: false, reason: "error", message: "Not running on native" };

  const { Camera, CameraResultType, CameraSource } = await import(
    "@capacitor/camera"
  );

  type Outcome = { kind: "photo"; photo: { base64String?: string; format?: string } } | { kind: "error"; err: unknown };
  const outcome: Outcome | null = await withTimeout<Outcome>(
    Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      quality: 90,
      width: 1920,
      height: 1080,
      correctOrientation: true,
      allowEditing: false,
    }).then(
      (photo) => ({ kind: "photo", photo } as Outcome),
      (err) => ({ kind: "error", err } as Outcome)
    ),
    NATIVE_CAMERA_TIMEOUT_MS
  );

  if (!outcome) return { ok: false, reason: "timeout" };

  if (outcome.kind === "error") {
    const msg = (outcome.err as { message?: string; code?: string })?.message || String(outcome.err);
    const code = (outcome.err as { code?: string })?.code || "";
    console.warn("[capacitor] Camera.getPhoto error:", { code, message: msg });
    if (/cancel/i.test(msg) || code === "CANCELLED" || code === "USER_CANCELLED") {
      return { ok: false, reason: "cancelled" };
    }
    // Permission denial detection covers Capacitor Camera v6+ which uses
    // codes like OS-PLUG-CAM-0008 and messages like "User denied access to
    // camera". Older shapes still match via /permission/i.
    if (
      /permission|denied/i.test(msg) ||
      code === "PERMISSION_DENIED" ||
      code.includes("PERMISSION") ||
      code.startsWith("OS-PLUG-CAM")
    ) {
      return { ok: false, reason: "permission", message: msg };
    }
    return { ok: false, reason: "error", message: msg };
  }

  const photo = outcome.photo;
  if (!photo.base64String) {
    console.warn("[capacitor] Camera.getPhoto returned no base64String:", photo);
    return { ok: false, reason: "error", message: "Empty photo returned" };
  }

  return {
    ok: true,
    base64: photo.base64String,
    mimeType: `image/${photo.format || "jpeg"}`,
  };
}

/**
 * Pick a photo from the device gallery. Same discriminated-union return
 * shape as takeNativePhoto.
 */
export async function pickNativePhoto(): Promise<NativePhotoResult> {
  if (!isNative) return { ok: false, reason: "error", message: "Not running on native" };

  const { Camera, CameraResultType, CameraSource } = await import(
    "@capacitor/camera"
  );

  type Outcome = { kind: "photo"; photo: { base64String?: string; format?: string } } | { kind: "error"; err: unknown };
  const outcome: Outcome | null = await withTimeout<Outcome>(
    Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
      quality: 90,
      width: 1920,
      correctOrientation: true,
      allowEditing: false,
    }).then(
      (photo) => ({ kind: "photo", photo } as Outcome),
      (err) => ({ kind: "error", err } as Outcome)
    ),
    NATIVE_CAMERA_TIMEOUT_MS
  );

  if (!outcome) return { ok: false, reason: "timeout" };

  if (outcome.kind === "error") {
    const msg = (outcome.err as { message?: string; code?: string })?.message || String(outcome.err);
    const code = (outcome.err as { code?: string })?.code || "";
    console.warn("[capacitor] gallery pick error:", { code, message: msg });
    if (/cancel/i.test(msg) || code === "CANCELLED" || code === "USER_CANCELLED") {
      return { ok: false, reason: "cancelled" };
    }
    // See takeNativePhoto for matcher rationale — covers Capacitor Camera
    // v6+ codes and messages.
    if (
      /permission|denied/i.test(msg) ||
      code === "PERMISSION_DENIED" ||
      code.includes("PERMISSION") ||
      code.startsWith("OS-PLUG-CAM")
    ) {
      return { ok: false, reason: "permission", message: msg };
    }
    return { ok: false, reason: "error", message: msg };
  }

  const photo = outcome.photo;
  if (!photo.base64String) {
    return { ok: false, reason: "error", message: "Empty photo returned" };
  }

  return {
    ok: true,
    base64: photo.base64String,
    mimeType: `image/${photo.format || "jpeg"}`,
  };
}

// ─── Haptics ────────────────────────────────────────────────────

/**
 * Trigger a light haptic tap. No-op on web.
 */
export async function hapticTap(): Promise<void> {
  if (!isNative) return;

  const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
  await Haptics.impact({ style: ImpactStyle.Light });
}

/**
 * Trigger a medium haptic impact. No-op on web.
 */
export async function hapticImpact(): Promise<void> {
  if (!isNative) return;

  const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
  await Haptics.impact({ style: ImpactStyle.Medium });
}

/**
 * Trigger a success notification haptic. No-op on web.
 */
export async function hapticSuccess(): Promise<void> {
  if (!isNative) return;

  const { Haptics, NotificationType } = await import("@capacitor/haptics");
  await Haptics.notification({ type: NotificationType.Success });
}

// ─── Status Bar ─────────────────────────────────────────────────

/**
 * Set the status bar to dark content (light background).
 */
export async function setStatusBarLight(): Promise<void> {
  if (!isNative) return;

  const { StatusBar, Style } = await import("@capacitor/status-bar");
  await StatusBar.setStyle({ style: Style.Light });
}

/**
 * Set the status bar to light content (dark background).
 */
export async function setStatusBarDark(): Promise<void> {
  if (!isNative) return;

  const { StatusBar, Style } = await import("@capacitor/status-bar");
  await StatusBar.setStyle({ style: Style.Dark });
}

// ─── Keyboard ───────────────────────────────────────────────────

/**
 * Register keyboard show/hide listeners. Returns an unsubscribe function.
 */
export function onKeyboardChange(
  callback: (visible: boolean, height: number) => void
): () => void {
  if (!isNative) return () => {};

  let showListener: { remove: () => void } | null = null;
  let hideListener: { remove: () => void } | null = null;

  import("@capacitor/keyboard").then(({ Keyboard }) => {
    Keyboard.addListener("keyboardWillShow", (info) => {
      callback(true, info.keyboardHeight);
    }).then((l) => {
      showListener = l;
    });
    Keyboard.addListener("keyboardWillHide", () => {
      callback(false, 0);
    }).then((l) => {
      hideListener = l;
    });
  });

  return () => {
    showListener?.remove();
    hideListener?.remove();
  };
}

// ─── App Lifecycle ──────────────────────────────────────────────

/**
 * Listen for app state changes (foreground/background).
 * Returns an unsubscribe function.
 */
export function onAppStateChange(
  callback: (isActive: boolean) => void
): () => void {
  if (!isNative) return () => {};

  let listener: { remove: () => void } | null = null;

  import("@capacitor/app").then(({ App }) => {
    App.addListener("appStateChange", (state) => {
      callback(state.isActive);
    }).then((l) => {
      listener = l;
    });
  });

  return () => {
    listener?.remove();
  };
}

// ─── Safe Area / Viewport ───────────────────────────────────────

/**
 * Apply CSS custom properties for safe area insets.
 * Call once at app startup when running natively.
 */
export function applySafeAreaInsets(): void {
  if (!isNative) return;

  // These are standard env() values that Capacitor's WebView supports
  const style = document.documentElement.style;
  style.setProperty(
    "--safe-area-top",
    "env(safe-area-inset-top, 0px)"
  );
  style.setProperty(
    "--safe-area-bottom",
    "env(safe-area-inset-bottom, 0px)"
  );
  style.setProperty(
    "--safe-area-left",
    "env(safe-area-inset-left, 0px)"
  );
  style.setProperty(
    "--safe-area-right",
    "env(safe-area-inset-right, 0px)"
  );
}

// ─── Native File Save & Share ──────────────────────────────────

/**
 * Save a blob to the device and share it via the native share sheet.
 * On web, falls back to a browser download triggered via a temporary link.
 *
 * @returns A function that re-shares/downloads the file on subsequent calls.
 */
export async function saveAndShareFile(
  blob: Blob,
  filename: string,
  title: string = filename
): Promise<() => void> {
  if (isNative) {
    // Write to app data directory then share via native intent
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    // Convert blob to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Strip data: prefix
        const base64Data = result.split(",")[1] ?? result;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });

    const { Share } = await import("@capacitor/share");
    const uriResult = await Filesystem.getUri({
      path: filename,
      directory: Directory.Cache,
    });

    const doShare = async () => {
      await Share.share({
        title,
        url: uriResult.uri,
        dialogTitle: title,
      });
    };

    await doShare();
    return doShare;
  }

  // Web fallback: create blob URL and trigger download
  const url = URL.createObjectURL(blob);
  const trigger = () => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  trigger();
  return () => trigger();
}
