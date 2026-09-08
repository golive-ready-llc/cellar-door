// Firebase client-side configuration
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type Auth,
  type UserCredential,
  type User as FirebaseUser,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";

const DEBUG_AUTH = process.env.NEXT_PUBLIC_DEBUG_AUTH === "true";
const authLog = (...args: unknown[]) => {
  if (DEBUG_AUTH) console.log("[auth]", ...args);
};

/**
 * Pre-warm the native @capacitor-firebase/authentication plugin on app
 * mount. The first invocation of the plugin lazy-loads the platform's
 * Google Sign-In SDK, which on a fresh APK install can take long enough
 * that a user-initiated `signInWithGoogle()` tap fires before the SDK is
 * ready and either no-ops or throws a transient "plugin not ready" error.
 * Calling `getCurrentUser()` here forces the plugin to initialize while
 * the login screen is still painting, eliminating that race.
 *
 * Safe to call on web — it short-circuits via Capacitor.isNativePlatform().
 * Errors are swallowed: warm-up is a best-effort optimization.
 */
let _warmupPromise: Promise<void> | null = null;
export function prewarmNativeAuth(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  if (_warmupPromise) return _warmupPromise;
  _warmupPromise = (async () => {
    try {
      authLog("prewarm: importing native plugin");
      const { FirebaseAuthentication } = await import(
        "@capacitor-firebase/authentication"
      );
      authLog("prewarm: calling getCurrentUser to init Google SDK");
      await FirebaseAuthentication.getCurrentUser();
      authLog("prewarm: complete");
    } catch (err) {
      authLog("prewarm: failed (non-fatal)", err);
    }
  })();
  return _warmupPromise;
}

/** Errors that mean "tap again, it'll probably work" rather than a real failure. */
function isTransientNativeAuthError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null | undefined;
  if (!e) return false;
  const msg = (e.message || "").toLowerCase();
  const code = (e.code || "").toLowerCase();
  // Plugin not yet warmed up, network blip on cold launch, or the
  // native SDK returned an empty result without throwing a structured
  // error. We exclude `cancel`/`closed`/`dismiss` so user-aborts still
  // surface as cancellations (no toast) upstream.
  if (/cancel|closed|dismiss/.test(msg)) return false;
  return (
    code === "invalid_account" ||
    code === "auth/internal-error" ||
    code === "auth/network-request-failed" ||
    /not ready|not initialized|no credential|sign[- ]?in failed|google play services/.test(
      msg
    )
  );
}

/**
 * Same-origin auth helper (root fix for the Google sign-in loop on privacy-
 * hardened browsers: LibreWolf, Brave strict, Firefox strict ETP, Safari ITP).
 *
 * By default Firebase serves its auth iframe/popup helper from
 * <project>.firebaseapp.com — a THIRD-PARTY origin whose storage and
 * postMessage those browsers block, so sign-in succeeds but the session
 * handshake fails and onAuthStateChanged later reports null (bounce to
 * /login). With this enabled, authDomain becomes OUR host and next.config's
 * /__/* rewrite proxies the helper from our origin — no third-party context.
 *
 * Rollout-gated by NEXT_PUBLIC_AUTH_SAME_ORIGIN=true because it needs a
 * one-time Google Cloud Console step first: the OAuth web client must list
 * https://mycellardoor.app/__/auth/handler as an authorized redirect URI.
 * Localhost and preview hosts stay on the default helper (their hosts
 * aren't registered redirect URIs).
 */
function resolveAuthDomain(): string | undefined {
  const remote = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  if (process.env.NEXT_PUBLIC_AUTH_SAME_ORIGIN !== "true") return remote;
  if (typeof window === "undefined") return remote;
  const host = window.location.host;
  if (host !== "mycellardoor.app" && !host.endsWith(".mycellardoor.app")) {
    return remote;
  }
  return host;
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True when Firebase API key is configured */
export const isFirebaseConfigured = !!firebaseConfig.apiKey;

// Lazy initialization to avoid SSR issues
let _app: FirebaseApp | undefined;
let _auth: Auth | undefined;
let _googleProvider: GoogleAuthProvider | undefined;

function getApp(): FirebaseApp {
  if (!_app) {
    // authDomain resolved lazily (not in the module-scope config) so the
    // same-origin switch can read window.location in the browser.
    const config = { ...firebaseConfig, authDomain: resolveAuthDomain() };
    _app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
  }
  return _app;
}

function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured) return null;
  if (!_auth) {
    _auth = getAuth(getApp());
  }
  return _auth;
}

