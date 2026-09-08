"use client";

import { useState, useEffect, useCallback } from "react";
import type { Wine, StorageRow } from "@/types/wine";

export function useCellarDialogs() {
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
  const getBulkZoneWines = useCallback(
    (wines: Wine[]) => {
      if (!bulkZoneView) return [];
      return wines.filter(
        (w) =>
          w.cabinetId === bulkZoneView.cabinetId &&
          w.row === bulkZoneView.rowIndex
      );
    },
    [bulkZoneView]
  );

  return {
    // Wine detail
    selectedWine,
    setSelectedWine,
    detailOpen,
    setDetailOpen,

    // Consume
    consumeOpen,
    setConsumeOpen,
    triggerConsume,

    // Wine list scan
    wineListScanOpen,
    setWineListScanOpen,
    triggerWineListScan,

    // Add wine
    addWineOpen,
    setAddWineOpen,
    pendingSlot,
    setPendingSlot,

    // Depth view
    depthView,
    depthViewOpen,
    setDepthViewOpen,
    handleDepthSlotClick,

    // Bulk zone
    bulkZoneView,
    bulkZoneViewOpen,
    setBulkZoneViewOpen,
    handleBulkZoneClick,

    // Bulk config
    bulkConfigOpen,
    setBulkConfigOpen,
    bulkConfigInsertIndex,
    setBulkConfigInsertIndex,

    // Helpers
    getBulkZoneWines,
  };
}
