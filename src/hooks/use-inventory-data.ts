"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "@/components/ui/custom-toast";
import { fetchWines, fetchCabinets, createWine, editWine, deleteWine } from "@/lib/data";
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
    // Mirrors the guard in useCellarData (fixes the blank-flash / unhandled
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
      const newWine = await createWine(data, userId);
      setWines((prev) => [newWine, ...prev]);
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
      const updated = await editWine(wineId, data, userId);
      if (updated) {
        setWines((prev) =>
          prev.map((w) => (w.id === wineId ? { ...w, ...updated } : w))
        );
        setSelectedWine((prev) =>
          prev?.id === wineId ? { ...prev, ...updated } : prev
        );
      }
    },
    [userId]
  );

  const handleConsumeWine = useCallback(
    async (wineId: string, reason: string, rating?: number | null, notes?: string) => {
      try {
        await deleteWine(wineId, reason, rating, notes, userId);
        setWines((prev) => prev.filter((w) => w.id !== wineId));
        setSelectedWine(null);
        setDetailOpen(false);
        toast.success("Wine moved to history");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to remove wine");
      }
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
      for (let i = 0; i < wineIds.length; i += 5) {
        const chunk = wineIds.slice(i, i + 5);
        await Promise.all(
          chunk.map((id) => editWine(id, { cabinetId, row: null, col: null }, userId))
        );
      }
      await loadData();
    },
    [userId, loadData]
  );

  const handleBatchDelete = useCallback(
    async (wineIds: string[]) => {
      for (let i = 0; i < wineIds.length; i += 5) {
        const chunk = wineIds.slice(i, i + 5);
        await Promise.all(
          chunk.map((id) => deleteWine(id, "other", undefined, undefined, userId))
        );
      }
      setWines((prev) => prev.filter((w) => !wineIds.includes(w.id)));
    },
    [userId]
  );

  const handleBatchTag = useCallback(
    async (wineIds: string[], tags: string[]) => {
      for (let i = 0; i < wineIds.length; i += 5) {
        const chunk = wineIds.slice(i, i + 5);
        await Promise.all(
          chunk.map(async (id) => {
            const wine = wines.find((w) => w.id === id);
            if (wine) {
              const existingTags = wine.tags ?? [];
              const merged = [...new Set([...existingTags, ...tags])];
              await editWine(id, { tags: merged }, userId);
            }
          })
        );
      }
      await loadData();
    },
    [wines, userId, loadData]
  );

  const handleBatchType = useCallback(
    async (wineIds: string[], type: WineType) => {
      for (let i = 0; i < wineIds.length; i += 5) {
        const chunk = wineIds.slice(i, i + 5);
        await Promise.all(
          chunk.map((id) => editWine(id, { type }, userId))
        );
      }
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
      const safeCount = Math.max(1, Math.min(99, Math.floor(count)));
      const { id: _id, addedAt: _addedAt, updatedAt: _updatedAt, userId: _u, cabinetId: _c, row: _r, col: _col, depth: _d, zone: _z, ...wineData } = selectedWine;
      // Duplicating IS creating a duplicate — never block it on the dup check.
      const payload = { ...wineData, cabinetId: null, row: null, col: null, depth: 0, zone: "", skipDuplicateCheck: true } as NewWineInput;
      for (let i = 0; i < safeCount; i++) {
        await handleAddWine(payload);
      }
    },
    [selectedWine, handleAddWine]
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
