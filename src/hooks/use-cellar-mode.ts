"use client";

import { useState, useCallback } from "react";
import {
  useEditMode,
  generateTempId,
} from "@/components/cellar/edit-mode-context";
import { fetchCabinets, editWine } from "@/lib/data";
import { hapticImpact } from "@/lib/capacitor";
import type { Wine, Cabinet, StorageRow, BottleSize } from "@/types/wine";
import type { SectionTemplate } from "@/components/cellar/storage-type-picker";
import type { SectionChanges } from "@/components/cellar/section-settings-dialog";

interface UseCellarModeProps {
  userId: string | null;
  wines: Wine[];
  selectedWallId: string | null;
  setCabinets: React.Dispatch<React.SetStateAction<Cabinet[]>>;
  wallCabinets: Cabinet[];
  handleSectionChanges: (changes: SectionChanges) => Promise<void>;
  handleWineMove: (
    wineId: string,
    targetCabinetId: string,
    targetRow: number,
    targetCol: number
  ) => Promise<void>;
  setBulkConfigInsertIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setBulkConfigOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useCellarMode({
  userId,
  wines,
  selectedWallId,
  setCabinets,
  wallCabinets,
  handleSectionChanges,
  handleWineMove,
  setBulkConfigInsertIndex,
  setBulkConfigOpen,
}: UseCellarModeProps) {
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
    // Edit mode
    editMode,
    setEditMode,
    selectedSectionId,
    selectSection,
    draftSections,
    updateDraft,
    saving,
    showDiscardConfirm,
    setShowDiscardConfirm,

    // Move mode
    moveMode,
    setMoveMode,

    // Row popover
    activeRowPopover,
    setActiveRowPopover,

    // Handlers
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
  };
}
