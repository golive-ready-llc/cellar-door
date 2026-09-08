"use client";

import { useEffect, useState } from "react";

/**
 * Hook that initializes Capacitor native features on mount.
 * Returns platform info for conditional rendering.
 */
export function useCapacitor() {
  const [ready, setReady] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios" | "web">("web");
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    // Dynamic import so Capacitor doesn't break SSR
    import("@capacitor/core")
      .then(({ Capacitor }) => {
        const p = Capacitor.getPlatform() as "android" | "ios" | "web";
        setPlatform(p);
        setIsNative(Capacitor.isNativePlatform());
        setReady(true);

        // Apply safe area insets when native
        if (Capacitor.isNativePlatform()) {
          import("@/lib/capacitor")
            .then(({ applySafeAreaInsets }) => {
              applySafeAreaInsets();
            })
            .catch((err) => {
              console.error(
                "[useCapacitor] Failed to load capacitor utils:",
                err
              );
            });
        }
      })
      .catch((err) => {
        console.error("[useCapacitor] Failed to load @capacitor/core:", err);
        // Still mark as ready so UI doesn't hang
        setReady(true);
      });
  }, []);

  return { ready, platform, isNative };
}
