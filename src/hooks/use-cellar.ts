"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  fetchWines,
  fetchCabinets,
  fetchWalls,
  fetchCellarSettings,
  saveCellarSettings,
  editWine,
  bulkDeleteWines,
  createCabinet,
  editCabinet,
  removeCabinet,
  createWall,
  editWall,
  removeWall,
} from "@/lib/data";
import { useAuth } from "@/components/auth-provider";
import {
  collectAllTags,
  collectLocations,
  filterUnfiledWines,
  calcCellarStats,
} from "@/lib/cellar-utils";
import { toast } from "@/components/ui/custom-toast";
import {
  addWineAndPrepend,
  buildDuplicateWineInput,
  consumeWineAndSync,
  duplicateWinesAndPrepend,
  editWineAndSync,
} from "@/lib/wine-collection";
import {
  useEditMode,
  generateTempId,
} from "@/components/cellar/edit-mode-context";
import { hapticImpact } from "@/lib/capacitor";
import type { Wine, Wall, Cabinet, WineType, StorageRow, BottleSize, NewWineInput } from "@/types/wine";
import type { HighlightSlot } from "@/components/cellar/cabinet-grid-types";
import type { SectionTemplate } from "@/components/cellar/storage-type-picker";
import type { SectionChanges } from "@/components/cellar/section-settings-dialog";
import type { WallChanges } from "@/components/cellar/wall-settings-dialog";

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

/**
 * The cellar surface's single store: collection state and loading, dialog
 * state, wine actions, and edit/move mode. The sections share one scope, so
 * actions and mode read state directly instead of receiving it through prop
 * interfaces. Consumed by (app)/cellar/page.tsx, which composes the four
 * groups into the page; the memoized grid components must keep receiving
 * plain props, not this object, or every store change re-renders the grid.
 */
