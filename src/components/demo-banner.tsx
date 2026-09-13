"use client";

import { Eye, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { clearDemoCookie, setDemoModeActive } from "@/lib/demo-state";

/**
 * Banner shown at the very top of any authenticated page while the app is in
 * demo mode. Provides a one-click exit that clears the demo cookie and returns
 * the visitor to the landing page.
 *
 * Follows the AuthProvider's demo state, not the `demo_mode` cookie: a cookie
 * left over from an earlier /demo visit used to show this banner over a
 * signed-in owner's real cellar.
 *
 * Intentionally rendered with hard-coded amber (no Tailwind theme variables)
 * so it always stands out, even on partially-broken demo states.
 */
export function DemoBanner() {
  const { demoMode } = useAuth();

  if (!demoMode) return null;

  const exitDemo = () => {
    clearDemoCookie();
    setDemoModeActive(false);
    // Full reload so the server-side auth state also resets, then land on
    // the public marketing page rather than an authenticated app route.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full page reload resets auth and demo state
    window.location.href = "/";
  };

  return (
    <div
      role="status"
      aria-label="Demo mode"
      className="sticky top-0 z-50 bg-amber-500 text-amber-950 text-xs sm:text-sm px-3 py-1.5 flex items-center justify-center gap-3 shadow"
      style={{ paddingTop: "calc(0.375rem + env(safe-area-inset-top))" }}
    >
      <Eye className="h-3.5 w-3.5 shrink-0" />
      <span>
        <span className="font-bold">Demo mode</span> — this is a read-only
        preview. Sign up to use your own cellar.
      </span>
      <button
        type="button"
        onClick={exitDemo}
        className="shrink-0 inline-flex items-center gap-1 rounded px-2 py-0.5 bg-amber-950/10 hover:bg-amber-950/20 font-semibold"
      >
        <X className="h-3 w-3" /> Exit demo
      </button>
    </div>
  );
}
