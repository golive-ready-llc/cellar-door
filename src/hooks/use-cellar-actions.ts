"use client";

import { useCallback } from "react";
import { toast } from "@/components/ui/custom-toast";
import {
  editWine,
  fetchWines,
  fetchCabinets,
  fetchWalls,
  bulkDeleteWines,
  createCabinet,
  editCabinet,
  removeCabinet,
  createWall,
  editWall,
  removeWall,
} from "@/lib/data";
import {
  addWineAndPrepend,
  buildDuplicateWineInput,
  consumeWineAndSync,
  duplicateWinesAndPrepend,
  editWineAndSync,
} from "@/lib/wine-collection";
import { type SectionChanges } from "@/components/cellar/section-settings-dialog";
import { type WallChanges } from "@/components/cellar/wall-settings-dialog";
import type { Wine, Cabinet, NewWineInput } from "@/types/wine";

interface UseCellarActionsProps {
  userId: string | null;
  wines: Wine[];
  setWines: React.Dispatch<React.SetStateAction<Wine[]>>;
  setCabinets: React.Dispatch<React.SetStateAction<Cabinet[]>>;
  setWalls: React.Dispatch<React.SetStateAction<import("@/types/wine").Wall[]>>;
  selectedWallId: string | null;
  setSelectedWallId: React.Dispatch<React.SetStateAction<string | null>>;
  pendingSlot: { cabinetId: string; row: number; col: number } | null;
  setPendingSlot: React.Dispatch<
    React.SetStateAction<{ cabinetId: string; row: number; col: number } | null>
  >;
  setSelectedWine: React.Dispatch<React.SetStateAction<Wine | null>>;
  setDetailOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedWine: Wine | null;
  /**
   * Flash a wine in the grid for a few seconds (reuses the deep-link
   * "show in cellar" highlight). Fired after a wine lands in a slot — on add,
   * place, or move — so you can see exactly where the bottle in your hand goes.
   */
  highlightWine?: (wineId: string | null) => void;
}

export function useCellarActions({
  userId,
  setWines,
  setCabinets,
  setWalls,
  selectedWallId,
  setSelectedWallId,
  pendingSlot,
  setPendingSlot,
  setSelectedWine,
  setDetailOpen,
  selectedWine,
  highlightWine,
}: UseCellarActionsProps) {
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
        highlightWine?.(newWine.id);
      }
    },
    [userId, pendingSlot, setWines, setPendingSlot, highlightWine]
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
      highlightWine?.(wineId);
    },
    [userId, setWines, highlightWine]
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
      highlightWine?.(wineId);
    },
    [userId, setWines, highlightWine]
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

  return {
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
  };
}
