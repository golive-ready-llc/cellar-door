"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Cabinet, StorageRow, RowSize } from "@/types/wine";
import {
  buildSectionChanges,
  sectionsHaveChanges,
  type SectionChanges,
  type SectionEntry,
} from "./section-changes";

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

  // Draft → canonical diff entry. New drafts have no saved original; drafts
  // whose saved cabinet vanished mid-edit have nothing to diff against, so
  // they drop out entirely (the previous inline diff skipped them too).
  const toEntries = useCallback(
    (originalCabinets: Cabinet[], drafts: DraftSection[]): SectionEntry[] => {
      const entries: SectionEntry[] = [];
      for (const draft of drafts) {
        const current = {
          name: draft.name,
          rows: draft.rows,
          cols: draft.cols,
          depth: draft.depth,
          storageRows: draft.storageRows,
          rowSizes: draft.rowSizes,
          sortOrder: draft.sortOrder,
        };
        if (draft.isNew) {
          entries.push({
            id: draft.id,
            current,
            original: null,
            isNew: true,
            markedForDelete: false,
          });
          continue;
        }
        const orig = originalCabinets.find((c) => c.id === draft.id);
        if (!orig) continue;
        entries.push({
          id: draft.id,
          current,
          original: {
            name: orig.name,
            rows: orig.rows,
            cols: orig.cols,
            depth: orig.depth,
            storageRows: orig.storageRows,
            rowSizes: orig.rowSizes ?? [],
            sortOrder: orig.sortOrder,
          },
          isNew: false,
          markedForDelete: false,
        });
      }
      return entries;
    },
    []
  );

  const buildChanges = useCallback(
    (originalCabinets: Cabinet[], wallId: string): SectionChanges => {
      return buildSectionChanges(
        toEntries(originalCabinets, draftSections),
        wallId,
        deletedIds
      );
    },
    [draftSections, deletedIds, toEntries]
  );

  const hasPendingChanges = useCallback(
    (originalCabinets: Cabinet[]): boolean => {
      return sectionsHaveChanges(
        toEntries(originalCabinets, draftSections),
        deletedIds
      );
    },
    [draftSections, deletedIds, toEntries]
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
