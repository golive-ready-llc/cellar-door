"use client";

import { useEffect, useMemo, useCallback, useState } from "react";
import { UtensilsCrossed, Wine, GlassWater, Search, ArrowDownUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { editWine } from "@/lib/data";
import {
  EditModeProvider,
} from "@/components/cellar/edit-mode-context";
import { DragDropProvider } from "@/components/cellar/drag-drop-context";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { TemplatePalette } from "@/components/cellar/template-palette";
import { UnfiledWines } from "@/components/cellar/unfiled-wines";
import { useAddWine } from "@/components/add-wine-context";

import { useCellarData } from "@/hooks/use-cellar-data";
import { useCellarActions } from "@/hooks/use-cellar-actions";
import { useCellarDialogs } from "@/hooks/use-cellar-dialogs";
import { useCellarMode } from "@/hooks/use-cellar-mode";
import { useTier } from "@/hooks/use-tier";
import { useWineData } from "@/contexts/wine-data-context";

import { CellarHeader } from "@/components/cellar/cellar-header";
import { CorkAndForkDialog } from "@/components/wine/cork-and-fork-dialog";
import { SommelierModeDialog } from "@/components/cellar/sommelier-mode-dialog";
import { PourCostDialog } from "@/components/wine/pour-cost-dialog";
import { WallToolbar } from "@/components/cellar/wall-toolbar";
import { EditModeView } from "@/components/cellar/edit-mode-view";
import { ViewModeGrid } from "@/components/cellar/view-mode-grid";
import { CellarDialogs } from "@/components/cellar/cellar-dialogs";
import { FloatingModeIndicator } from "@/components/cellar/floating-mode-indicator";
import { OnboardingWizard, shouldShowOnboarding } from "@/components/onboarding/onboarding-wizard";
import { useAuth } from "@/components/auth-provider";
import { PeakingBanner } from "@/components/cellar/peaking-banner";
import { SortAssistant } from "@/components/cellar/sort-assistant";
import { AppLoading } from "@/components/app-loading";

export default function CellarPage() {
  return (
    <EditModeProvider>
      <DragDropProvider>
        <CellarPageInner />
      </DragDropProvider>
    </EditModeProvider>
  );
}

function CellarPageInner() {
  // --- Data ---
  const data = useCellarData();
  const { setWineData } = useWineData();

  // Push cellar data into the shared WineDataContext so any
  // WineDetailDialog rendered downstream (chat wrapper, search results)
  // sees the same wines/cabinets/walls/tags as the cellar grid.
  useEffect(() => {
    setWineData({
      wines: data.wines,
      cabinets: data.cabinets,
      walls: data.walls,
      allTags: data.allTags,
    });
  }, [data.wines, data.cabinets, data.walls, data.allTags, setWineData]);

  // --- Dialogs ---
  const dialogs = useCellarDialogs();
  const [corkForkOpen, setCorkForkOpen] = useState(false);
  const [sommelierOpen, setSommelierOpen] = useState(false);
  const [pourCostOpen, setPourCostOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { canUseAi, hasAI } = useTier();

  // --- Actions ---
  const actions = useCellarActions({
    userId: data.userId,
    wines: data.wines,
    setWines: data.setWines,
    setCabinets: data.setCabinets,
    setWalls: data.setWalls,
    selectedWallId: data.selectedWallId,
    setSelectedWallId: data.setSelectedWallId,
    pendingSlot: dialogs.pendingSlot,
    setPendingSlot: dialogs.setPendingSlot,
    setSelectedWine: dialogs.setSelectedWine,
    setDetailOpen: dialogs.setDetailOpen,
    selectedWine: dialogs.selectedWine,
    // Flash a slot when a wine lands in it (add / place / move) so you can see
    // where the bottle in your hand goes. Reuses the deep-link highlight.
    highlightWine: data.setHighlightWithTimer,
  });

  // --- Mode (edit/move) ---
  const mode = useCellarMode({
    userId: data.userId,
    wines: data.wines,
    selectedWallId: data.selectedWallId,
    setCabinets: data.setCabinets,
    wallCabinets: data.wallCabinets,
    handleSectionChanges: actions.handleSectionChanges,
    handleWineMove: actions.handleWineMove,
    setBulkConfigInsertIndex: dialogs.setBulkConfigInsertIndex,
    setBulkConfigOpen: dialogs.setBulkConfigOpen,
  });

  // --- Deep link: open detail on load ---
  // Destructure stable setters/consumers so the effect only re-runs when
  // loading flips, not when the parent hook objects get new references.
  const { loading: dataLoading, consumeDeepLink, setHighlightWithTimer } = data;
  const { setSelectedWine, setDetailOpen } = dialogs;
  useEffect(() => {
    if (dataLoading) return;
    const wine = consumeDeepLink();
    if (wine) {
      setSelectedWine(wine);
      setDetailOpen(true);
      if (wine.cabinetId) {
        setHighlightWithTimer(wine.id);
      }
    }
  }, [dataLoading, consumeDeepLink, setHighlightWithTimer, setSelectedWine, setDetailOpen]);

  // --- Bulk zone drop handler ---
  const { bulkZoneView: dialogsBulkZoneView } = dialogs;
  const { wines: dataWines, userId: dataUserId, setWines: dataSetWines } = data;
  const handleBulkZoneDrop = useCallback(
    async (wineId: string) => {
      const bz = dialogsBulkZoneView;
      if (!bz || bz.cabinetId.startsWith("__new_")) return;
      const existingInZone = dataWines.filter(
        (w) => w.cabinetId === bz.cabinetId && w.row === bz.rowIndex
      );
      if (existingInZone.length >= bz.storageRow.capacity) return;
      const usedCols = new Set(existingInZone.map((w) => w.col ?? 0));
      const boxes = bz.storageRow.boxes;
      const hasBoxes = boxes && boxes.length > 0;
      const totalBoxCap = hasBoxes
        ? boxes.reduce((s, b) => s + b, 0)
        : 0;
      let nextCol = totalBoxCap;
      while (usedCols.has(nextCol)) nextCol++;
      await editWine(
        wineId,
        { cabinetId: bz.cabinetId, row: bz.rowIndex, col: nextCol, depth: 0 },
        dataUserId
      );
      dataSetWines((prev) =>
        prev.map((w) =>
          w.id === wineId
            ? { ...w, cabinetId: bz.cabinetId, row: bz.rowIndex, col: nextCol, depth: 0 }
            : w
        )
      );
      // Flash the bottle in its new bulk-zone home.
      setHighlightWithTimer(wineId);
    },
    [dialogsBulkZoneView, dataWines, dataUserId, dataSetWines, setHighlightWithTimer]
  );

  // --- Bulk zone wines (reactive) ---
  const { getBulkZoneWines } = dialogs;
  const bulkZoneWines = useMemo(
    () => getBulkZoneWines(data.wines),
    [getBulkZoneWines, data.wines]
  );

  // --- Search/filter ---
  const filteredWines = useMemo(() => {
    if (!searchQuery.trim()) return data.displayWines;
    const q = searchQuery.toLowerCase();
    return data.displayWines.filter(
      (w) =>
        w.name?.toLowerCase().includes(q) ||
        w.winery?.toLowerCase().includes(q)
    );
  }, [searchQuery, data.displayWines]);

  // --- Onboarding wizard ---
  // First-run setup shows only for a loaded, empty account that hasn't
  // finished setup on any device (the flag lives on the account), and never
  // in demo mode. Derived, not stored, so it can't get stuck open or closed.
  const { demoMode } = useAuth();
  const [onboardingClosed, setOnboardingClosed] = useState(false);
  const [onboardingFinishing, setOnboardingFinishing] = useState(false);
  const showOnboarding =
    !onboardingClosed &&
    (onboardingFinishing ||
      shouldShowOnboarding({
        loading: data.loading,
        onboarded: data.onboarded,
        wineCount: data.wines.length,
        demoMode,
      }));
  const { completeOnboarding } = data;
  const handleOnboardingFinish = useCallback(
    (cellarName: string) => {
      // Keep the wizard up for its closing animation while the account saves.
      setOnboardingFinishing(true);
      void completeOnboarding(cellarName).catch(() => {});
    },
    [completeOnboarding]
  );

  const { setAddWineOpen } = dialogs;
  const handleOnboardingAddWine = useCallback(
    (_method: "scan" | "search" | "manual") => {
      // Open the AddWineDialog — the method picker inside it handles scan/search/manual
      setAddWineOpen(true);
    },
    [setAddWineOpen]
  );

  // --- Register with global FAB context ---
  const { register: registerAddWine } = useAddWine();
  const { handleAddWine, handlePlaceWine } = actions;
  const { triggerWineListScan } = dialogs;
  useEffect(() => {
    registerAddWine({
      cabinets: data.wallCabinets,
      onAdd: handleAddWine,
      allTags: data.allTags,
      unfiledWines: data.unfiledWines,
      onPlaceWine: handlePlaceWine,
      onScanWineList: triggerWineListScan,
    });
  }, [data.wallCabinets, data.allTags, data.unfiledWines, handleAddWine, handlePlaceWine, triggerWineListScan, registerAddWine]);

  // --- Show-in-cellar handler for detail dialog ---
  const { scrollToWineInCellar } = data;
  const handleShowInCellar = useCallback(
    (wine: import("@/types/wine").Wine) => {
      setDetailOpen(false);
      setTimeout(() => scrollToWineInCellar(wine), 300);
    },
    [scrollToWineInCellar, setDetailOpen]
  );

  // --- Sort assistant: apply one guided move (dest=null → set aside/unfile) ---
  const { handleWineMove, handleUnfileWine } = actions;
  const handleSortMove = useCallback(
    async (
      wineId: string,
      dest: { cabinetId: string; row: number; col: number } | null
    ) => {
      if (dest) await handleWineMove(wineId, dest.cabinetId, dest.row, dest.col);
      else await handleUnfileWine(wineId);
    },
    [handleWineMove, handleUnfileWine]
  );

  // --- Loading state ---
  if (data.loading) {
    return <AppLoading stage="Loading your cellar…" phase={2} />;
  }

  return (
    <PullToRefresh onRefresh={data.refreshData} className="space-y-3 overflow-x-hidden">
      <CellarHeader
        displayName={data.displayName}
        editingName={data.editingName}
        onStartEditName={() => data.setEditingName(true)}
        onNameSave={data.handleNameSave}
        onCancelEditName={() => data.setEditingName(false)}
        totalBottles={data.stats.totalBottles}
        totalCapacity={data.stats.totalCapacity}
        totalValue={data.stats.totalValue}
        profitLoss={data.stats.profitLoss}
        wines={data.wines}
        selectedType={data.selectedType}
        onTypeChange={data.setSelectedType}
      />

      {/* AI feature quick actions — kept on a single horizontal row even
          on narrow phones. Labels would otherwise wrap onto two rows, which
          looked busy and used vertical space we'd rather give to the cellar
          grid. Container is overflow-x-auto with a tiny scrollbar hidden
          via .scrollbar-none so users with extra-tight viewports can flick
          to reveal anything offscreen. min-h-9 + py-1.5 still gives a 36px
          touch target so the smaller padding doesn't hurt fat-finger taps. */}
      {/* First-of-month peak digest — counterpart to the native
          "Open Cellar Door…" notification, hidden on edit/move modes
          and after the first 7 days. */}
      {data.wines.length > 0 && !mode.editMode && !mode.moveMode && <PeakingBanner />}

      {hasAI && data.wines.length > 0 && !mode.editMode && !mode.moveMode && (
        <div className="flex flex-nowrap items-center gap-2 -mt-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4">
          <button
            onClick={() => setCorkForkOpen(true)}
            className="shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border border-amber-200/50 dark:border-amber-800/50 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 active:scale-95 transition-all min-h-9 whitespace-nowrap"
            title="Cork & Fork — meal pairing"
          >
            <UtensilsCrossed className="h-3.5 w-3.5" />
            <span>Cork &amp; Fork</span>
          </button>
          <button
            onClick={() => setPourCostOpen(true)}
            className="shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border border-purple-200/50 dark:border-purple-800/50 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 active:scale-95 transition-all min-h-9 whitespace-nowrap"
            title="Wine Tasting — plan a tasting event"
          >
            <GlassWater className="h-3.5 w-3.5" />
            <span>Wine Tasting</span>
          </button>
          {canUseAi("sommelierMode") && (
            <button
              onClick={() => setSommelierOpen(true)}
              className="shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border border-purple-200/50 dark:border-purple-800/50 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 active:scale-95 transition-all min-h-9 whitespace-nowrap"
              title="Sommelier Mode — let guests vote"
            >
              <Wine className="h-3.5 w-3.5" />
              <span>Sommelier</span>
            </button>
          )}
        </div>
      )}

      {/* Inline search + Organize trigger */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search wines..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        {data.wines.length > 1 && !mode.editMode && !mode.moveMode && (
          <button
            onClick={() => setSortOpen(true)}
            className="shrink-0 flex items-center gap-1.5 text-xs px-3 h-9 rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all whitespace-nowrap"
            title="Sort assistant — group bottles and guide the moves"
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
            <span>Organize</span>
          </button>
        )}
      </div>

      <WallToolbar
        walls={data.walls}
        locationWalls={data.locationWalls}
        locations={data.locations}
        selectedWallId={data.selectedWallId}
        selectedLocation={data.selectedLocation}
        editMode={mode.editMode}
        moveMode={mode.moveMode}
        saving={mode.saving}
        showDiscardConfirm={mode.showDiscardConfirm}
        onWallSelect={data.setSelectedWallId}
        onLocationSelect={data.setSelectedLocation}
        onWallChanges={actions.handleWallChanges}
        onWallsChanged={data.loadData}
        onEnterEditMode={() => mode.handleEnterEditMode()}
        onSaveEditMode={mode.handleSaveEditMode}
        onCancelEditMode={mode.handleCancelEditMode}
        onExitMoveMode={() => mode.setMoveMode(false)}
        onShowDiscardConfirm={mode.setShowDiscardConfirm}
      />

      {/* Template palette (edit mode only) */}
      {mode.editMode && (
        <TemplatePalette
          onClickAdd={(templateJson) =>
            mode.handleDropTemplate(mode.draftSections.length, templateJson)
          }
        />
      )}

      {/* Main content area */}
      {mode.editMode ? (
        <EditModeView
          draftSections={mode.draftSections}
          displayWines={data.displayWines}
          selectedWallId={data.selectedWallId}
          selectedSectionId={mode.selectedSectionId}
          activeRowPopover={mode.activeRowPopover}
          onWineClick={actions.handleWineClick}
          onWineDrop={(wineId, cabinetId, row, col) =>
            mode.handleWineMoveInMode(wineId, cabinetId, row, col)
          }
          onRowStorageDrop={mode.handleRowStorageDrop}
          onRowCaseDrop={mode.handleRowCaseDrop}
          onRowClick={mode.handleRowClick}
          onBulkZoneClick={(cabinetId, rowIndex, storageRow, sectionName) =>
            dialogs.handleBulkZoneClick(cabinetId, rowIndex, storageRow, sectionName)
          }
          onDropTemplate={mode.handleDropTemplate}
          onDropReorder={mode.handleDropReorder}
          onUpdateDraft={mode.updateDraft}
          onRowTypeChange={mode.handleRowTypeChange}
          onRowStorageUpdate={mode.handleRowStorageUpdate}
          onRowSizeChange={mode.handleRowSizeChange}
          onCloseRowPopover={() => mode.setActiveRowPopover(null)}
        />
      ) : (
        <ViewModeGrid
          wallCabinets={data.wallCabinets}
          walls={data.walls}
          cabinets={data.cabinets}
          displayWines={filteredWines}
          moveMode={mode.moveMode}
          highlightedWineId={data.highlightedWineId}
          highlightedSlot={data.highlightedSlot}
          allTags={data.allTags}
          onWineClick={actions.handleWineClick}
          onWineLongPress={mode.handleWineLongPress}
          onWineDrop={(wineId, cabinetId, row, col) =>
            mode.handleWineMoveInMode(wineId, cabinetId, row, col)
          }
          onSlotClick={(cabinetId, row, col) => {
            dialogs.setPendingSlot({ cabinetId, row, col });
            dialogs.setAddWineOpen(true);
          }}
          onDepthSlotClick={(cabinetId, row, col, winesAtPos, depth, sectionName) =>
            dialogs.handleDepthSlotClick(cabinetId, row, col, winesAtPos, depth, sectionName)
          }
          onBulkZoneClick={(cabinetId, rowIndex, storageRow, sectionName) =>
            dialogs.handleBulkZoneClick(cabinetId, rowIndex, storageRow, sectionName)
          }
          onEnterEditMode={() => mode.handleEnterEditMode()}
          onWallChanges={actions.handleWallChanges}
          onWallsChanged={data.loadData}
          onAddWine={actions.handleAddWine}
        />
      )}

      {/* Unfiled wines */}
      <UnfiledWines
        wines={data.unfiledWines}
        onWineClick={actions.handleWineClick}
        onWineLongPress={mode.handleWineLongPress}
        editable={mode.editMode || mode.moveMode}
        onWineDrop={actions.handleUnfileWine}
        onClearAll={() => actions.handleClearUnfiled(data.unfiledWines)}
      />

      {/* All dialogs */}
      <CellarDialogs
        selectedWine={dialogs.selectedWine}
        detailOpen={dialogs.detailOpen}
        onDetailOpenChange={dialogs.setDetailOpen}
        onTriggerConsume={dialogs.triggerConsume}
        onEditWine={actions.handleEditWine}
        onAddBottle={actions.handleAddBottle}
        onDuplicate={actions.handleDuplicateWine}
        onShowInCellar={handleShowInCellar}
        cabinets={data.cabinets}
        walls={data.walls}
        allTags={data.allTags}
        wines={data.wines}
        consumeOpen={dialogs.consumeOpen}
        onConsumeOpenChange={dialogs.setConsumeOpen}
        onConsume={actions.handleConsumeWine}
        addWineOpen={dialogs.addWineOpen}
        onAddWineOpenChange={dialogs.setAddWineOpen}
        wallCabinets={data.wallCabinets}
        onAddWine={actions.handleAddWine}
        unfiledWines={data.unfiledWines}
        onPlaceWine={actions.handlePlaceWine}
        pendingSlot={dialogs.pendingSlot}
        onClearPendingSlot={() => dialogs.setPendingSlot(null)}
        onScanWineList={dialogs.triggerWineListScan}
        wineListScanOpen={dialogs.wineListScanOpen}
        onWineListScanOpenChange={dialogs.setWineListScanOpen}
        depthView={dialogs.depthView}
        depthViewOpen={dialogs.depthViewOpen}
        onDepthViewOpenChange={dialogs.setDepthViewOpen}
        onDepthWineClick={(wine) => {
          dialogs.setDepthViewOpen(false);
          setTimeout(() => actions.handleWineClick(wine), 200);
        }}
        onDepthWineLongPress={() => {
          dialogs.setDepthViewOpen(false);
          setTimeout(() => mode.handleWineLongPress(), 200);
        }}
        onDepthEmptySlotClick={() => {
          dialogs.setDepthViewOpen(false);
          if (dialogs.depthView) {
            dialogs.setPendingSlot({
              cabinetId: dialogs.depthView.cabinetId,
              row: dialogs.depthView.row,
              col: dialogs.depthView.col,
            });
          }
          setTimeout(() => dialogs.setAddWineOpen(true), 200);
        }}
        bulkZoneView={dialogs.bulkZoneView}
        bulkZoneViewOpen={dialogs.bulkZoneViewOpen}
        onBulkZoneViewOpenChange={dialogs.setBulkZoneViewOpen}
        bulkZoneWines={bulkZoneWines}
        editableZone={mode.editMode || mode.moveMode}
        onBulkZoneWineClick={(wine) => {
          dialogs.setBulkZoneViewOpen(false);
          setTimeout(() => actions.handleWineClick(wine), 200);
        }}
        onBulkZoneWineLongPress={() => {
          dialogs.setBulkZoneViewOpen(false);
          setTimeout(() => mode.handleWineLongPress(), 200);
        }}
        onBulkZoneDrop={handleBulkZoneDrop}
        onBulkZoneWineRemove={actions.handleUnfileWine}
        onBatchRemove={actions.handleBatchRemoveWines}
        bulkConfigOpen={dialogs.bulkConfigOpen}
        onBulkConfigOpenChange={dialogs.setBulkConfigOpen}
        onBulkConfigConfirm={mode.handleBulkConfigConfirm}
      />

      {/* Floating mode indicator */}
      <FloatingModeIndicator
        moveMode={mode.moveMode}
        editMode={mode.editMode}
        saving={mode.saving}
        onExitMoveMode={() => mode.setMoveMode(false)}
        onSaveEditMode={mode.handleSaveEditMode}
        onShowDiscardConfirm={mode.setShowDiscardConfirm}
      />

      {/* Guided sort assistant — floating, non-modal so the cellar glow shows */}
      {sortOpen && (
        <SortAssistant
          wines={data.wines}
          cabinets={data.cabinets}
          walls={data.walls}
          selectedWallId={data.selectedWallId}
          onApplyMove={handleSortMove}
          onHighlight={data.setSortHighlight}
          onClearHighlight={data.clearSortHighlight}
          onSelectWall={data.setSelectedWallId}
          onClose={() => setSortOpen(false)}
        />
      )}

      {/* Cork & Fork dialog */}
      <CorkAndForkDialog
        open={corkForkOpen}
        onOpenChange={setCorkForkOpen}
        wines={data.wines}
        onWineClick={(wine) => {
          setCorkForkOpen(false);
          setTimeout(() => actions.handleWineClick(wine), 200);
        }}
      />

      {/* Pour Cost dialog */}
      <PourCostDialog
        open={pourCostOpen}
        onOpenChange={setPourCostOpen}
        wines={data.wines}
        onWineClick={(wine) => {
          setPourCostOpen(false);
          setTimeout(() => actions.handleWineClick(wine), 200);
        }}
      />

      {/* Sommelier Mode dialog */}
      <SommelierModeDialog
        open={sommelierOpen}
        onOpenChange={setSommelierOpen}
      />

      {/* Onboarding wizard for first-time users */}
      {showOnboarding && (
        <OnboardingWizard
          onAddWine={handleOnboardingAddWine}
          onFinish={handleOnboardingFinish}
          onComplete={() => setOnboardingClosed(true)}
        />
      )}
    </PullToRefresh>
  );
}
