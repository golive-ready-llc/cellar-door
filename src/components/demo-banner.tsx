"use client";

import { useEffect, useState } from "react";
import { Eye, X } from "lucide-react";

/**
 * Client-side banner shown at the very top of any authenticated page when
 * the `demo_mode=true` cookie is set. Provides a one-click exit that
 * clears the cookie and returns the visitor to the landing page.
 *
 * Intentionally rendered as plain HTML with no Tailwind theme variables
 * (hard-coded amber) so it always stands out, even on partially-broken
 * demo states.
 */
export function DemoBanner() {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const hasCookie = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith("demo_mode=true"));
    setIsDemo(hasCookie);
  }, []);

  if (!isDemo) return null;

  const exitDemo = () => {
    document.cookie = "demo_mode=; path=/; max-age=0; SameSite=Lax";
    // Full reload so the server-side auth state also resets, then land on
    // the public marketing page rather than an authenticated app route.
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
