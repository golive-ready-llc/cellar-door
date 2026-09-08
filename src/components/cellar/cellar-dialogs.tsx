"use client";

import { AddWineDialog } from "@/components/wine/add-wine-dialog";
import { WineDetailDialog } from "@/components/wine/wine-detail-dialog";
import { WineListScanDialog } from "@/components/wine/wine-list-scan-dialog";
import { ConsumeWineDialog } from "@/components/wine/consume-wine-dialog";
import { DepthSideView } from "@/components/cellar/depth-side-view";
import { BulkZoneSideView } from "@/components/cellar/bulk-zone-side-view";
import { BulkConfigDialog } from "@/components/cellar/bulk-config-dialog";
import type { Wine, Wall, Cabinet, StorageRow } from "@/types/wine";
import type { SectionTemplate } from "@/components/cellar/storage-type-picker";

interface CellarDialogsProps {
  // Wine detail
  selectedWine: Wine | null;
  detailOpen: boolean;
  onDetailOpenChange: (open: boolean) => void;
  onTriggerConsume: () => void;
  onEditWine: (wineId: string, data: Partial<Wine>) => Promise<void>;
  onAddBottle: () => void;
  onDuplicate: () => void;
  onShowInCellar: ((wine: Wine) => void) | undefined;
  cabinets: Cabinet[];
  walls: Wall[];
  allTags: string[];
  wines: Wine[];

  // Consume
  consumeOpen: boolean;
  onConsumeOpenChange: (open: boolean) => void;
  onConsume: (
    wineId: string,
    reason: string,
    rating?: number | null,
    notes?: string
  ) => Promise<void>;

  // Add wine
  addWineOpen: boolean;
  onAddWineOpenChange: (open: boolean) => void;
  wallCabinets: Cabinet[];
  onAddWine: (
    data: Omit<Wine, "id" | "addedAt" | "updatedAt" | "userId">
  ) => Promise<void>;
  unfiledWines: Wine[];
  onPlaceWine: (
    wineId: string,
    cabinetId: string,
    row?: number,
    col?: number
  ) => Promise<void>;
  pendingSlot: { cabinetId: string; row: number; col: number } | null;
  onClearPendingSlot: () => void;
  onScanWineList: () => void;

  // Wine list scan
  wineListScanOpen: boolean;
  onWineListScanOpenChange: (open: boolean) => void;

  // Depth view
  depthView: {
    cabinetId: string;
    row: number;
    col: number;
    depth: number;
    wines: Wine[];
    sectionName: string;
  } | null;
  depthViewOpen: boolean;
  onDepthViewOpenChange: (open: boolean) => void;
  onDepthWineClick: (wine: Wine) => void;
  onDepthWineLongPress: () => void;
  onDepthEmptySlotClick: () => void;

  // Bulk zone
  bulkZoneView: {
    cabinetId: string;
    rowIndex: number;
    storageRow: StorageRow;
    sectionName: string;
  } | null;
  bulkZoneViewOpen: boolean;
  onBulkZoneViewOpenChange: (open: boolean) => void;
  bulkZoneWines: Wine[];
  editableZone: boolean;
  onBulkZoneWineClick: (wine: Wine) => void;
  onBulkZoneWineLongPress: () => void;
  onBulkZoneDrop: (wineId: string) => Promise<void>;
  onBulkZoneWineRemove: (wineId: string) => Promise<void>;
  /** Batch remove wines from bulk zone or depth view */
  onBatchRemove?: (wineIds: string[]) => Promise<void>;

  // Bulk config
  bulkConfigOpen: boolean;
  onBulkConfigOpenChange: (open: boolean) => void;
  onBulkConfigConfirm: (template: SectionTemplate) => void;
}

