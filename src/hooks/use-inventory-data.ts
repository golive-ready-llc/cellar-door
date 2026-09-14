"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { fetchWines, fetchCabinets, bulkDeleteWines } from "@/lib/data";
import {
  addWineAndPrepend,
  consumeWineAndSync,
  duplicateWinesAndPrepend,
  editWineAndSync,
  editWinesInBatches,
} from "@/lib/wine-collection";
import { useAddWine } from "@/components/add-wine-context";
import { useAuth } from "@/components/auth-provider";
import type { Wine, Cabinet, WineType, NewWineInput } from "@/types/wine";
import {
  collectUniqueTags,
  buildCabinetMap,
  filterWines,
  sortWines,
  computeTotalValue,
  groupWinesByIdentity,
  countUniqueWines,
  type SortKey,
  type SortDirection,
  type ViewMode,
} from "@/lib/inventory-utils";

export function useInventoryData() {
  const { userId, devMode } = useAuth();
  const [wines, setWines] = useState<Wine[]>([]);
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<WineType | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [consumeOpen, setConsumeOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedWineIds, setSelectedWineIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [initialEditing, setInitialEditing] = useState(false);
  const [pendingConsume, setPendingConsume] = useState(false);
  const [groupDuplicates, setGroupDuplicates] = useState(true);

  const allTags = useMemo(() => collectUniqueTags(wines), [wines]);
  const cabinetMap = useMemo(() => buildCabinetMap(cabinets), [cabinets]);
  const totalValue = useMemo(() => computeTotalValue(wines), [wines]);

  const filteredWines = useMemo(
    () => sortWines(filterWines(wines, selectedType, selectedTags, searchQuery), sortKey, sortDir),
    [wines, selectedType, selectedTags, searchQuery, sortKey, sortDir]
  );

  // Filter-aware value — updates as the user narrows by type/tag/search
  const filteredValue = useMemo(() => computeTotalValue(filteredWines), [filteredWines]);

  const selectedWines = useMemo(
    () => wines.filter((w) => selectedWineIds.has(w.id)),
    [wines, selectedWineIds]
  );

  const groupedFilteredWines = useMemo(
    () => groupWinesByIdentity(filteredWines),
    [filteredWines]
  );

  const uniqueWineCount = useMemo(
    () => countUniqueWines(wines),
    [wines]
  );

  const loadData = useCallback(async () => {
    // Don't fetch with a null userId in production — resolveUserId would throw.
    // Mirrors the guard in useCellar (fixes the blank-flash / unhandled
    // rejection while auth is still resolving).
    if (!userId && !devMode) return;
    try {
      const [wineData, cabinetData] = await Promise.all([
        fetchWines(userId),
        fetchCabinets(userId),
      ]);
      setWines(wineData);
      setCabinets(cabinetData);
    } finally {
      setLoading(false);
    }
  }, [userId, devMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Dialog transition: detail -> consume
  useEffect(() => {
    if (!detailOpen && pendingConsume) {
      const timer = setTimeout(() => {
        setConsumeOpen(true);
        setPendingConsume(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [detailOpen, pendingConsume]);

  const handleAddWine = useCallback(
    async (data: NewWineInput) => {
      await addWineAndPrepend(data, { userId, setWines });
    },
    [userId]
  );

  // Register with global FAB context
  const { register: registerAddWine } = useAddWine();
  useEffect(() => {
    registerAddWine({ cabinets, onAdd: handleAddWine, allTags });
  }, [cabinets, allTags, handleAddWine, registerAddWine]);

  const handleEditWine = useCallback(
    async (wineId: string, data: Partial<Wine>) => {
      await editWineAndSync(wineId, data, { userId, setWines, setSelectedWine });
    },
    [userId]
  );

  const handleConsumeWine = useCallback(
    async (wineId: string, reason: string, rating?: number | null, notes?: string) => {
      await consumeWineAndSync(wineId, reason, rating, notes, {
        userId,
        setWines,
        setSelectedWine,
        setDetailOpen,
      });
    },
    [userId]
  );

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey]
  );

  const handleWineClick = useCallback((wine: Wine) => {
    setInitialEditing(false);
    setSelectedWine(wine);
    setDetailOpen(true);
  }, []);

  const handleWineLongPress = useCallback((wine: Wine) => {
    setInitialEditing(true);
    setSelectedWine(wine);
    setDetailOpen(true);
  }, []);

  const toggleWineSelection = useCallback((wineId: string) => {
    setSelectedWineIds((prev) => {
      const next = new Set(prev);
      if (next.has(wineId)) next.delete(wineId);
      else next.add(wineId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedWineIds(new Set());
    setSelectMode(false);
  }, []);

  const handleBatchMove = useCallback(
    async (wineIds: string[], cabinetId: string | null) => {
      await editWinesInBatches(
        wineIds,
        () => ({ cabinetId, row: null, col: null }),
        userId
      );
      await loadData();
    },
    [userId, loadData]
  );

  const handleBatchDelete = useCallback(
    async (wineIds: string[]) => {
      // One bulk call (single transaction) instead of one delete per bottle.
      await bulkDeleteWines(wineIds, "other", userId);
      setWines((prev) => prev.filter((w) => !wineIds.includes(w.id)));
    },
    [userId]
  );

  const handleBatchTag = useCallback(
    async (wineIds: string[], tags: string[]) => {
      await editWinesInBatches(
        wineIds,
        (id) => {
          const wine = wines.find((w) => w.id === id);
          if (!wine) return null;
          const existingTags = wine.tags ?? [];
          return { tags: [...new Set([...existingTags, ...tags])] };
        },
        userId
      );
      await loadData();
    },
    [wines, userId, loadData]
  );

  const handleBatchType = useCallback(
    async (wineIds: string[], type: WineType) => {
      await editWinesInBatches(wineIds, () => ({ type }), userId);
      await loadData();
    },
    [userId, loadData]
  );

  const startConsume = useCallback(() => {
    setPendingConsume(true);
    setDetailOpen(false);
  }, []);

  const handleDuplicate = useCallback(
    async (count: number = 1) => {
      if (!selectedWine) return;
      await duplicateWinesAndPrepend(selectedWine, count, { userId, setWines });
    },
    [selectedWine, userId]
  );

  const selectAll = useCallback(() => {
    setSelectedWineIds(new Set(filteredWines.map((w) => w.id)));
  }, [filteredWines]);

  const deselectAll = useCallback(() => {
    setSelectedWineIds(new Set());
  }, []);

  return {
    // State
    wines,
    cabinets,
    loading,
    searchQuery,
    selectedType,
    sortKey,
    sortDir,
    viewMode,
    selectedWine,
    detailOpen,
    consumeOpen,
    selectedTags,
    selectedWineIds,
    selectMode,
    initialEditing,

    // Derived
    allTags,
    cabinetMap,
    totalValue,
    filteredValue,
    filteredWines,
    selectedWines,
    groupedFilteredWines,
    uniqueWineCount,
    groupDuplicates,

    // Setters
    setSearchQuery,
    setSelectedType,
    setViewMode,
    setDetailOpen,
    setConsumeOpen,
    setSelectedTags,
    setSelectMode,
    setGroupDuplicates,

    // Handlers
    handleSort,
    handleWineClick,
    handleWineLongPress,
    handleEditWine,
    handleConsumeWine,
    handleAddWine,
    toggleWineSelection,
    clearSelection,
    selectAll,
    deselectAll,
    handleBatchMove,
    handleBatchDelete,
    handleBatchTag,
    handleBatchType,
    startConsume,
    handleDuplicate,
  };
}
