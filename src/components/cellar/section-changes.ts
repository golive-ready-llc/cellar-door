// Canonical section (cabinet) diff — the one place that decides which section
// edits become creates, updates, and deletes.
//
// Two surfaces edit sections: the in-grid edit mode (edit-mode-context) and
// the Manage Sections dialog (section-settings-dialog). They used to carry
// private copies of this diff and had already drifted — the dialog's copy lost
// the rowSizes comparison, so its SectionChanges.rowSizes fields could never
// be emitted. Both now build SectionEntry lists and delegate here.

import type { StorageRow, RowSize } from "@/types/wine";

export interface SectionChanges {
  created: Array<{
    name: string;
    rows: number;
    cols: number;
    depth: number;
    storageRows: StorageRow[];
    rowSizes?: RowSize[];
    wallId: string;
    sortOrder: number;
  }>;
  updated: Array<{
    id: string;
    name?: string;
    rows?: number;
    cols?: number;
    depth?: number;
    storageRows?: StorageRow[];
    rowSizes?: RowSize[];
    sortOrder?: number;
  }>;
  deleted: string[];
}

/** The fields a section edit can change. */
export interface SectionSnapshot {
  name: string;
  rows: number;
  cols: number;
  depth: number;
  storageRows: StorageRow[];
  rowSizes: RowSize[];
  sortOrder: number;
}

/** One editable section: current values, the saved state it diverged from
 *  (null for never-saved sections), and its soft-delete flag. Adapters whose
 *  saved row vanished mid-edit should exclude the entry rather than pass a
 *  non-new entry with original null — the builder skips those defensively. */
export interface SectionEntry {
  id: string;
  current: SectionSnapshot;
  original: SectionSnapshot | null;
  isNew: boolean;
  markedForDelete: boolean;
}

function snapshotChanged(a: SectionSnapshot, b: SectionSnapshot): boolean {
  return (
    a.name !== b.name ||
    a.rows !== b.rows ||
    a.cols !== b.cols ||
    a.depth !== b.depth ||
    a.sortOrder !== b.sortOrder ||
    JSON.stringify(a.storageRows) !== JSON.stringify(b.storageRows) ||
    JSON.stringify(a.rowSizes) !== JSON.stringify(b.rowSizes)
  );
}

/** Any pending change? Cheaper sibling of buildSectionChanges for
 *  enable/disable-the-Save-button checks — must classify identically. */
export function sectionsHaveChanges(
  entries: SectionEntry[],
  deletedIds: string[] = []
): boolean {
  if (deletedIds.length > 0) return true;
  return entries.some(
    (e) =>
      (e.original !== null && e.markedForDelete) ||
      (!e.markedForDelete &&
        (e.isNew || snapshotChanged(e.current, e.original ?? e.current)))
  );
}

/** Build the create/update/delete changeset. `deletedIds` carries ids already
 *  removed from `entries` (edit mode drops rows outright); `markedForDelete`
 *  covers rows kept around for an undo affordance (the settings dialog). */
export function buildSectionChanges(
  entries: SectionEntry[],
  wallId: string,
  deletedIds: string[] = []
): SectionChanges {
  const deletedSet = new Set(deletedIds);
  const changes: SectionChanges = {
    created: [],
    updated: [],
    deleted: [...deletedIds],
  };

  for (const entry of entries) {
    const { id, current, markedForDelete } = entry;
    const dropped = markedForDelete || deletedSet.has(id);

    if (entry.isNew) {
      if (!dropped) {
        changes.created.push({
          name: current.name,
          rows: current.rows,
          cols: current.cols,
          depth: current.depth,
          storageRows: current.storageRows,
          rowSizes: current.rowSizes,
          wallId,
          sortOrder: current.sortOrder,
        });
      }
      continue;
    }

    const original = entry.original;
    // A saved row that disappeared mid-edit has nothing to diff against.
    if (!original) continue;

    if (dropped) {
      if (!deletedSet.has(id)) changes.deleted.push(id);
      continue;
    }

    if (!snapshotChanged(current, original)) continue;

    changes.updated.push({
      id,
      ...(current.name !== original.name && { name: current.name }),
      ...(current.rows !== original.rows && { rows: current.rows }),
      ...(current.cols !== original.cols && { cols: current.cols }),
      ...(current.depth !== original.depth && { depth: current.depth }),
      ...(current.sortOrder !== original.sortOrder && {
        sortOrder: current.sortOrder,
      }),
      ...(JSON.stringify(current.storageRows) !==
        JSON.stringify(original.storageRows) && {
        storageRows: current.storageRows,
      }),
      ...(JSON.stringify(current.rowSizes) !==
        JSON.stringify(original.rowSizes) && { rowSizes: current.rowSizes }),
    });
  }

  return changes;
}