export function useCellar() {
  // ── Collection state ────────────────────────────────────────────────
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
  const [highlightedSlot, setHighlightedSlot] = useState<HighlightSlot | null>(
    null
  );
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
  const deepLinkRef = useRef<Wine | null>(null);
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

  const consumeDeepLink = useCallback(() => {
    const wine = deepLinkRef.current;
    deepLinkRef.current = null;
    return wine;
  }, []);

  // Highlight management
  /**
   * Flash a wine in the grid for a few seconds (reuses the deep-link
   * "show in cellar" highlight). Fired after a wine lands in a slot — on add,
   * place, or move — so you can see exactly where the bottle in your hand goes.
   */
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
    (wineId: string | null, slot: HighlightSlot | null) => {
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

  // ── Dialogs ─────────────────────────────────────────────────────────
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [consumeOpen, setConsumeOpen] = useState(false);
  const [wineListScanOpen, setWineListScanOpen] = useState(false);
  const [addWineOpen, setAddWineOpen] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<{
    cabinetId: string;
    row: number;
    col: number;
  } | null>(null);

  // Dialog transition: detail -> consume
  const [pendingConsume, setPendingConsume] = useState(false);
  useEffect(() => {
    if (!detailOpen && pendingConsume) {
      const timer = setTimeout(() => {
        setConsumeOpen(true);
        setPendingConsume(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [detailOpen, pendingConsume]);

  const triggerConsume = useCallback(() => {
    setPendingConsume(true);
    setDetailOpen(false);
  }, []);

  // Dialog transition: add-wine -> wine-list-scan
  // Base UI Dialogs don't stack well — opening a new one while another is
  // closing gets swallowed. Use a pending flag + useEffect to defer the
  // open until after AddWineDialog has fully unmounted.
  const [pendingWineListScan, setPendingWineListScan] = useState(false);
  useEffect(() => {
    if (!addWineOpen && pendingWineListScan) {
      const timer = setTimeout(() => {
        setWineListScanOpen(true);
        setPendingWineListScan(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [addWineOpen, pendingWineListScan]);

  const triggerWineListScan = useCallback(() => {
    setPendingWineListScan(true);
    setAddWineOpen(false);
  }, []);

  // Depth view
  const [depthView, setDepthView] = useState<{
    cabinetId: string;
    row: number;
    col: number;
    depth: number;
    wines: Wine[];
    sectionName: string;
  } | null>(null);
  const [depthViewOpen, setDepthViewOpen] = useState(false);

  const handleDepthSlotClick = useCallback(
    (
      cabinetId: string,
      row: number,
      col: number,
      winesAtPos: Wine[],
      depth: number,
      sectionName: string
    ) => {
      setDepthView({
        cabinetId,
        row,
        col,
        depth,
        wines: winesAtPos,
        sectionName,
      });
      setDepthViewOpen(true);
    },
    []
  );

  // Bulk zone view
  const [bulkZoneView, setBulkZoneView] = useState<{
    cabinetId: string;
    rowIndex: number;
    storageRow: StorageRow;
    sectionName: string;
  } | null>(null);
  const [bulkZoneViewOpen, setBulkZoneViewOpen] = useState(false);

  const handleBulkZoneClick = useCallback(
    (
      cabinetId: string,
      rowIndex: number,
      storageRow: StorageRow,
      sectionName: string
    ) => {
      setBulkZoneView({ cabinetId, rowIndex, storageRow, sectionName });
      setBulkZoneViewOpen(true);
    },
    []
  );

  // Bulk config dialog
  const [bulkConfigOpen, setBulkConfigOpen] = useState(false);
  const [bulkConfigInsertIndex, setBulkConfigInsertIndex] = useState<
    number | null
  >(null);

  // Reactive wine data for the bulk zone side sheet
  const bulkZoneWines = useMemo(() => {
    if (!bulkZoneView) return [];
    return wines.filter(
      (w) =>
        w.cabinetId === bulkZoneView.cabinetId &&
        w.row === bulkZoneView.rowIndex
    );
  }, [bulkZoneView, wines]);

  // ── Actions ─────────────────────────────────────────────────────────
  const handleAddWine = useCallback(
    async (data: NewWineInput) => {
      const wineData = pendingSlot
        ? {
            ...data,
            cabinetId: pendingSlot.cabinetId,
            row: pendingSlot.row,
            col: pendingSlot.col,
          }
        : data;
      const newWine = await addWineAndPrepend(wineData, { userId, setWines });
      setPendingSlot(null);
      // Flash the slot it landed in. Only when it actually got a location —
      // duplicates / receipt adds go to the unfiled pile (no slot to flash).
      if (newWine.cabinetId && newWine.row != null && newWine.col != null) {
        setHighlightWithTimer(newWine.id);
      }
    },
    [userId, pendingSlot, setWines, setPendingSlot, setHighlightWithTimer]
  );

  const handlePlaceWine = useCallback(
    async (wineId: string, cabinetId: string, row?: number, col?: number) => {
      await editWine(
        wineId,
        { cabinetId, row: row ?? null, col: col ?? null },
        userId
      );
      const wineData = await fetchWines(userId);
      setWines(wineData);
      // Flash where the unfiled bottle just landed.
      setHighlightWithTimer(wineId);
    },
    [userId, setWines, setHighlightWithTimer]
  );

  const handleWineClick = useCallback(
    (wine: Wine) => {
      setSelectedWine(wine);
      setDetailOpen(true);
    },
    [setSelectedWine, setDetailOpen]
  );

  const handleEditWine = useCallback(
    async (wineId: string, data: Partial<Wine>) => {
      await editWineAndSync(wineId, data, { userId, setWines, setSelectedWine });
    },
    [userId, setWines, setSelectedWine]
  );

  const handleConsumeWine = useCallback(
    async (
      wineId: string,
      reason: string,
      rating?: number | null,
      notes?: string
    ) => {
      await consumeWineAndSync(wineId, reason, rating, notes, {
        userId,
        setWines,
        setSelectedWine,
        setDetailOpen,
      });
    },
    [userId, setWines, setSelectedWine, setDetailOpen]
  );

  const handleAddBottle = useCallback(async () => {
    if (!selectedWine) return;
    await handleAddWine(buildDuplicateWineInput(selectedWine, { unfile: false }));
  }, [selectedWine, handleAddWine]);

  const handleDuplicateWine = useCallback(
    async (count: number = 1) => {
      if (!selectedWine) return;
      const created = await duplicateWinesAndPrepend(selectedWine, count, {
        userId,
        setWines,
      });
      toast.success(
        created.length === 1
          ? "Wine duplicated — check unfiled wines"
          : `${created.length} bottles duplicated — check unfiled wines`
      );
    },
    [selectedWine, userId, setWines]
  );

  const handleSectionChanges = useCallback(
    async (changes: SectionChanges) => {
      for (const id of changes.deleted) {
        await removeCabinet(id, userId);
      }
      for (const update of changes.updated) {
        const { id, ...data } = update;
        await editCabinet(id, data, userId);
      }
      for (const create of changes.created) {
        await createCabinet(create, userId);
      }
      const [wineData, cabinetData] = await Promise.all([
        fetchWines(userId),
        fetchCabinets(userId),
      ]);
      setWines(wineData);
      setCabinets(cabinetData);
    },
    [userId, setWines, setCabinets]
  );

  const handleWallChanges = useCallback(
    async (changes: WallChanges) => {
      for (const id of changes.deleted) {
        await removeWall(id, userId);
      }
      for (const update of changes.updated) {
        const { id, ...data } = update;
        await editWall(id, data, userId);
      }
      for (const create of changes.created) {
        await createWall(create, userId);
      }
      const [wineData, cabinetData, wallData] = await Promise.all([
        fetchWines(userId),
        fetchCabinets(userId),
        fetchWalls(userId),
      ]);
      setWines(wineData);
      setCabinets(cabinetData);
      setWalls(wallData);
      if (!wallData.find((w) => w.id === selectedWallId)) {
        setSelectedWallId(wallData[0]?.id ?? null);
      }
    },
    [userId, selectedWallId, setWines, setCabinets, setWalls, setSelectedWallId]
  );

  const handleWineMove = useCallback(
    async (
      wineId: string,
      targetCabinetId: string,
      targetRow: number,
      targetCol: number
    ) => {
      if (targetCabinetId.startsWith("__new_")) return;
      await editWineAndSync(
        wineId,
        {
          cabinetId: targetCabinetId,
          row: targetRow,
          col: targetCol,
          depth: 0,
        },
        { userId, setWines }
      );
      // Flash the destination slot so the move is easy to follow.
      setHighlightWithTimer(wineId);
    },
    [userId, setWines, setHighlightWithTimer]
  );

  const handleUnfileWine = useCallback(
    async (wineId: string) => {
      await editWineAndSync(
        wineId,
        { cabinetId: null, row: null, col: null },
        { userId, setWines }
      );
    },
    [userId, setWines]
  );

  const handleClearUnfiled = useCallback(
    async (unfiledWines: Wine[]) => {
      try {
        const ids = unfiledWines.map((w) => w.id);
        const count = await bulkDeleteWines(ids, "other", userId);
        setWines((prev) => prev.filter((w) => !ids.includes(w.id)));
        toast.success(`Removed ${count} unfiled wines`);
      } catch (err) {
        console.error("Failed to clear unfiled wines:", err);
        toast.error("Failed to remove unfiled wines");
      }
    },
    [userId, setWines]
  );

  /** Batch remove wines from bulk zone / depth view — moves to history. */
  const handleBatchRemoveWines = useCallback(
    async (wineIds: string[]) => {
      if (wineIds.length === 0) return;
      try {
        const count = await bulkDeleteWines(wineIds, "other", userId);
        setWines((prev) => prev.filter((w) => !wineIds.includes(w.id)));
        toast.success(`Removed ${count} wines`);
      } catch (err) {
        console.error("Failed to remove wines:", err);
        toast.error(err instanceof Error ? err.message : "Failed to remove wines");
      }
    },
    [userId, setWines]
  );

  /** Drop a wine into the open bulk zone: first free slot, or nowhere if full. */
  const handleBulkZoneDrop = useCallback(
    async (wineId: string) => {
      if (!bulkZoneView || bulkZoneView.cabinetId.startsWith("__new_")) return;
      const existingInZone = wines.filter(
        (w) => w.cabinetId === bulkZoneView.cabinetId && w.row === bulkZoneView.rowIndex
      );
      if (existingInZone.length >= bulkZoneView.storageRow.capacity) return;
      const usedCols = new Set(existingInZone.map((w) => w.col ?? 0));
      const boxes = bulkZoneView.storageRow.boxes;
      const hasBoxes = boxes && boxes.length > 0;
      const totalBoxCap = hasBoxes
        ? boxes.reduce((s, b) => s + b, 0)
        : 0;
      let nextCol = totalBoxCap;
      while (usedCols.has(nextCol)) nextCol++;
      const placement = {
        cabinetId: bulkZoneView.cabinetId,
        row: bulkZoneView.rowIndex,
        col: nextCol,
        depth: 0,
      };
      await editWine(wineId, placement, userId);
      setWines((prev) =>
        prev.map((w) => (w.id === wineId ? { ...w, ...placement } : w))
      );
      // Flash the bottle in its new bulk-zone home.
      setHighlightWithTimer(wineId);
    },
    [bulkZoneView, wines, userId, setWines, setHighlightWithTimer]
  );

  // Show-in-cellar: close the detail dialog, then switch wall + flash + scroll.
  const handleShowInCellar = useCallback(
    (wine: Wine) => {
      setDetailOpen(false);
      setTimeout(() => scrollToWineInCellar(wine), 300);
    },
    [scrollToWineInCellar, setDetailOpen]
  );

  // ── Edit / move mode ────────────────────────────────────────────────
  const {
    editMode,
    setEditMode,
    selectedSectionId,
    selectSection,
    draftSections,
    initDrafts,
    updateDraft,
    addDraft,
    reorderDraft,
    buildChanges,
  } = useEditMode();

  const [saving, setSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [activeRowPopover, setActiveRowPopover] = useState<{
    sectionId: string;
    rowIndex: number;
    anchorRect: DOMRect;
  } | null>(null);

  const handleWineLongPress = useCallback(() => {
    if (editMode || moveMode || !selectedWallId) return;
    hapticImpact();
    setMoveMode(true);
  }, [editMode, moveMode, selectedWallId]);

  const handleEnterEditMode = useCallback(
    async (sectionId?: string) => {
      if (moveMode) setMoveMode(false);
      const freshCabinets = await fetchCabinets(userId);
      setCabinets(freshCabinets);
      const freshWall = selectedWallId
        ? freshCabinets.filter((c) => c.wallId === selectedWallId)
        : freshCabinets;
      initDrafts(freshWall);
      setEditMode(true);
      if (sectionId) {
        selectSection(sectionId);
      }
    },
    [userId, moveMode, selectedWallId, setCabinets, initDrafts, setEditMode, selectSection]
  );

  const handleSaveEditMode = useCallback(async () => {
    if (!selectedWallId) return;
    setSaving(true);
    setActiveRowPopover(null);
    try {
      const changes = buildChanges(wallCabinets, selectedWallId);
      // Unfile wines that fall outside shrunk rack dimensions
      for (const draft of draftSections) {
        const storageRowIndices = new Set(
          draft.storageRows.map((sr) => sr.row)
        );
        const outOfBounds = wines.filter((w) => {
          if (w.cabinetId !== draft.id) return false;
          if (w.row === null || w.col === null) return false;
          if (storageRowIndices.has(w.row)) return false;
          if (w.row >= draft.rows || w.col >= draft.cols) return true;
          return false;
        });
        for (const w of outOfBounds) {
          await editWine(
            w.id,
            { cabinetId: null, row: null, col: null },
            userId
          );
        }
      }
      await handleSectionChanges(changes);
    } finally {
      setSaving(false);
      setEditMode(false);
    }
  }, [
    selectedWallId,
    wallCabinets,
    draftSections,
    wines,
    userId,
    buildChanges,
    handleSectionChanges,
    setEditMode,
  ]);

  const handleCancelEditMode = useCallback(() => {
    setActiveRowPopover(null);
    setEditMode(false);
  }, [setEditMode]);

  const handleDropTemplate = useCallback(
    (index: number, templateJson: string) => {
      const template: SectionTemplate = JSON.parse(templateJson);
      const isBulk = template.storageRows.some((sr) => sr.type === "bulk");
      if (isBulk) {
        setBulkConfigInsertIndex(index);
        setBulkConfigOpen(true);
        return;
      }
      const newId = generateTempId();
      addDraft({
        id: newId,
        name: template.name,
        rows: template.rows,
        cols: template.cols,
        depth: template.depth,
        storageRows: template.storageRows,
        rowSizes: [],
        sortOrder: index,
        isNew: true,
      });
      reorderDraft(newId, index);
      selectSection(newId);
    },
    [addDraft, reorderDraft, selectSection, setBulkConfigInsertIndex, setBulkConfigOpen]
  );

  const handleBulkConfigConfirm = useCallback(
    (template: SectionTemplate) => {
      const newId = generateTempId();
      const index = draftSections.length;
      addDraft({
        id: newId,
        name: template.name,
        rows: template.rows,
        cols: template.cols,
        depth: template.depth,
        storageRows: template.storageRows,
        rowSizes: [],
        sortOrder: index,
        isNew: true,
      });
      reorderDraft(newId, index);
      selectSection(newId);
      setBulkConfigInsertIndex(null);
    },
    [draftSections.length, addDraft, reorderDraft, selectSection, setBulkConfigInsertIndex]
  );

  const handleDropReorder = useCallback(
    (fromId: string, toIndex: number) => {
      reorderDraft(fromId, toIndex);
    },
    [reorderDraft]
  );

  const handleWineMoveInMode = useCallback(
    async (
      wineId: string,
      targetCabinetId: string,
      targetRow: number,
      targetCol: number
    ) => {
      await handleWineMove(wineId, targetCabinetId, targetRow, targetCol);
      // In edit mode (not move mode), exit after a single move
      if (editMode && !moveMode) {
        setEditMode(false);
        setActiveRowPopover(null);
      }
    },
    [editMode, moveMode, handleWineMove, setEditMode]
  );

  // Row handlers
  const handleRowStorageDrop = useCallback(
    (sectionId: string, rowIndex: number, type: "slots" | "bulk") => {
      const draft = draftSections.find((s) => s.id === sectionId);
      if (!draft) return;
      const newStorageRows = draft.storageRows.filter(
        (sr) => sr.row !== rowIndex
      );
      if (type === "bulk") {
        newStorageRows.push({
          row: rowIndex,
          name: "Bulk Storage",
          type: "bulk",
          capacity: 20,
        });
      }
      updateDraft(sectionId, { storageRows: newStorageRows });
    },
    [draftSections, updateDraft]
  );

  const handleRowCaseDrop = useCallback(
    (sectionId: string, rowIndex: number, caseSize: number) => {
      const draft = draftSections.find((s) => s.id === sectionId);
      if (!draft) return;
      const existingSR = draft.storageRows.find(
        (sr) => sr.row === rowIndex
      );
      if (existingSR) {
        const newBoxes = [...(existingSR.boxes || []), caseSize];
        const newCapacity = existingSR.capacity + caseSize;
        const newStorageRows = draft.storageRows.map((sr) =>
          sr.row === rowIndex
            ? { ...sr, boxes: newBoxes, capacity: newCapacity }
            : sr
        );
        updateDraft(sectionId, { storageRows: newStorageRows });
      } else {
        const newStorageRows = [
          ...draft.storageRows,
          {
            row: rowIndex,
            name: "Case Storage",
            type: "bulk" as const,
            capacity: caseSize,
            boxes: [caseSize],
          },
        ];
        updateDraft(sectionId, { storageRows: newStorageRows });
      }
    },
    [draftSections, updateDraft]
  );

  const handleRowClick = useCallback(
    (sectionId: string, rowIndex: number, anchorRect: DOMRect) => {
      setActiveRowPopover((prev) =>
        prev?.sectionId === sectionId && prev?.rowIndex === rowIndex
          ? null
          : { sectionId, rowIndex, anchorRect }
      );
    },
    []
  );

  const handleRowTypeChange = useCallback(
    (type: "slots" | "bulk") => {
      if (!activeRowPopover) return;
      handleRowStorageDrop(
        activeRowPopover.sectionId,
        activeRowPopover.rowIndex,
        type
      );
    },
    [activeRowPopover, handleRowStorageDrop]
  );

  const handleRowStorageUpdate = useCallback(
    (updates: Partial<StorageRow>) => {
      if (!activeRowPopover) return;
      const draft = draftSections.find(
        (s) => s.id === activeRowPopover.sectionId
      );
      if (!draft) return;
      const newStorageRows = draft.storageRows.map((sr) =>
        sr.row === activeRowPopover.rowIndex ? { ...sr, ...updates } : sr
      );
      updateDraft(activeRowPopover.sectionId, {
        storageRows: newStorageRows,
      });
    },
    [activeRowPopover, draftSections, updateDraft]
  );

  // Set a slot row's max bottle size ("standard" entries are dropped from the
  // list — absence means standard, keeping the stored JSON minimal).
  const handleRowSizeChange = useCallback(
    (maxSize: BottleSize) => {
      if (!activeRowPopover) return;
      const draft = draftSections.find(
        (s) => s.id === activeRowPopover.sectionId
      );
      if (!draft) return;
      const others = draft.rowSizes.filter(
        (rs) => rs.row !== activeRowPopover.rowIndex
      );
      updateDraft(activeRowPopover.sectionId, {
        rowSizes:
          maxSize === "standard"
            ? others
            : [...others, { row: activeRowPopover.rowIndex, maxSize }],
      });
    },
    [activeRowPopover, draftSections, updateDraft]
  );

  return {
    // Collection state and derived data
    data: {
      wines,
      setWines,
      walls,
      setWalls,
      cabinets,
      setCabinets,
      loading,
      userId,

      selectedWallId,
      setSelectedWallId,
      selectedType,
      setSelectedType,
      selectedLocation,
      setSelectedLocation,

      displayName,
      editingName,
      setEditingName,
      handleNameSave,
      onboarded,
      completeOnboarding,

      loadData,
      refreshData,

      consumeDeepLink,

      highlightedWineId,
      setHighlightWithTimer,
      highlightedSlot,
      setSortHighlight,
      clearSortHighlight,

      scrollToWineInCellar,

      wallCabinets,
      displayWines,
      unfiledWines,
      allTags,
      locations,
      locationWalls,
      stats,
    },

    // Dialog state
    dialogs: {
      selectedWine,
      setSelectedWine,
      detailOpen,
      setDetailOpen,

      consumeOpen,
      setConsumeOpen,
      triggerConsume,

      wineListScanOpen,
      setWineListScanOpen,
      triggerWineListScan,

      addWineOpen,
      setAddWineOpen,
      pendingSlot,
      setPendingSlot,

      depthView,
      depthViewOpen,
      setDepthViewOpen,
      handleDepthSlotClick,

      bulkZoneView,
      bulkZoneViewOpen,
      setBulkZoneViewOpen,
      handleBulkZoneClick,
      bulkZoneWines,

      bulkConfigOpen,
      setBulkConfigOpen,
      bulkConfigInsertIndex,
      setBulkConfigInsertIndex,
    },

    // Wine and wall mutations
    actions: {
      handleAddWine,
      handlePlaceWine,
      handleWineClick,
      handleEditWine,
      handleConsumeWine,
      handleAddBottle,
      handleDuplicateWine,
      handleSectionChanges,
      handleWallChanges,
      handleWineMove,
      handleUnfileWine,
      handleClearUnfiled,
      handleBatchRemoveWines,
      handleBulkZoneDrop,
      handleShowInCellar,
    },

    // Edit / move mode
    mode: {
      editMode,
      setEditMode,
      selectedSectionId,
      selectSection,
      draftSections,
      updateDraft,
      saving,
      showDiscardConfirm,
      setShowDiscardConfirm,

      moveMode,
      setMoveMode,

      activeRowPopover,
      setActiveRowPopover,

      handleWineLongPress,
      handleEnterEditMode,
      handleSaveEditMode,
      handleCancelEditMode,
      handleDropTemplate,
      handleBulkConfigConfirm,
      handleDropReorder,
      handleWineMoveInMode,
      handleRowStorageDrop,
      handleRowCaseDrop,
      handleRowClick,
      handleRowTypeChange,
      handleRowStorageUpdate,
      handleRowSizeChange,
    },
  };
}

export type CellarStore = ReturnType<typeof useCellar>;
