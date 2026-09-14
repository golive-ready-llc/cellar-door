import type { Wine, StorageRow } from "@/types/wine";
import type { ReactNode } from "react";

export interface CabinetGridProps {
  cabinet: import("@/types/wine").Cabinet;
  wines: Wine[];
  onWineClick?: (wine: Wine) => void;
  /** Called on long-press of a wine slot — receives wine and pointer position for immediate drag */
  onWineLongPress?: (wine: Wine, position: { x: number; y: number }) => void;
  onSlotClick?: (row: number, col: number) => void;
  /** Called when a slot in a deep rack is clicked (depth >= 2) */
  onDepthSlotClick?: (row: number, col: number, wines: Wine[]) => void;
  compact?: boolean;
  /** Edit mode: render editHeader instead of static header, wrap rows in EditableRow */
  editable?: boolean;
  /** Move-only mode: enable wine drag/drop without structural editing UI
   *  (no EditableRow wrappers, no dark-red interior, no edit header) */
  moveOnly?: boolean;
  /** Custom header content (name input + depth) rendered in the wood frame during edit */
  editHeader?: ReactNode;
  /** Called when a storage type is dropped onto a row */
  onRowStorageDrop?: (rowIndex: number, type: "slots" | "bulk") => void;
  /** Called when a case size is dropped onto a row */
  onRowCaseDrop?: (rowIndex: number, caseSize: number) => void;
  /** Called when a row's type badge is clicked */
  onRowClick?: (rowIndex: number, anchorRect: DOMRect) => void;
  /** Called when a wine is dropped onto an empty slot in this cabinet (edit mode) */
  onWineDrop?: (wineId: string, targetRow: number, targetCol: number) => void;
  /** Called when a bulk storage zone is clicked (to open side view) */
  onBulkZoneClick?: (rowIndex: number, storageRow: StorageRow, wines: Wine[]) => void;
  /** Wine ID to highlight with a pulsing ring (e.g. from search deep-link).
   *  Callers scope this to THIS cabinet — ViewModeGrid passes null everywhere
   *  else so the memoized grid skips cabinets the flash doesn't touch. */
  highlightedWineId?: string | null;
  /** An EMPTY slot to glow gold (e.g. the destination in the sort assistant).
   *  Scoped to this cabinet by the caller, like highlightedWineId. */
  highlightedSlot?: HighlightSlot | null;
}

/** Position of a slot to glow even when it's empty. */
export interface HighlightSlot {
  cabinetId: string;
  row: number;
  col: number;
}

export interface WineSlotProps {
  cabinetId: string;
  wine: Wine | undefined;
  allWines: Wine[];
  depth: number;
  compact: boolean;
  onClick?: () => void;
  onLongPress?: (position: { x: number; y: number }) => void;
  suppressTooltip?: boolean;
  editable?: boolean;
  onWineDrop?: (wineId: string, targetRow: number, targetCol: number) => void;
  rowIndex?: number;
  colIndex?: number;
  highlighted?: boolean;
  /** Glow this slot even when empty (sort-assistant destination). */
  slotHighlighted?: boolean;
}

export interface GridRowProps {
  cabinetId: string;
  rowIndex: number;
  cols: number;
  depth: number;
  wineMap: Map<string, Wine[]>;
  compact: boolean;
  onWineClick?: (wine: Wine) => void;
  onWineLongPress?: (wine: Wine, position: { x: number; y: number }) => void;
  onSlotClick?: (row: number, col: number) => void;
  onDepthSlotClick?: (row: number, col: number, wines: Wine[]) => void;
  isLastRow: boolean;
  suppressTooltip?: boolean;
  editable?: boolean;
  onWineDrop?: (wineId: string, targetRow: number, targetCol: number) => void;
  /** Column of the pulsing highlight in THIS row, or null when the highlight
   *  is elsewhere. Precomputed by CabinetGrid so rows the flash doesn't touch
   *  can memo-bail out instead of re-rendering every slot. */
  highlightedCol: number | null;
  /** Column of the gold empty-slot glow in THIS row, or null. */
  slotHighlightCol: number | null;
}

export interface EditableRowProps {
  cabinetId?: string;
  rowIndex: number;
  currentType: "slots" | "bulk";
  onDrop?: (rowIndex: number, type: "slots" | "bulk") => void;
  onCaseDrop?: (rowIndex: number, caseSize: number) => void;
  onClick?: (rowIndex: number, anchorRect: DOMRect) => void;
  children: ReactNode;
}

export interface BulkStorageZoneProps {
  cabinetId: string;
  rowIndex: number;
  storageRow: StorageRow;
  wines: Wine[];
  onWineClick?: (wine: Wine) => void;
  /** Called on long-press of a loose bottle — triggers move mode on mobile */
  onWineLongPress?: (wine: Wine, position: { x: number; y: number }) => void;
  onAddClick?: () => void;
  suppressTooltip?: boolean;
  editable?: boolean;
  onBulkZoneClick?: () => void;
  onWineDrop?: (wineId: string, targetCol: number) => void;
  highlightedWineId?: string | null;
}

export interface LooseBottleProps {
  wine: Wine;
  editable?: boolean;
  suppressTooltip?: boolean;
  highlighted?: boolean;
  onWineClick?: (wine: Wine) => void;
  /** Called on long-press of a loose bottle */
  onWineLongPress?: (wine: Wine, position: { x: number; y: number }) => void;
  onBulkZoneClick?: () => void;
}

export interface CaseBoxVisualProps {
  cabinetId: string;
  rowIndex: number;
  boxIndex: number;
  boxSize: number;
  winesInBox: Wine[];
  colOffset: number;
  editable?: boolean;
  boxIsFull: boolean;
  onBulkZoneClick?: () => void;
  onWineClick?: (wine: Wine) => void;
  onAddClick?: () => void;
  onWineDrop?: (wineId: string, targetCol: number) => void;
}
