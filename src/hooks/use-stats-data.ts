"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { fetchWines, fetchHistory, fetchWalls, fetchCabinets } from "@/lib/data";
import { editWineAndSync } from "@/lib/wine-collection";
import { useAuth } from "@/components/auth-provider";
import {
  computeCoreStats,
  computeTypeData,
  computeVintageData,
  computeRegionData,
  computeDispositionData,
  computeConsumptionData,
  computePriceData,
  computeTopRated,
  computeGrapeData,
} from "@/lib/stats-utils";
import type { Cabinet, Wine, Wall, WineHistoryItem } from "@/types/wine";

export function useStatsData() {
  const { userId, devMode } = useAuth();
  const [wines, setWines] = useState<Wine[]>([]);
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [history, setHistory] = useState<WineHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filterLabel, setFilterLabel] = useState<string>("");
  const [filteredWines, setFilteredWines] = useState<Wine[]>([]);

  const handleWineClick = useCallback((wine: Wine) => {
    setSelectedWine(wine);
    setDetailOpen(true);
  }, []);

  const handleEditWine = useCallback(
    async (wineId: string, updates: Partial<Wine>) => {
      const updated = await editWineAndSync(wineId, updates, {
        userId,
        setWines,
        setSelectedWine,
      });
      if (updated) {
        setFilteredWines((prev) =>
          prev.map((w) => (w.id === wineId ? { ...w, ...updated } : w))
        );
      }
    },
    [userId]
  );

  const showFiltered = useCallback((label: string, filtered: Wine[]) => {
    setFilterLabel(label);
    setFilteredWines(filtered);
  }, []);

  const clearFilter = useCallback(() => {
    setFilterLabel("");
    setFilteredWines([]);
  }, []);

  const loadData = useCallback(async () => {
    // Don't fetch with a null userId in production — resolveUserId would throw.
    // Mirrors the guard in useCellarData (fixes the blank-flash / unhandled
    // rejection while auth is still resolving).
    if (!userId && !devMode) return;
    try {
      const [wineData, historyData, wallData, cabinetData] = await Promise.all([
        fetchWines(userId),
        fetchHistory(userId),
        fetchWalls(userId),
        fetchCabinets(userId),
      ]);
      setWines(wineData);
      setHistory(historyData);
      setWalls(wallData);
      setCabinets(cabinetData);
    } finally {
      setLoading(false);
    }
  }, [userId, devMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived chart data
  const stats = useMemo(() => computeCoreStats(wines, history), [wines, history]);
  const typeData = useMemo(() => computeTypeData(wines), [wines]);
  const vintageData = useMemo(() => computeVintageData(wines), [wines]);
  const regionData = useMemo(() => computeRegionData(wines), [wines]);
  const dispositionData = useMemo(() => computeDispositionData(wines), [wines]);
  const consumptionData = useMemo(() => computeConsumptionData(history), [history]);
  const priceData = useMemo(() => computePriceData(wines), [wines]);
  const topRated = useMemo(() => computeTopRated(wines), [wines]);
  const grapeData = useMemo(() => computeGrapeData(wines), [wines]);

  return {
    wines,
    walls,
    cabinets,
    history,
    loading,
    selectedWine,
    detailOpen,
    setDetailOpen,
    filterLabel,
    filteredWines,
    handleWineClick,
    handleEditWine,
    showFiltered,
    clearFilter,
    stats,
    typeData,
    vintageData,
    regionData,
    dispositionData,
    consumptionData,
    priceData,
    topRated,
    grapeData,
  };
}
