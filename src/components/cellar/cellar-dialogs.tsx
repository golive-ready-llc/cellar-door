"use client";

import { AddWineDialog } from "@/components/wine/add-wine-dialog";
import { WineDetailDialog } from "@/components/wine/wine-detail-dialog";
import { WineListScanDialog } from "@/components/wine/wine-list-scan-dialog";
import { ConsumeWineDialog } from "@/components/wine/consume-wine-dialog";
import { DepthSideView } from "@/components/cellar/depth-side-view";
import { BulkZoneSideView } from "@/components/cellar/bulk-zone-side-view";
import { BulkConfigDialog } from "@/components/cellar/bulk-config-dialog";
import type { CellarStore } from "@/hooks/use-cellar";
import type { Wine } from "@/types/wine";

/**
 * The cellar's dialog layer. Renders every dialog the cellar surface can
 * open, reading state and actions straight from the store — the dialog
 * choreography (close-then-deferred-open, since Base UI dialogs don't stack)
 * lives next to the JSX that triggers it.
 */
export function CellarDialogs({ store }: { store: CellarStore }) {
  const { data, dialogs, actions, mode } = store;
  const selectedWine = dialogs.selectedWine;

  // Detail-view transitions: close the side view, wait for it to unmount,
  // then open the next dialog.
  const openWineFromDepthView = (wine: Wine) => {
    dialogs.setDepthViewOpen(false);
    setTimeout(() => actions.handleWineClick(wine), 200);
  };
  const longPressFromDepthView = () => {
    dialogs.setDepthViewOpen(false);
    setTimeout(() => mode.handleWineLongPress(), 200);
  };
  const addWineIntoDepthSlot = () => {
    dialogs.setDepthViewOpen(false);
    if (dialogs.depthView) {
      dialogs.setPendingSlot({
        cabinetId: dialogs.depthView.cabinetId,
        row: dialogs.depthView.row,
        col: dialogs.depthView.col,
      });
    }
    setTimeout(() => dialogs.setAddWineOpen(true), 200);
  };
  const openWineFromBulkZone = (wine: Wine) => {
    dialogs.setBulkZoneViewOpen(false);
    setTimeout(() => actions.handleWineClick(wine), 200);
  };
  const longPressFromBulkZone = () => {
    dialogs.setBulkZoneViewOpen(false);
    setTimeout(() => mode.handleWineLongPress(), 200);
  };

  return (
    <>
      {/* Depth Side View */}
      {dialogs.depthView && (
        <DepthSideView
          open={dialogs.depthViewOpen}
          onOpenChange={dialogs.setDepthViewOpen}
          row={dialogs.depthView.row}
          col={dialogs.depthView.col}
          depth={dialogs.depthView.depth}
          wines={dialogs.depthView.wines}
          sectionName={dialogs.depthView.sectionName}
          onWineClick={openWineFromDepthView}
          onWineLongPress={longPressFromDepthView}
          onEmptySlotClick={addWineIntoDepthSlot}
          onBatchRemove={actions.handleBatchRemoveWines}
        />
      )}

      {/* Bulk Zone Side View */}
      {dialogs.bulkZoneView && (
        <BulkZoneSideView
          open={dialogs.bulkZoneViewOpen}
          onOpenChange={dialogs.setBulkZoneViewOpen}
          storageRow={dialogs.bulkZoneView.storageRow}
          wines={dialogs.bulkZoneWines}
          sectionName={dialogs.bulkZoneView.sectionName}
          editable={mode.editMode || mode.moveMode}
          onWineClick={openWineFromBulkZone}
          onWineLongPress={longPressFromBulkZone}
          onWineDrop={actions.handleBulkZoneDrop}
          onWineRemove={actions.handleUnfileWine}
          onBatchRemove={actions.handleBatchRemoveWines}
        />
      )}

      {/* Bulk Storage Config Dialog */}
      <BulkConfigDialog
        open={dialogs.bulkConfigOpen}
        onOpenChange={dialogs.setBulkConfigOpen}
        onConfirm={mode.handleBulkConfigConfirm}
      />

      {/* Add Wine Dialog */}
      <AddWineDialog
        cabinets={
          data.wallCabinets.length > 0 ? data.wallCabinets : data.cabinets
        }
        onAdd={actions.handleAddWine}
        allTags={data.allTags}
        open={dialogs.addWineOpen}
        onOpenChange={(open) => {
          dialogs.setAddWineOpen(open);
          if (!open) dialogs.setPendingSlot(null);
        }}
        unfiledWines={data.unfiledWines}
        onPlaceWine={actions.handlePlaceWine}
        pendingSlot={dialogs.pendingSlot}
        onScanWineList={dialogs.triggerWineListScan}
      />

      {/* Wine List Scan Dialog */}
      <WineListScanDialog
        open={dialogs.wineListScanOpen}
        onOpenChange={dialogs.setWineListScanOpen}
        userWines={data.wines.map((w) => ({
          id: w.id,
          name: w.name,
          winery: w.winery,
          vintage: w.vintage,
          type: w.type,
          region: w.region,
          grapeVariety: w.grapeVariety,
          disposition: w.disposition,
          drinkWindow: w.drinkWindow,
          userRating: w.userRating,
          aiRatings: w.aiRatings,
          cdScore: w.cdScore ?? null,
        }))}
      />

      {/* Wine Detail Dialog */}
      {selectedWine && (
        <>
          <WineDetailDialog
            wine={selectedWine}
            open={dialogs.detailOpen}
            onOpenChange={dialogs.setDetailOpen}
            onConsume={dialogs.triggerConsume}
            onUpdate={async (updates) => {
              await actions.handleEditWine(selectedWine.id, updates);
            }}
            onSave={actions.handleEditWine}
            onAddBottle={actions.handleAddBottle}
            onDuplicate={actions.handleDuplicateWine}
            onShowInCellar={
              selectedWine.cabinetId
                ? () => actions.handleShowInCellar(selectedWine)
                : undefined
            }
          />
          <ConsumeWineDialog
            wine={selectedWine}
            open={dialogs.consumeOpen}
            onOpenChange={dialogs.setConsumeOpen}
            onConsume={actions.handleConsumeWine}
          />
        </>
      )}
    </>
  );
}
