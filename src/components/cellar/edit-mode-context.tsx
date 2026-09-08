"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Cabinet, StorageRow, RowSize } from "@/types/wine";
import type { SectionChanges } from "./section-settings-dialog";

interface DraftSection {
  id: string; // temp id for new sections
  name: string;
  rows: number;
  cols: number;
  depth: number;
  storageRows: StorageRow[];
  rowSizes: RowSize[];
  sortOrder: number;
  isNew: boolean;
}

interface EditModeContextValue {
  editMode: boolean;
  setEditMode: (on: boolean) => void;
  selectedSectionId: string | null;
  selectSection: (id: string | null) => void;
  // Draft state: working copies of cabinets during edit mode
  draftSections: DraftSection[];
  initDrafts: (cabinets: Cabinet[]) => void;
  updateDraft: (id: string, updates: Partial<DraftSection>) => void;
  addDraft: (section: DraftSection) => void;
  removeDraft: (id: string) => void;
  reorderDraft: (fromId: string, toIndex: number) => void;
  // Build final SectionChanges from drafts vs original cabinets
  buildChanges: (originalCabinets: Cabinet[], wallId: string) => SectionChanges;
  hasPendingChanges: (originalCabinets: Cabinet[]) => boolean;
  deletedIds: string[];
}

const EditModeContext = createContext<EditModeContextValue | null>(null);

export function useEditMode() {
  const ctx = useContext(EditModeContext);
  if (!ctx)
    throw new Error("useEditMode must be used within EditModeProvider");
  return ctx;
}

let tempIdCounter = 0;
export function generateTempId() {
  return `__new_${++tempIdCounter}_${Date.now()}`;
}

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [editMode, setEditMode] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null
  );
  const [draftSections, setDraftSections] = useState<DraftSection[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const selectSection = useCallback((id: string | null) => {
    setSelectedSectionId((prev) => (prev === id ? null : id));
  }, []);

  const initDrafts = useCallback((cabinets: Cabinet[]) => {
    setDraftSections(
      cabinets
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => ({
          id: c.id,
          name: c.name,
          rows: c.rows,
          cols: c.cols,
          depth: c.depth,
          storageRows: c.storageRows,
          rowSizes: c.rowSizes ?? [],
          sortOrder: c.sortOrder,
          isNew: false,
        }))
    );
    setDeletedIds([]);
    setSelectedSectionId(null);
  }, []);

  const updateDraft = useCallback(
    (id: string, updates: Partial<DraftSection>) => {
      setDraftSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
    },
    []
  );

  const addDraft = useCallback((section: DraftSection) => {
    setDraftSections((prev) => [...prev, section]);
  }, []);

  const removeDraft = useCallback(
    (id: string) => {
      setDraftSections((prev) => prev.filter((s) => s.id !== id));
      if (!id.startsWith("__new_")) {
        setDeletedIds((prev) => [...prev, id]);
      }
      if (selectedSectionId === id) {
        setSelectedSectionId(null);
      }
    },
    [selectedSectionId]
  );

  const reorderDraft = useCallback((fromId: string, toIndex: number) => {
    setDraftSections((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((s) => s.id === fromId);
      if (fromIdx === -1) return prev;
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIndex, 0, item);
      // Update sortOrder based on new positions
      return arr.map((s, i) => ({ ...s, sortOrder: i }));
    });
  }, []);

  const buildChanges = useCallback(
    (originalCabinets: Cabinet[], wallId: string): SectionChanges => {
      const changes: SectionChanges = {
        created: [],
        updated: [],
        deleted: [...deletedIds],
      };

      for (const draft of draftSections) {
        if (draft.isNew) {
          changes.created.push({
            name: draft.name,
            rows: draft.rows,
            cols: draft.cols,
            depth: draft.depth,
            storageRows: draft.storageRows,
            rowSizes: draft.rowSizes,
            wallId,
            sortOrder: draft.sortOrder,
          });
        } else {
          const orig = originalCabinets.find((c) => c.id === draft.id);
          if (!orig) continue;
          const updates: Record<string, unknown> = { id: draft.id };
          let hasChange = false;
          if (draft.name !== orig.name) {
            updates.name = draft.name;
            hasChange = true;
          }
          if (draft.rows !== orig.rows) {
            updates.rows = draft.rows;
            hasChange = true;
          }
          if (draft.cols !== orig.cols) {
            updates.cols = draft.cols;
            hasChange = true;
          }
          if (draft.depth !== orig.depth) {
            updates.depth = draft.depth;
            hasChange = true;
          }
          if (
            JSON.stringify(draft.storageRows) !==
            JSON.stringify(orig.storageRows)
          ) {
            updates.storageRows = draft.storageRows;
            hasChange = true;
          }
          if (
            JSON.stringify(draft.rowSizes) !==
            JSON.stringify(orig.rowSizes ?? [])
          ) {
            updates.rowSizes = draft.rowSizes;
            hasChange = true;
          }
          if (draft.sortOrder !== orig.sortOrder) {
            updates.sortOrder = draft.sortOrder;
            hasChange = true;
          }
          if (hasChange) {
            changes.updated.push(
              updates as SectionChanges["updated"][number]
            );
          }
        }
      }

      return changes;
    },
    [draftSections, deletedIds]
  );

  const hasPendingChanges = useCallback(
    (originalCabinets: Cabinet[]): boolean => {
      if (deletedIds.length > 0) return true;
      if (draftSections.some((s) => s.isNew)) return true;
      for (const draft of draftSections) {
        const orig = originalCabinets.find((c) => c.id === draft.id);
        if (!orig) continue;
        if (
          draft.name !== orig.name ||
          draft.rows !== orig.rows ||
          draft.cols !== orig.cols ||
          draft.depth !== orig.depth ||
          draft.sortOrder !== orig.sortOrder ||
          JSON.stringify(draft.storageRows) !==
            JSON.stringify(orig.storageRows) ||
          JSON.stringify(draft.rowSizes) !== JSON.stringify(orig.rowSizes ?? [])
        )
          return true;
      }
      return false;
    },
    [draftSections, deletedIds]
  );

  return (
    <EditModeContext.Provider
      value={{
        editMode,
        setEditMode,
        selectedSectionId,
        selectSection,
        draftSections,
        initDrafts,
        updateDraft,
        addDraft,
        removeDraft,
        reorderDraft,
        buildChanges,
        hasPendingChanges,
        deletedIds,
      }}
    >
      {children}
    </EditModeContext.Provider>
  );
}
