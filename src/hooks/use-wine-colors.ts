import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { WINE_TYPE_TEXT_COLORS } from "@/types/constants";
import type { WineType } from "@/types/wine";

/**
 * useSyncExternalStore-based "mounted" flag. Returns false during SSR
 * and before hydration, true thereafter — without triggering a setState
 * inside useEffect (which React 19 flags as cascading-render perf).
 */
function useIsMounted(): boolean {
  return useSyncExternalStore(
    // no-op subscribe: the server snapshot never changes, client snapshot is fixed after hydration
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Returns the theme-appropriate text color for a wine type.
 * Falls back to "light" during SSR / before mount.
 */
export function useWineTextColor(type: string): string {
  const { resolvedTheme } = useTheme();
  const mounted = useIsMounted();

  const mode = mounted && resolvedTheme === "dark" ? "dark" : "light";
  const entry = WINE_TYPE_TEXT_COLORS[type as WineType];
  return entry ? entry[mode] : "#888";
}

/**
 * Returns all text colors for the current theme.
 */
export function useWineTextColors(): Record<WineType, string> {
  const { resolvedTheme } = useTheme();
  const mounted = useIsMounted();

  const mode = mounted && resolvedTheme === "dark" ? "dark" : "light";

  const result = {} as Record<WineType, string>;
  for (const [key, val] of Object.entries(WINE_TYPE_TEXT_COLORS)) {
    result[key as WineType] = val[mode];
  }
  return result;
}
