"use client";

import { Fragment } from "react";
import {
  LayoutGrid,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CabinetGrid } from "@/components/cellar/cabinet-grid";
import { DropZone } from "@/components/cellar/drop-zone";
import { SectionEditorWrapper } from "@/components/cellar/section-editor-wrapper";
import { SectionEditHeader } from "@/components/cellar/section-edit-header";
import { RowConfigPopover } from "@/components/cellar/row-config-popover";
import { calcDraftCapacity, countOutOfBounds } from "@/lib/cellar-utils";
import type { Wine, Cabinet, StorageRow, RowSize, BottleSize } from "@/types/wine";

interface DraftSection {
  id: string;
  name: string;
  rows: number;
  cols: number;
  depth: number;
  storageRows: StorageRow[];
  rowSizes: RowSize[];
  sortOrder: number;
  isNew?: boolean;
}

interface EditModeViewProps {
  draftSections: DraftSection[];
  displayWines: Wine[];
  selectedWallId: string | null;
  selectedSectionId: string | null;
  activeRowPopover: {
    sectionId: string;
    rowIndex: number;
    anchorRect: DOMRect;
  } | null;
  onWineClick: (wine: Wine) => void;
  onWineDrop: (wineId: string, cabinetId: string, row: number, col: number) => void;
  onRowStorageDrop: (sectionId: string, rowIndex: number, type: "slots" | "bulk") => void;
  onRowCaseDrop: (sectionId: string, rowIndex: number, caseSize: number) => void;
  onRowClick: (sectionId: string, rowIndex: number, anchorRect: DOMRect) => void;
  onBulkZoneClick: (cabinetId: string, rowIndex: number, storageRow: StorageRow, sectionName: string) => void;
  onDropTemplate: (index: number, templateJson: string) => void;
  onDropReorder: (fromId: string, toIndex: number) => void;
  onUpdateDraft: (id: string, updates: Partial<DraftSection>) => void;
  onRowTypeChange: (type: "slots" | "bulk") => void;
  onRowStorageUpdate: (updates: Partial<StorageRow>) => void;
  onRowSizeChange: (maxSize: BottleSize) => void;
  onCloseRowPopover: () => void;
}

export function EditModeView({
  draftSections,
  displayWines,
  selectedWallId,
  selectedSectionId,
  activeRowPopover,
  onWineClick,
  onWineDrop,
  onRowStorageDrop,
  onRowCaseDrop,
  onRowClick,
  onBulkZoneClick,
  onDropTemplate,
  onDropReorder,
  onUpdateDraft,
  onRowTypeChange,
  onRowStorageUpdate,
  onRowSizeChange,
  onCloseRowPopover,
}: EditModeViewProps) {
  return (
    <div className="flex flex-wrap gap-y-6 items-stretch relative overflow-visible pb-14 pr-16">
      <DropZone
        index={0}
        onDropTemplate={onDropTemplate}
        onDropReorder={onDropReorder}
      />
      {draftSections.map((draft, idx) => {
        const tempCabinet: Cabinet = {
          id: draft.id,
          userId: "",
          wallId: selectedWallId || "",
          name: draft.name,
          rows: draft.rows,
          cols: draft.cols,
          depth: draft.depth,
          storageRows: draft.storageRows,
          sortOrder: draft.sortOrder,
        };
        const cabinetWines = draft.isNew
          ? []
          : displayWines.filter((w) => w.cabinetId === draft.id);

        const outOfBoundsCount = countOutOfBounds(draft, displayWines);
        const totalCap = calcDraftCapacity(draft);

        const isSelected = selectedSectionId === draft.id;
        const editHeaderNode = isSelected ? (
          <SectionEditHeader
            name={draft.name}
            depth={draft.depth}
            wineCount={cabinetWines.length}
            totalCapacity={totalCap}
            onNameChange={(name) => onUpdateDraft(draft.id, { name })}
            onDepthChange={(depth) => onUpdateDraft(draft.id, { depth })}
          />
        ) : undefined;

        return (
          <Fragment key={draft.id}>
            <SectionEditorWrapper
              sectionId={draft.id}
              outOfBoundsCount={outOfBoundsCount}
            >
              <CabinetGrid
                cabinet={tempCabinet}
                wines={cabinetWines}
                editable
                editHeader={editHeaderNode}
                onWineClick={onWineClick}
                onRowStorageDrop={(rowIndex, type) =>
                  onRowStorageDrop(draft.id, rowIndex, type)
                }
                onRowCaseDrop={(rowIndex, caseSize) =>
                  onRowCaseDrop(draft.id, rowIndex, caseSize)
                }
                onRowClick={(rowIndex, anchorRect) =>
                  onRowClick(draft.id, rowIndex, anchorRect)
                }
                onWineDrop={(wineId, row, col) =>
                  onWineDrop(wineId, draft.id, row, col)
                }
                onBulkZoneClick={(rowIndex, storageRow) =>
                  onBulkZoneClick(
                    draft.id,
                    rowIndex,
                    storageRow,
                    draft.name
                  )
                }
              />
            </SectionEditorWrapper>
            <DropZone
              index={idx + 1}
              onDropTemplate={onDropTemplate}
              onDropReorder={onDropReorder}
            />
          </Fragment>
        );
      })}
      {draftSections.length === 0 && (
        <Card className="border-dashed w-full">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <LayoutGrid className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No sections yet</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Drag a template from above to add your first section.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Row config popover */}
      {activeRowPopover &&
        (() => {
          const popoverDraft = draftSections.find(
            (s) => s.id === activeRowPopover.sectionId
          );
          if (!popoverDraft) return null;
          const popoverSR = popoverDraft.storageRows.find(
            (sr) => sr.row === activeRowPopover.rowIndex
          );
          const popoverType: "slots" | "bulk" = popoverSR ? "bulk" : "slots";
          return (
            <RowConfigPopover
              rowIndex={activeRowPopover.rowIndex}
              currentType={popoverType}
              storageRow={popoverSR}
              cols={popoverDraft.cols}
              depth={popoverDraft.depth}
              onChangeType={onRowTypeChange}
              onUpdateStorageRow={onRowStorageUpdate}
              rowMaxSize={
                popoverDraft.rowSizes.find(
                  (rs) => rs.row === activeRowPopover.rowIndex
                )?.maxSize ?? "standard"
              }
              onChangeRowMaxSize={onRowSizeChange}
              onClose={onCloseRowPopover}
              anchorRect={activeRowPopover.anchorRect}
            />
          );
        })()}
    </div>
  );
}
