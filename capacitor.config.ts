import type { CapacitorConfig } from "@capacitor/cli";

// =============================================================================
// SHIPPING MODES
// -----------------------------------------------------------------------------
// CURRENT (online-only): `server.url` below points the APK/IPA at the
// production web app. Every cold launch loads from the network — no offline
// support. The bundled `webDir` ("out") is unused at runtime.
//
// TO SHIP AN OFFLINE-CAPABLE BUILD:
//   1. Comment out the entire `server` block below (or unset
//      CAPACITOR_SERVER_URL and remove the `url`/`cleartext` lines).
//   2. Run `npm run build` to populate `out/`.
//   3. Run `npx cap sync android` (and/or `ios`) to copy `out/` into the
//      native project as the bundled web assets.
//   4. Rebuild the native app — it will now load from disk and work offline.
//
// SECURITY NOTE: `cleartext` and `allowMixedContent` are gated to dev/CI only.
// In production builds (NODE_ENV=production, CAPACITOR_DEV unset) these are
// FALSE so a hostile network cannot downgrade HTTPS → HTTP and inject scripts
// into the Firebase auth context.
// =============================================================================

const isDev =
  process.env.NODE_ENV === "development" ||
  process.env.CAPACITOR_DEV === "true";

const config: CapacitorConfig = {
  appId: "com.cellardoor.app",
  appName: "Cellar Door",
  webDir: "out",

  // In production, the app loads from the deployed URL (server-rendered Next.js).
  // In development, point to your local dev server.
  // Comment out the `server` block for a fully bundled offline build.
  server: {
    // Production: load from deployed URL
    // Dev: set CAPACITOR_SERVER_URL=http://10.0.2.2:3000 for emulator
    //      or CAPACITOR_SERVER_URL=http://192.168.x.x:3000 for physical device
    // IMPORTANT: this default is intentionally localhost, NOT a production
    // domain. A build that falls back to someone else's server would send
    // all of its users' traffic (and AI/database cost) to that operator.
    // Official builds set CAPACITOR_SERVER_URL explicitly; self-hosters
    // must point this at their own deployment. See SELF-HOSTING.md.
    url: process.env.CAPACITOR_SERVER_URL || "http://localhost:3000",
    // Only allow cleartext HTTP in dev — required for http://10.0.2.2:3000
    // and http://192.168.x.x:3000 dev servers. Off in production builds.
    cleartext: isDev,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#1a1a2e",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1a1a2e",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    Camera: {
      // iOS-specific permissions
      permissions: ["camera", "photos"],
    },
    FirebaseAuthentication: {
      // Native Google Sign-In via @capacitor-firebase/authentication.
      // The plugin reads the Web Client ID from google-services.json
      // for Android (no need to specify here). For iOS, you'd add the
      // GoogleService-Info.plist + reverse client ID URL scheme.
      skipNativeAuth: false,
      providers: ["google.com", "password"],
    },
  },

  android: {
    // Mixed content (HTTP subresources on an HTTPS page) is dev-only. In
    // production this MUST be false to prevent script injection over hostile
    // networks (downgrade attacks against the Firebase auth context).
    allowMixedContent: isDev,
    captureInput: true,
    // WebView debugging is dev-only — leaks app internals over adb in prod.
    webContentsDebuggingEnabled: isDev,
  },

  ios: {
    contentInset: "automatic",
    allowsLinkPreview: false,
    scrollEnabled: false,
  },
};

export default config;
