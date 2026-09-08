// Firebase Admin SDK — server-side only
import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

function getFirebaseAdminApp(): App | null {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    // Dev mode — Firebase not configured
    return null;
  }

  // In production, use service account JSON
  // In dev, use FIREBASE_ADMIN_* env vars
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  let serviceAccount: Record<string, unknown> | null = null;

  if (serviceAccountKey) {
    try {
      serviceAccount = JSON.parse(serviceAccountKey);
    } catch {
      // Malformed JSON — fall through to individual env vars
      serviceAccount = null;
    }
  }

  if (!serviceAccount) {
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
      /\\n/g,
      "\n"
    );
    if (clientEmail && privateKey) {
      serviceAccount = { projectId, clientEmail, privateKey };
    }
  }

  if (!serviceAccount) {
    throw new Error(
      "Firebase Admin credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY " +
      "(JSON string) or individual FIREBASE_ADMIN_CLIENT_EMAIL + " +
      "FIREBASE_ADMIN_PRIVATE_KEY env vars."
    );
  }

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

let _adminAuth: Auth | null = null;

/** Lazy getter — returns null when Firebase is not configured (dev mode) */
export function getAdminAuth(): Auth | null {
  if (_adminAuth) return _adminAuth;
  const app = getFirebaseAdminApp();
  if (!app) return null;
  _adminAuth = getAuth(app);
  return _adminAuth;
}

/**
 * @deprecated Use getAdminAuth() instead — this throws in dev mode.
 * Kept temporarily for backward compatibility.
 */
export const adminAuth = new Proxy({} as Auth, {
  get(_, prop) {
    const auth = getAdminAuth();
    if (!auth) throw new Error("Firebase Admin not configured (dev mode)");
    return (auth as unknown as Record<string | symbol, unknown>)[prop];
  },
});
