"use client";

import { useEffect } from "react";

/**
 * Client component that initializes Capacitor native features.
 * Runs once on mount — applies safe area insets and sets up
 * back button handling on Android.
 */
export function CapacitorInit() {
  useEffect(() => {
    let backButtonHandle: { remove: () => Promise<void> } | null = null;

    // Dynamic import to avoid SSR issues
    import("@capacitor/core").then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;

      // Apply safe area CSS custom properties
      import("@/lib/capacitor").then(({ applySafeAreaInsets }) => {
        applySafeAreaInsets();
      });

      // Hide splash screen after a short delay
      import("@capacitor/splash-screen").then(({ SplashScreen }) => {
        SplashScreen.hide({ fadeOutDuration: 300 });
      });

      // Set status bar style based on theme
      import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
        const isDark = document.documentElement.classList.contains("dark");
        StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
        StatusBar.setBackgroundColor({
          color: isDark ? "#1a1a2e" : "#ffffff",
        });
      });

      // Android back button handling — close any open overlay first
      // (dialog / sheet / popover / dropdown), THEN fall back to navigating
      // browser history. Without this, hardware back jumps the user out of
      // the current page entirely (e.g. Stats → /cellar) because Radix
      // overlays don't push a history entry — the back button bypasses
      // the overlay and pops the actual page stack.
      import("@capacitor/app").then(({ App }) => {
        App.addListener("backButton", ({ canGoBack }) => {
          // Look for any Radix/shadcn overlay rendered in the document.
          // Radix portals all of these to <body> with `data-state="open"`.
          const openOverlay = document.querySelector(
            '[data-state="open"][role="dialog"], ' +
            '[data-state="open"][role="alertdialog"], ' +
            '[data-state="open"][data-radix-popper-content-wrapper], ' +
            '[data-state="open"][data-radix-menu-content], ' +
            '[data-state="open"][data-radix-popover-content], ' +
            '[data-state="open"][data-radix-dropdown-menu-content]'
          );
          if (openOverlay) {
            // Synthesize Escape so Radix runs its normal close path
            // (focus restore, animation, onOpenChange callbacks).
            const ev = new KeyboardEvent("keydown", {
              key: "Escape",
              code: "Escape",
              keyCode: 27,
              which: 27,
              bubbles: true,
              cancelable: true,
            });
            document.dispatchEvent(ev);
            return;
          }
          if (canGoBack) {
            window.history.back();
          } else {
            App.exitApp();
          }
        }).then((handle) => {
          backButtonHandle = handle;
        });
      });
    });

    return () => {
      // Clean up the Capacitor back button listener to prevent memory leaks
      if (backButtonHandle) {
        backButtonHandle.remove();
      }
    };
  }, []);

  // This component renders nothing — it's purely for side effects
  return null;
}