export function CellarDialogs({
  selectedWine,
  detailOpen,
  onDetailOpenChange,
  onTriggerConsume,
  onEditWine,
  onAddBottle,
  onDuplicate,
  onShowInCellar,
  cabinets,
  // Accepted for interface stability; the detail dialog reads walls from
  // WineDataContext now, so it's unused here.
  walls: _walls,
  allTags,
  wines,
  consumeOpen,
  onConsumeOpenChange,
  onConsume,
  addWineOpen,
  onAddWineOpenChange,
  wallCabinets,
  onAddWine,
  unfiledWines,
  onPlaceWine,
  pendingSlot,
  onClearPendingSlot,
  onScanWineList,
  wineListScanOpen,
  onWineListScanOpenChange,
  depthView,
  depthViewOpen,
  onDepthViewOpenChange,
  onDepthWineClick,
  onDepthWineLongPress,
  onDepthEmptySlotClick,
  bulkZoneView,
  bulkZoneViewOpen,
  onBulkZoneViewOpenChange,
  bulkZoneWines,
  editableZone,
  onBulkZoneWineClick,
  onBulkZoneWineLongPress,
  onBulkZoneDrop,
  onBulkZoneWineRemove,
  onBatchRemove,
  bulkConfigOpen,
  onBulkConfigOpenChange,
  onBulkConfigConfirm,
}: CellarDialogsProps) {
  return (
    <>
      {/* Depth Side View */}
      {depthView && (
        <DepthSideView
          open={depthViewOpen}
          onOpenChange={onDepthViewOpenChange}
          row={depthView.row}
          col={depthView.col}
          depth={depthView.depth}
          wines={depthView.wines}
          sectionName={depthView.sectionName}
          onWineClick={onDepthWineClick}
          onWineLongPress={onDepthWineLongPress}
          onEmptySlotClick={onDepthEmptySlotClick}
          onBatchRemove={onBatchRemove}
        />
      )}

      {/* Bulk Zone Side View */}
      {bulkZoneView && (
        <BulkZoneSideView
          open={bulkZoneViewOpen}
          onOpenChange={onBulkZoneViewOpenChange}
          storageRow={bulkZoneView.storageRow}
          wines={bulkZoneWines}
          sectionName={bulkZoneView.sectionName}
          editable={editableZone}
          onWineClick={onBulkZoneWineClick}
          onWineLongPress={onBulkZoneWineLongPress}
          onWineDrop={onBulkZoneDrop}
          onWineRemove={onBulkZoneWineRemove}
          onBatchRemove={onBatchRemove}
        />
      )}

      {/* Bulk Storage Config Dialog */}
      <BulkConfigDialog
        open={bulkConfigOpen}
        onOpenChange={onBulkConfigOpenChange}
        onConfirm={onBulkConfigConfirm}
      />

      {/* Add Wine Dialog */}
      <AddWineDialog
        cabinets={wallCabinets.length > 0 ? wallCabinets : cabinets}
        onAdd={onAddWine}
        allTags={allTags}
        open={addWineOpen}
        onOpenChange={(open) => {
          onAddWineOpenChange(open);
          if (!open) onClearPendingSlot();
        }}
        unfiledWines={unfiledWines}
        onPlaceWine={onPlaceWine}
        pendingSlot={pendingSlot}
        onScanWineList={onScanWineList}
      />

      {/* Wine List Scan Dialog */}
      <WineListScanDialog
        open={wineListScanOpen}
        onOpenChange={onWineListScanOpenChange}
        userWines={wines.map((w) => ({
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
            open={detailOpen}
            onOpenChange={onDetailOpenChange}
            onConsume={onTriggerConsume}
            onUpdate={async (updates) => {
              await onEditWine(selectedWine.id, updates);
            }}
            onSave={onEditWine}
            onAddBottle={onAddBottle}
            onDuplicate={onDuplicate}
            onShowInCellar={
              selectedWine.cabinetId && onShowInCellar
                ? () => onShowInCellar(selectedWine)
                : undefined
            }
          />
          <ConsumeWineDialog
            wine={selectedWine}
            open={consumeOpen}
            onOpenChange={onConsumeOpenChange}
            onConsume={onConsume}
          />
        </>
      )}
    </>
  );
}
