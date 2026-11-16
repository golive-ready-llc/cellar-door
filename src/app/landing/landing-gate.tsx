"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

/**
 * The landing's only auth-aware piece. The server render and every crawler
 * see the full marketing tree (useAuth is loading/null there); only a
 * RESOLVED signed-in user gets the redirect shell — rendering a "Loading..."
 * shell for the whole server render is what got the site read as an empty
 * page by AdSense's reviewer (2026-09-21), so the children must render while
 * auth is still loading.
 */
export function LandingGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Clear demo cookie when visiting the landing page (exiting demo)
  useEffect(() => {
    if (typeof document !== "undefined" && document.cookie.includes("demo_mode=true")) {
      document.cookie = "demo_mode=; path=/; max-age=0";
      window.location.reload(); // reload to clear demo state from auth provider
    }
  }, []);

  // Authenticated real users (not demo) go straight to the app
  useEffect(() => {
    if (!loading && user) {
      router.push("/cellar");
    }
  }, [user, loading, router]);

  // Capacitor / native app users skip the marketing landing entirely.
  // The landing page is for prospects deciding whether to install —
  // once they're inside the native shell, send them to a brief mobile
  // welcome screen with Sign In / Sign Up CTAs (real users) or
  // straight to /cellar (signed-in users — handled by the auth-aware
  // effect above).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.() && !loading && !user) {
      router.push("/welcome");
    }
  }, [loading, user, router]);

  if (user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