function getGoogleProvider(): GoogleAuthProvider {
  if (!_googleProvider) {
    _googleProvider = new GoogleAuthProvider();
  }
  return _googleProvider;
}

/**
 * Cross-platform Google Sign-In.
 *
 * On web: uses Firebase's standard `signInWithPopup`.
 *
 * On native (Capacitor Android/iOS): Google blocks OAuth inside Android
 * WebViews since 2021 to prevent phishing — `signInWithPopup` opens a
 * blank consent page that never resolves. Instead we use the
 * @capacitor-firebase/authentication plugin, which calls the platform's
 * native Google Sign-In SDK and returns a credential we feed back into
 * the Firebase JS SDK via `signInWithCredential`. The result is the
 * same `UserCredential` shape so callers don't need to branch.
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) throw new Error("Firebase not configured");

  // Use Capacitor.isNativePlatform() directly from @capacitor/core rather
  // than reading window.Capacitor — on cold APK launch the global may not
  // be populated yet, causing native users to fall through to popup auth
  // (which Google blocks in WebView, producing a blank-page hang).
  const isNative = Capacitor.isNativePlatform();
  authLog("signInWithGoogle: start", { isNative });

  if (isNative) {
    // If the user tapped Sign In before the on-mount warm-up resolved,
    // await the in-flight warm-up so the native Google SDK is ready
    // before we ask it to open the picker. This is the single biggest
    // contributor to "first tap fails, second tap succeeds" on a fresh
    // tablet APK install.
    if (_warmupPromise) {
      authLog("signInWithGoogle: awaiting in-flight warmup");
      await _warmupPromise;
    } else {
      // Warm-up was never kicked off (e.g. provider mounted late) —
      // do it inline so the very first tap still benefits.
      authLog("signInWithGoogle: warmup not started, warming inline");
      await prewarmNativeAuth();
    }

    // Dynamic import keeps the plugin out of the web bundle entirely.
    const { FirebaseAuthentication } = await import(
      "@capacitor-firebase/authentication"
    );

    // One transparent retry for transient cold-start errors. The retry
    // is bounded (single attempt, no recursion) and only fires for
    // errors we've classified as "needs another tap" — user-cancels
    // still bubble straight through.
    const callNative = () => FirebaseAuthentication.signInWithGoogle();
    let result;
    try {
      authLog("signInWithGoogle: calling native plugin (attempt 1)");
      result = await callNative();
    } catch (err) {
      if (isTransientNativeAuthError(err)) {
        authLog("signInWithGoogle: transient error, retrying once", err);
        result = await callNative();
      } else {
        throw err;
      }
    }

    if (!result.credential?.idToken) {
      // Empty-credential is the textbook "plugin not warm yet" failure
      // shape — retry exactly once before giving up.
      authLog("signInWithGoogle: empty credential, retrying once");
      result = await callNative();
      if (!result.credential?.idToken) {
        throw new Error("Google Sign-In returned no credential");
      }
    }
    authLog("signInWithGoogle: native credential received");
    const credential = GoogleAuthProvider.credential(
      result.credential.idToken,
      // accessToken is also available; including it lets the JS SDK
      // hold a token for any future authorized API calls.
      result.credential.accessToken ?? undefined
    );
    const userCred = await signInWithCredential(firebaseAuth, credential);
    authLog("signInWithGoogle: signInWithCredential resolved");
    return userCred;
  }

  return signInWithPopup(firebaseAuth, getGoogleProvider());
}

// Export getters instead of direct references for lazy init
export {
  getFirebaseAuth as auth,
  getGoogleProvider as googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  firebaseSignOut,
  onAuthStateChanged,
};
export type { FirebaseUser };
