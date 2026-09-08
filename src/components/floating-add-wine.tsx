"use client";

import { AddWineDialog } from "@/components/wine/add-wine-dialog";
import { useAddWine } from "@/components/add-wine-context";

/**
 * Mounts the Add-Wine dialog in the layout — no longer renders a visible
 * trigger. The trigger UI is now the FloatingCameraFab (bottom-right
 * "Camera + Add" button) on every viewport. The previous header `+`
 * button was visually redundant with the FAB and clashed with the Chat
 * FAB that sits just below it in the top-right column, so it was
 * removed.
 *
 * The component still has to live in the (app) layout — it owns the
 * <AddWineDialog> mount + drives its open state from the AddWineContext
 * that the FAB writes to. Don't inline this into the FAB; the FAB is
 * just a button, and the dialog needs to keep rendering even when the
 * FAB is hidden (e.g. on routes that don't show the FAB).
 */
export function HeaderAddWine() {
  const { ready, _open, _setOpen, _cabinets, _onAdd, _allTags, _unfiledWines, _onPlaceWine, _onScanWineList } = useAddWine();

  if (!ready || !_onAdd) return null;

  return (
    <AddWineDialog
      cabinets={_cabinets}
      onAdd={_onAdd}
      allTags={_allTags}
      open={_open}
      onOpenChange={_setOpen}
      unfiledWines={_unfiledWines}
      onPlaceWine={_onPlaceWine ?? undefined}
      onScanWineList={_onScanWineList ?? undefined}
    />
  );
}
