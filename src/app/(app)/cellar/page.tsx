"use client";

import { useEffect, useMemo, useCallback, useState, useDeferredValue } from "react";
import { UtensilsCrossed, Wine, GlassWater, Search, ArrowDownUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  EditModeProvider,
} from "@/components/cellar/edit-mode-context";
import { DragDropProvider } from "@/components/cellar/drag-drop-context";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { TemplatePalette } from "@/components/cellar/template-palette";
import { UnfiledWines } from "@/components/cellar/unfiled-wines";
import { useAddWine } from "@/components/add-wine-context";

import { useCellar } from "@/hooks/use-cellar";
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
  const store = useCellar();
  const { data, dialogs, actions, mode } = store;
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

  const [corkForkOpen, setCorkForkOpen] = useState(false);
  const [sommelierOpen, setSommelierOpen] = useState(false);
  const [pourCostOpen, setPourCostOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { canUseAi, hasAI } = useTier();

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

  // --- Search/filter ---
  // The filter runs on a deferred value so a keystroke doesn't re-render the
  // whole cellar grid at input priority: the search box updates instantly and
  // the grid catches up at low priority, skipping intermediate filters when
  // typing fast. ViewModeGrid is memoized, so while the deferred value is
  // unchanged those keystroke renders skip the grid entirely.
  const deferredSearch = useDeferredValue(searchQuery);
  const filteredWines = useMemo(() => {
    if (!deferredSearch.trim()) return data.displayWines;
    const q = deferredSearch.toLowerCase();
    return data.displayWines.filter(
      (w) =>
        w.name?.toLowerCase().includes(q) ||
        w.winery?.toLowerCase().includes(q)
    );
  }, [deferredSearch, data.displayWines]);

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

  const { setPendingSlot, setAddWineOpen } = dialogs;
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

  // Stable handlers for ViewModeGrid: it is memoized, and a fresh closure per
  // render would defeat that and re-render the whole grid on every keystroke.
  const handleSlotClick = useCallback(
    (cabinetId: string, row: number, col: number) => {
      setPendingSlot({ cabinetId, row, col });
      setAddWineOpen(true);
    },
    [setPendingSlot, setAddWineOpen]
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
          onWineDrop={mode.handleWineMoveInMode}
          onSlotClick={handleSlotClick}
          onDepthSlotClick={dialogs.handleDepthSlotClick}
          onBulkZoneClick={dialogs.handleBulkZoneClick}
          onEnterEditMode={mode.handleEnterEditMode}
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
      <CellarDialogs store={store} />

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
