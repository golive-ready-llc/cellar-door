"use client";

import { useEffect } from "react";
import { Wine as WineIcon, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { WineDetailDialog } from "@/components/wine/wine-detail-dialog";
import { useWineData } from "@/contexts/wine-data-context";
import { ConsumeWineDialog } from "@/components/wine/consume-wine-dialog";
import { BatchActionsBar } from "@/components/wine/batch-actions-bar";
import { useWineTextColors } from "@/hooks/use-wine-colors";
import { useCurrency } from "@/hooks/use-currency";
import { useInventoryData } from "@/hooks/use-inventory-data";
import { useIncrementalList } from "@/hooks/use-incremental-list";
import { LoadMore } from "@/components/ui/load-more";
import { getCabinetName } from "@/lib/inventory-utils";
import { InventoryHeader } from "@/components/inventory/inventory-header";
import { InventoryToolbar } from "@/components/inventory/inventory-toolbar";
import {
  TypeFilterBadges,
  TagFilterBadges,
  SelectAllBar,
} from "@/components/inventory/inventory-filters";
import { WineGridItem } from "@/components/inventory/wine-grid-item";
import { WineListItem } from "@/components/inventory/wine-list-item";
import { LabelGallery } from "@/components/gallery/label-gallery";
import { WineListSkeleton } from "@/components/ui/wine-list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function InventoryPage() {
  const wineTextColors = useWineTextColors();
  const { formatPrice } = useCurrency();
  const inv = useInventoryData();
  // Mount long lists a page at a time as the user scrolls.
  const groupedList = useIncrementalList(inv.groupedFilteredWines);
  const flatList = useIncrementalList(inv.filteredWines);
  const activeList = inv.groupDuplicates && !inv.selectMode ? groupedList : flatList;
  const { setWineData } = useWineData();

  // Push inventory data into the shared WineDataContext so any
  // WineDetailDialog mounted from this page (or anywhere downstream
  // like the chat wrapper) gets the same wines/cabinets/tags.
  useEffect(() => {
    setWineData({ wines: inv.wines, cabinets: inv.cabinets, allTags: inv.allTags });
  }, [inv.wines, inv.cabinets, inv.allTags, setWineData]);

  if (inv.loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-full" />
          ))}
        </div>
        <WineListSkeleton count={6} variant="grid" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <InventoryHeader
        wines={inv.wines}
        filteredCount={inv.filteredWines.length}
        totalValue={inv.totalValue}
        filteredValue={inv.filteredValue}
        isFiltered={inv.filteredWines.length !== inv.wines.length}
        formatPrice={formatPrice}
        selectMode={inv.selectMode}
        onToggleSelectMode={() => {
          if (inv.selectMode) {
            inv.clearSelection();
          } else {
            inv.setSelectMode(true);
          }
        }}
        onEditWine={inv.handleEditWine}
        uniqueWineCount={inv.uniqueWineCount}
      />

      <InventoryToolbar
        searchQuery={inv.searchQuery}
        onSearchChange={inv.setSearchQuery}
        sortKey={inv.sortKey}
        sortDir={inv.sortDir}
        onSort={inv.handleSort}
        viewMode={inv.viewMode}
        onViewModeChange={inv.setViewMode}
      />

      {/* Group duplicates toggle */}
      {inv.uniqueWineCount < inv.wines.length && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={inv.groupDuplicates}
            onChange={(e) => inv.setGroupDuplicates(e.target.checked)}
            className="rounded border-border"
          />
          Group duplicates
        </label>
      )}

      <TypeFilterBadges
        wines={inv.wines}
        selectedType={inv.selectedType}
        onSelectType={inv.setSelectedType}
        wineTextColors={wineTextColors}
      />

      <TagFilterBadges
        allTags={inv.allTags}
        selectedTags={inv.selectedTags}
        onSetSelectedTags={inv.setSelectedTags}
      />

      <SelectAllBar
        selectMode={inv.selectMode}
        filteredCount={inv.filteredWines.length}
        selectedCount={inv.selectedWineIds.size}
        onSelectAll={inv.selectAll}
        onDeselectAll={inv.deselectAll}
      />

      {/* Wine display */}
      {inv.viewMode === "gallery" ? (
        <LabelGallery
          wines={inv.wines}
          selectedType={inv.selectedType}
          onSelectType={inv.setSelectedType}
          wineTextColors={wineTextColors}
          onWineClick={inv.handleWineClick}
        />
      ) : inv.filteredWines.length > 0 ? (
        inv.groupDuplicates && !inv.selectMode ? (
          // ── Grouped view ──
          inv.viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedList.visible.map((group) => (
                <WineGridItem
                  key={group.groupKey}
                  wine={group.wine}
                  cabinetName={getCabinetName(group.wine, inv.cabinetMap)}
                  wineTextColors={wineTextColors}
                  formatPrice={formatPrice}
                  onClick={() => inv.handleWineClick(group.wine)}
                  onLongPress={() => inv.handleWineLongPress(group.wine)}
                  groupCount={group.count}
                  groupTotalPrice={group.totalPrice}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {groupedList.visible.map((group) => (
                <WineListItem
                  key={group.groupKey}
                  wine={group.wine}
                  cabinetName={getCabinetName(group.wine, inv.cabinetMap)}
                  wineTextColors={wineTextColors}
                  formatPrice={formatPrice}
                  onClick={() => inv.handleWineClick(group.wine)}
                  onLongPress={() => inv.handleWineLongPress(group.wine)}
                  groupCount={group.count}
                  groupTotalPrice={group.totalPrice}
                />
              ))}
            </div>
          )
        ) : (
          // ── Ungrouped / select mode view ──
          inv.viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {flatList.visible.map((wine) => (
                <WineGridItem
                  key={wine.id}
                  wine={wine}
                  cabinetName={getCabinetName(wine, inv.cabinetMap)}
                  wineTextColors={wineTextColors}
                  formatPrice={formatPrice}
                  onClick={() =>
                    inv.selectMode
                      ? inv.toggleWineSelection(wine.id)
                      : inv.handleWineClick(wine)
                  }
                  onLongPress={inv.selectMode ? undefined : () => inv.handleWineLongPress(wine)}
                  selected={inv.selectedWineIds.has(wine.id)}
                  selectMode={inv.selectMode}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {flatList.visible.map((wine) => (
                <WineListItem
                  key={wine.id}
                  wine={wine}
                  cabinetName={getCabinetName(wine, inv.cabinetMap)}
                  wineTextColors={wineTextColors}
                  formatPrice={formatPrice}
                  onClick={() =>
                    inv.selectMode
                      ? inv.toggleWineSelection(wine.id)
                      : inv.handleWineClick(wine)
                  }
                  onLongPress={inv.selectMode ? undefined : () => inv.handleWineLongPress(wine)}
                  selected={inv.selectedWineIds.has(wine.id)}
                  selectMode={inv.selectMode}
                />
              ))}
            </div>
          )
        )
      ) : (
        inv.wines.length === 0 ? (
          <EmptyState
            icon={WineIcon}
            title="Your cellar is empty"
            description="Start by adding wines to your collection — scan a label, a barcode, or add one manually."
            action={{ label: "Add a wine", href: "/cellar" }}
          />
        ) : (
          <EmptyState
            icon={Search}
            title="No wines match your search"
            description="Try adjusting your search or filter criteria."
          />
        )
      )}

      {inv.viewMode !== "gallery" && activeList.hasMore && (
        <LoadMore
          onMore={activeList.showMore}
          remaining={activeList.remaining}
          sentinelRef={activeList.sentinelRef}
        />
      )}

      {/* Wine Detail Dialog */}
      {inv.selectedWine && (
        <>
          <WineDetailDialog
            wine={inv.selectedWine}
            open={inv.detailOpen}
            onOpenChange={inv.setDetailOpen}
            initialEditing={inv.initialEditing}
            onConsume={inv.startConsume}
            onUpdate={async (updates) => {
              await inv.handleEditWine(inv.selectedWine!.id, updates);
            }}
            onSave={inv.handleEditWine}
            onDuplicate={inv.handleDuplicate}
          />
          <ConsumeWineDialog
            wine={inv.selectedWine}
            open={inv.consumeOpen}
            onOpenChange={inv.setConsumeOpen}
            onConsume={inv.handleConsumeWine}
          />
        </>
      )}

      {/* Batch Actions Bar */}
      <BatchActionsBar
        selectedWines={inv.selectedWines}
        cabinets={inv.cabinets}
        allTags={inv.allTags}
        onClearSelection={inv.clearSelection}
        onBatchMove={inv.handleBatchMove}
        onBatchDelete={inv.handleBatchDelete}
        onBatchTag={inv.handleBatchTag}
        onBatchType={inv.handleBatchType}
      />
    </div>
  );
}
