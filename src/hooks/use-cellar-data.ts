"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  fetchWines,
  fetchCabinets,
  fetchWalls,
  fetchCellarSettings,
  saveCellarSettings,
} from "@/lib/data";
import { useAuth } from "@/components/auth-provider";
import {
  collectAllTags,
  collectLocations,
  filterUnfiledWines,
  calcCellarStats,
} from "@/lib/cellar-utils";
import type { Wine, Wall, Cabinet, WineType } from "@/types/wine";

// Where older versions kept the cellar name and the first-run setup flag, in
// this browser only. Both now live on the account; values found here are
// copied up once and then removed.
const LEGACY_CELLAR_NAME_KEY = "cellar-door-cellar-name";
const LEGACY_ONBOARDED_KEY = "cellar-door-onboarded";

// Module-level: capture deep-link wine ID before React renders (survives Strict Mode)
let __pendingDeepLinkWineId: string | null = null;
let __deepLinkProcessed = false;
if (typeof window !== "undefined") {
  const params = new URLSearchParams(window.location.search);
  __pendingDeepLinkWineId = params.get("wine");
}

export function useCellarData() {
  const [wines, setWines] = useState<Wine[]>([]);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<WineType | "all">("all");
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [highlightedWineId, setHighlightedWineId] = useState<string | null>(
    __pendingDeepLinkWineId
  );
  // An empty slot to glow gold (sort assistant "put a bottle here" destination).
  const [highlightedSlot, setHighlightedSlot] = useState<
    import("@/components/cellar/cabinet-grid-types").HighlightSlot | null
  >(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user, devMode, demoMode, userId } = useAuth();
  const searchParams = useSearchParams();
  const wineIdFromUrl = searchParams.get("wine");

  // Cellar name and first-run setup flag: stored on the account, so they
  // follow the owner to every device instead of living in one browser.
  const defaultName = useMemo(() => {
    const displayName = user?.displayName || (devMode ? "Dev User" : "");
    const firstName = displayName.split(" ")[0];
    return firstName ? `${firstName}'s Cellar` : "My Cellar";
  }, [user, devMode]);

  const [cellarName, setCellarName] = useState<string>("");
  // null until the account's setting has loaded, so setup never flashes.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    if (!userId && !devMode) return;
    let cancelled = false;
    (async () => {
      try {
        let settings = await fetchCellarSettings(userId);
        // Copy values an older version saved in this browser up to the
        // account, once, so nobody loses a name they had already set.
        const legacyName = localStorage.getItem(LEGACY_CELLAR_NAME_KEY) || "";
        const legacyOnboarded = localStorage.getItem(LEGACY_ONBOARDED_KEY) === "true";
        const copyName = !settings.cellarName && legacyName ? legacyName : "";
        const copyOnboarded = !settings.onboarded && legacyOnboarded;
        if (!demoMode && (copyName || copyOnboarded)) {
          settings = await saveCellarSettings(
            {
              ...(copyOnboarded ? { onboarded: true } : {}),
              ...(copyName ? { cellarName: copyName } : {}),
            },
            userId
          );
          localStorage.removeItem(LEGACY_CELLAR_NAME_KEY);
          localStorage.removeItem(LEGACY_ONBOARDED_KEY);
        }
        if (cancelled) return;
        setCellarName(settings.cellarName);
        setOnboarded(settings.onboarded);
      } catch {
        // The name is cosmetic: keep the default, and don't push first-run
        // setup on someone whose settings merely failed to load.
        if (!cancelled) setOnboarded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, devMode, demoMode]);

  const displayName = cellarName || defaultName;

  const handleNameSave = useCallback(
    (newName: string) => {
      const trimmed = newName.trim();
      const next = trimmed && trimmed !== defaultName ? trimmed : "";
      setCellarName(next);
      setEditingName(false);
      void saveCellarSettings({ cellarName: next }, userId).catch(() => {
        // Keep the new name on screen; the next rename saves again.
      });
    },
    [defaultName, userId]
  );

  // Record first-run setup as done on the account, with the name chosen in
  // the wizard (empty keeps the default name).
  const completeOnboarding = useCallback(
    async (chosenName: string) => {
      const name = chosenName.trim();
      setOnboarded(true);
      if (name) setCellarName(name);
      await saveCellarSettings(
        { onboarded: true, ...(name ? { cellarName: name } : {}) },
        userId
      );
    },
    [userId]
  );

  const loadData = useCallback(async () => {
    // Don't fetch with a null userId. If auth-provider hasn't finished
    // resolving the Prisma user row yet, the server actions would
    // either throw (resolveServerUserId requires a userId) or return
    // empty results — both of which produced the "blank cellar flash"
    // bug observed on Firefox after Google sign-in.
    if (!userId && !devMode) return;
    try {
      const [wineData, cabinetData, wallData] = await Promise.all([
        fetchWines(userId),
        fetchCabinets(userId),
        fetchWalls(userId),
      ]);
      setWines(wineData);
      setCabinets(cabinetData);
      setWalls(wallData);
      if (wallData.length > 0) {
        setSelectedWallId((prev) =>
          prev && wallData.find((w) => w.id === prev)
            ? prev
            : wallData[0].id
        );
      }
    } finally {
      setLoading(false);
    }
  }, [userId, devMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Pull-to-refresh must bypass the lib/data read cache — the whole point of
  // the gesture is "give me fresh data".
  const refreshData = useCallback(async () => {
    const { invalidateReadCache } = await import("@/lib/data");
    invalidateReadCache();
    return loadData();
  }, [loadData]);

  // Warm the other tabs' data once the cellar is loaded and the browser is
  // idle — history and buy-list land in the read cache, so switching to those
  // views renders instantly instead of paying a server round trip.
  useEffect(() => {
    if (loading || (!userId && !devMode)) return;
    const idle =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback
        : (cb: () => void) => setTimeout(cb, 1500);
    const handle = idle(() => {
      import("@/lib/data").then(({ fetchHistory, fetchBuyList }) => {
        fetchHistory(userId).catch(() => {});
        fetchBuyList(userId).catch(() => {});
      });
    });
    return () => {
      if (typeof cancelIdleCallback === "function") {
        cancelIdleCallback(handle as number);
      } else {
        clearTimeout(handle as ReturnType<typeof setTimeout>);
      }
    };
  }, [loading, userId, devMode]);

  // Deep-link handling
  useEffect(() => {
    let wineId: string | null = null;
    if (!__deepLinkProcessed && __pendingDeepLinkWineId) {
      wineId = __pendingDeepLinkWineId;
      __deepLinkProcessed = true;
    } else if (wineIdFromUrl) {
      wineId = wineIdFromUrl;
    }

    if (!wineId || loading || wines.length === 0) return;

    const wine = wines.find((w) => w.id === wineId);
    if (wine) {
      if (wine.cabinetId) {
        const cab = cabinets.find((c) => c.id === wine.cabinetId);
        if (cab) setSelectedWallId(cab.wallId);
      }
      // Return info for the caller to open the detail dialog
      deepLinkRef.current = wine;
    }
    window.history.replaceState(null, "", "/cellar");
  }, [loading, wines, cabinets, wineIdFromUrl]);

  // Deep link ref for callers to consume
  const deepLinkRef = useRef<Wine | null>(null);

  const consumeDeepLink = useCallback(() => {
    const wine = deepLinkRef.current;
    deepLinkRef.current = null;
    return wine;
  }, []);

  // Highlight management
  const setHighlightWithTimer = useCallback(
    (wineId: string | null) => {
      setHighlightedWineId(wineId);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (wineId) {
        highlightTimerRef.current = setTimeout(() => {
          setHighlightedWineId(null);
          highlightTimerRef.current = null;
        }, 4000);
      }
    },
    []
  );

  // Persistent highlight for the sort assistant: glow a source bottle AND its
  // destination empty slot, with NO auto-clear timer — they stay lit until the
  // user advances to the next step. Cancels any pending 4s flash timer so a
  // prior add/move flash can't blank these out mid-step.
  const setSortHighlight = useCallback(
    (
      wineId: string | null,
      slot: import("@/components/cellar/cabinet-grid-types").HighlightSlot | null
    ) => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
      setHighlightedWineId(wineId);
      setHighlightedSlot(slot);
    },
    []
  );

  const clearSortHighlight = useCallback(() => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    setHighlightedWineId(null);
    setHighlightedSlot(null);
  }, []);

  // Scroll to wine in cellar
  const scrollToWineInCellar = useCallback(
    (wine: Wine) => {
      if (!wine.cabinetId) return;
      const cab = cabinets.find((c) => c.id === wine.cabinetId);
      if (!cab) return;
      setSelectedWallId(cab.wallId);
      setHighlightWithTimer(wine.id);
      // Track the deferred scroll so it can be cancelled on unmount (quick
      // navigation away) — otherwise it fires on a torn-down view.
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        scrollTimerRef.current = null;
        const el = document.getElementById(`cabinet-${wine.cabinetId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
    },
    [cabinets, setHighlightWithTimer]
  );

  // Cancel any pending highlight/scroll timers on unmount.
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  // Derived data
  const wallCabinets = useMemo(() => {
    if (!selectedWallId) return cabinets;
    return cabinets.filter((c) => c.wallId === selectedWallId);
  }, [cabinets, selectedWallId]);

  const displayWines = useMemo(() => {
    if (selectedType === "all") return wines;
    return wines.filter((w) => w.type === selectedType);
  }, [wines, selectedType]);

  const unfiledWines = useMemo(() => filterUnfiledWines(wines), [wines]);

  const allTags = useMemo(() => collectAllTags(wines), [wines]);

  const locations = useMemo(() => collectLocations(walls), [walls]);

  const locationWalls = useMemo(() => {
    if (selectedLocation === "all" || locations.length <= 1) return walls;
    return walls.filter((w) => (w.location || "Home") === selectedLocation);
  }, [walls, selectedLocation, locations]);

  const stats = useMemo(
    () => calcCellarStats(wines, cabinets),
    [wines, cabinets]
  );

  return {
    // Core state
    wines,
    setWines,
    walls,
    setWalls,
    cabinets,
    setCabinets,
    loading,
    userId,

    // Wall/type selection
    selectedWallId,
    setSelectedWallId,
    selectedType,
    setSelectedType,
    selectedLocation,
    setSelectedLocation,

    // Cellar name and first-run setup
    displayName,
    editingName,
    setEditingName,
    handleNameSave,
    onboarded,
    completeOnboarding,

    // Data loading
    loadData,
    refreshData,

    // Deep link
    consumeDeepLink,

    // Highlight
    highlightedWineId,
    setHighlightWithTimer,
    highlightedSlot,
    setSortHighlight,
    clearSortHighlight,

    // Scroll
    scrollToWineInCellar,

    // Derived data
    wallCabinets,
    displayWines,
    unfiledWines,
    allTags,
    locations,
    locationWalls,
    stats,
  };
}
