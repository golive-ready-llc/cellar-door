"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { JUST_SIGNED_IN_TTL_MS, isJustSignedIn, clearJustSignedIn } from "@/lib/auth-handoff";
import { AppSidebar } from "@/components/app-sidebar";
// ThemeToggle removed from header — only available in Settings
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppLoading } from "@/components/app-loading";
import { CellarChatWrapper } from "@/components/chat/cellar-chat-wrapper";
import { AdSlot } from "@/components/tier/ad-slot";
import { BottomNav } from "@/components/bottom-nav";
import { TierSwitcher } from "@/components/tier/tier-switcher";
import { QueryProvider } from "@/components/query-provider";
import { AddWineProvider } from "@/components/add-wine-context";
import { WineDataProvider } from "@/contexts/wine-data-context";
import { NotificationsBootstrap } from "@/components/notifications-bootstrap";
import { HeaderAddWine } from "@/components/floating-add-wine";
import { FloatingCameraFab } from "@/components/floating-camera-fab";
import { SearchProvider } from "@/components/search/search-provider";
import { SearchCommandPalette } from "@/components/search/search-command-palette";
import { SearchTriggerButton } from "@/components/search/search-trigger-button";
import { Toaster } from "@/components/ui/sonner";
import { DemoBanner } from "@/components/demo-banner";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, devMode } = useAuth();
  const router = useRouter();

  // Just-signed-in handoff marker. Set by login/signup before router.push,
  // honored here so we don't bounce the user back to /login while Firebase
  // catches up on Firefox (where the postMessage handshake can be slow or
  // outright fail due to tracking protection). Lives in component state
  // so the render path sees the same value the effect saw, and we can
  // clear it once auth confirms.
  const [handoff, setHandoff] = useState(false);
  useEffect(() => {
    setHandoff(isJustSignedIn());
  }, []);

  // Clear the handoff marker once auth is confirmed for this user.
  // Keep it set while loading or while user is still resolving — only
  // clear when we have a confirmed authenticated user.
  useEffect(() => {
    if (!loading && user) {
      clearJustSignedIn();
      setHandoff(false);
    }
  }, [user, loading]);

  // After TTL, if we never resolved a user, clear the handoff so the
  // (!user) redirect can finally fire. This prevents the page from
  // hanging on a skeleton forever if Firebase truly never recovers.
  useEffect(() => {
    if (!handoff) return;
    const t = setTimeout(() => setHandoff(false), JUST_SIGNED_IN_TTL_MS);
    return () => clearTimeout(t);
  }, [handoff]);

  useEffect(() => {
    if (loading) return;
    // Email-verified guard: instant — verified status doesn't flicker.
    if (user && !user.emailVerified) {
      router.push("/verify-email");
      return;
    }
    // Sign-out detection: skip during the post-signin handoff window.
    // On Firefox, Firebase's onAuthStateChanged can take >2s to fire
    // (or not fire at all on first attempt) due to tracking protection
    // blocking the auth iframe's postMessage. Without this guard, the
    // user gets bounced back to /login despite a successful Google
    // sign-in. The handoff state was set by the login/signup page
    // immediately before router.push("/cellar").
    if (!user && !devMode && !handoff) {
      const t = setTimeout(() => {
        router.push("/login");
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [user, loading, devMode, router, handoff]);

  // Show loading skeleton while checking auth OR during sign-in handoff.
  // The handoff branch is what saves Firefox: even if user is null because
  // onAuthStateChanged hasn't fired yet, we show the skeleton (not the
  // login redirect) until the listener catches up or the TTL expires.
  if (loading || (handoff && !user && !devMode)) {
    return <AppLoading stage="Signing you in…" phase={1} fullscreen />;
  }

  // Don't render anything if not authenticated (will redirect) — unless dev mode
  if (!user && !devMode) {
    return null;
  }

  // Don't render if email not verified (will redirect to /verify-email)
  if (user && !user.emailVerified) {
    return null;
  }

  return (
    <QueryProvider>
    <WineDataProvider>
    <NotificationsBootstrap />
    <AddWineProvider>
      <SearchProvider>
      <SidebarProvider>
        {/* Sidebar only visible on md+ */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <SidebarInset>
          {/* Demo-mode banner — sits above the header so it spans the full
              right-side column (not squeezed by the sidebar flex row). */}
          <DemoBanner />
          {/* h-14 + safe-area-inset-top so the title clears the Android/iOS
              status bar on native (Capacitor draws under it). On web the
              env() value resolves to 0 and the header keeps its 3.5rem height. */}
          <header
            className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b px-4"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <SidebarTrigger className="-ml-1 hidden md:flex" />
            <Separator orientation="vertical" className="mr-2 h-4 hidden md:block" />
            {/* Mobile: show app logo + title — links to landing page if not signed in */}
            <Link href="/" className="flex items-center gap-2 md:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-small.png" alt="Cellar Door" className="h-8 w-auto rounded" />
              <span className="text-lg font-bold whitespace-nowrap shrink-0">Cellar Door</span>
            </Link>
            <div className="flex-1" />
            <SearchTriggerButton />
            {/* Settings moved up here from the bottom nav — its old slot now
                holds the red Add (camera) button. Desktop keeps Settings in
                the sidebar user menu, so this gear is mobile-only. */}
            <Link
              href="/settings"
              className="md:hidden flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Settings"
            >
              <SettingsIcon className="h-5 w-5" />
            </Link>
            <TierSwitcher />
            <HeaderAddWine />
          </header>
          <main className="flex-1 overflow-auto p-4 pb-20 md:pb-4">
            <AdSlot location="banner" className="mb-4" />
            {children}
          </main>
        </SidebarInset>
        {/* Bottom nav for mobile */}
        <BottomNav />
        <CellarChatWrapper />
        <FloatingCameraFab />
        <SearchCommandPalette />
        <Toaster />
      </SidebarProvider>
      </SearchProvider>
    </AddWineProvider>
    </WineDataProvider>
    </QueryProvider>
  );
}
