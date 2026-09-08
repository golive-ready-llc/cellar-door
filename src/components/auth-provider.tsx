"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  auth,
  isFirebaseConfigured,
  onAuthStateChanged,
  prewarmNativeAuth,
  type FirebaseUser,
} from "@/lib/firebase";
import type { Tier } from "@/lib/tier";

const DEBUG_AUTH = process.env.NEXT_PUBLIC_DEBUG_AUTH === "true";
const authLog = (...args: unknown[]) => {
  if (DEBUG_AUTH) console.log("[auth]", ...args);
};

/**
 * Minimum tier override.
 * Set NEXT_PUBLIC_DEFAULT_TIER=PREMIUM on Vercel to unlock all features
 * for every user (acts as a floor — DB tier is used only if it's higher).
 */
import { isSingleUserMode } from "@/lib/single-user";

const DEFAULT_TIER: Tier =
  (process.env.NEXT_PUBLIC_DEFAULT_TIER as Tier) || "FREE";

/** Tier rank for comparison (higher = more features) */
const TIER_RANK: Record<Tier, number> = { FREE: 0, PRO: 1, PREMIUM: 2 };

/** Return the higher of two tiers */
function maxTier(a: Tier, b: Tier): Tier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  /** True when Firebase is not configured (dev mode) */
  devMode: boolean;
  /** The Firebase ID token for API calls */
  getIdToken: () => Promise<string | null>;
  /** Current user's subscription tier */
  tier: Tier;
  /** Prisma user ID (for passing to server actions) */
  userId: string | null;
  /** Re-fetch tier from server (e.g. after Stripe checkout) */
  refreshTier: () => Promise<void>;
  /** Set tier manually (dev mode only) */
  setTier?: (tier: Tier) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  devMode: false,
  getIdToken: async () => null,
  tier: DEFAULT_TIER,
  userId: null,
  refreshTier: async () => {},
});

/** Check if demo_mode cookie is set (client-side) */
function isDemoMode(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith("demo_mode=true"));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize from Firebase's synchronous currentUser. After
  // signInWithPopup resolves, Firebase sets currentUser immediately —
  // FASTER than onAuthStateChanged fires its listeners. If (app)/layout
  // mounts during that gap (e.g. login page just called router.push),
  // useState(null) would make the layout see user=null and start the
  // sign-out debounce. Reading currentUser here closes that race so the
  // layout sees the authenticated user on first render.
  const [user, setUser] = useState<FirebaseUser | null>(() => {
    if (typeof window === "undefined") return null;
    if (!isFirebaseConfigured) return null;
    try {
      return auth()?.currentUser ?? null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<Tier>(DEFAULT_TIER);
  const [userId, setUserId] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const devMode = !isFirebaseConfigured || demoMode;

  useEffect(() => {
    // Kick off native Google Sign-In SDK warm-up the moment the auth
    // provider mounts. On Capacitor Android/iOS this initializes the
    // @capacitor-firebase/authentication plugin so the very first
    // user tap on "Continue with Google" doesn't race the lazy-load.
    // No-op on web. Errors are swallowed inside prewarmNativeAuth.
    authLog("provider mount: kicking off native auth warmup");
    void prewarmNativeAuth();

    // Single-user mode — self-hosted, no authentication. Resolve the implicit
    // local owner's real Prisma id so writes have a valid FK. Checked before
    // demo mode because it is a deployment-level setting.
    if (isSingleUserMode()) {
      let cancelled = false;
      (async () => {
        try {
          const { getSingleUserProfile } = await import(
            "@/server/actions/auth"
          );
          const profile = await getSingleUserProfile();
          if (cancelled) return;
          if (profile) {
            setUserId(profile.id);
            setTier(maxTier(profile.tier as Tier, DEFAULT_TIER));
          } else {
            // Most likely the database is unreachable. Leave userId null so
            // the app shows its normal "no data" state rather than pretending
            // to be signed in with an id that has no row behind it.
            authLog("single-user profile unavailable");
            setTier(DEFAULT_TIER);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    // Check for demo mode cookie
    if (isDemoMode()) {
      setDemoMode(true);
      setUserId("demo-user-001");
      setTier("PREMIUM");
      setLoading(false);
      return;
    }

    // If Firebase is not configured, skip auth and go straight to "loaded" state
    if (!isFirebaseConfigured) {
      // Dev mode defaults
      setUserId("dev-user-001");
      setTier(DEFAULT_TIER);
      setLoading(false);
      return;
    }

    const firebaseAuth = auth();
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }

    // Handle redirect-based sign-in (Firefox, some Safari configurations)
    // ONLY if there isn't already a current user. If signInWithPopup
    // just succeeded, Firebase already has currentUser set and calling
    // getRedirectResult can disrupt that state in edge cases. We only
    // need the redirect-completion path when we genuinely arrived from
    // a redirect and have no current user.
    let cancelled = false;

    if (!firebaseAuth.currentUser) {
      (async () => {
        try {
          const { getRedirectResult } = await import("firebase/auth");
          if (cancelled) return;
          const result = await getRedirectResult(firebaseAuth);
          if (result && !cancelled) {
            authLog("getRedirectResult resolved with credential");
          }
        } catch (err) {
          if (!cancelled) {
            authLog("getRedirectResult error (non-fatal)", err);
          }
        }
      })();
    }

    // Diagnostic: count auth state events so we can spot transient
    // double-fire (user → null → user) when investigating auth flakes.
    // Gated behind NEXT_PUBLIC_DEBUG_AUTH=true now that the bounce-to-
    // /login bug is fixed via the 500ms debounce in (app)/layout.tsx.
    let _authEventSeq = 0;

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      const seq = ++_authEventSeq;
      authLog(
        `onAuthStateChanged #${seq}: user=${firebaseUser?.email ?? "null"}`
      );
      setUser(firebaseUser);

      if (firebaseUser) {
        // Fetch tier from server after auth. Retry up to 3 times with
        // small backoff — verifyIdToken in syncUser already succeeded
        // for this token, but a cold Firebase Admin SDK on a different
        // serverless instance can transiently fail (Google JWKS fetch,
        // network blip, clock skew). Without retry, a flake here leaves
        // userId=null, loading=false, and the cellar renders blank
        // even though the user is signed in. The retry adds at most
        // ~750ms in the worst case but eliminates the blank-cellar flash.
        let profile: { id: string; tier: string } | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const token = await firebaseUser.getIdToken();
            const { getUserProfile } = await import(
              "@/server/actions/auth"
            );
            profile = await getUserProfile(token);
            if (profile) break;
          } catch (err) {
            authLog(`getUserProfile attempt ${attempt + 1} failed`, err);
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
            }
          }
        }
        if (profile) {
          setUserId(profile.id);
          // Use whichever is higher: DB tier or env var override
          setTier(maxTier(profile.tier as Tier, DEFAULT_TIER));
        } else {
          authLog("getUserProfile failed after 3 attempts — userId stays null");
          setTier(DEFAULT_TIER);
          setUserId(null);
        }
      } else {
        // Signed out — use default tier (allows password-gated sites to still access features)
        setTier(DEFAULT_TIER);
        setUserId(null);
      }

      setLoading(false);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const getIdToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

  const refreshTier = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const { getUserProfile } = await import("@/server/actions/auth");
      const profile = await getUserProfile(token);
      if (profile) {
        setUserId(profile.id);
        setTier(maxTier(profile.tier as Tier, DEFAULT_TIER));
      }
    } catch {
      // Silently fail — tier stays as-is
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        devMode,
        getIdToken,
        refreshTier,
        tier,
        userId,
        ...(devMode ? { setTier } : {}),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
