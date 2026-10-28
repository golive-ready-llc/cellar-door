import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  EditModeProvider,
  useEditMode,
  generateTempId,
} from "@/components/cellar/edit-mode-context";
import type { Cabinet, StorageRow } from "@/types/wine";

const storage: StorageRow[] = [
  { row: 0, name: "Bulk Bin", type: "bulk", capacity: 20 },
];

function cabinet(partial: Partial<Cabinet>): Cabinet {
  return {
    id: "cab-1",
    userId: "u1",
    wallId: "wall-1",
    name: "Section",
    rows: 4,
    cols: 4,
    depth: 1,
    storageRows: storage,
    rowSizes: [],
    sortOrder: 0,
    ...partial,
  };
}

function renderEditMode() {
  return renderHook(() => useEditMode(), {
    wrapper: ({ children }) => (
      <EditModeProvider>{children}</EditModeProvider>
    ),
  });
}

describe("EditModeContext buildChanges contract", () => {
  it("emits nothing when drafts match the originals exactly", () => {
    const originals = [cabinet({})];
    const { result } = renderEditMode();
    act(() => result.current.initDrafts(originals));

    const changes = result.current.buildChanges(originals, "wall-1");
    expect(changes.created).toEqual([]);
    expect(changes.updated).toEqual([]);
    expect(changes.deleted).toEqual([]);
    expect(result.current.hasPendingChanges(originals)).toBe(false);
  });

  it("emits only the changed field on an edited draft", () => {
    const originals = [cabinet({ name: "Before" })];
    const { result } = renderEditMode();
    act(() => result.current.initDrafts(originals));
    act(() => result.current.updateDraft("cab-1", { name: "After" }));

    const changes = result.current.buildChanges(originals, "wall-1");
    expect(changes.updated).toEqual([{ id: "cab-1", name: "After" }]);
    expect(result.current.hasPendingChanges(originals)).toBe(true);
  });

  it("emits a rowSizes-only change — the field set must stay complete", () => {
    const originals = [cabinet({ rowSizes: [] })];
    const { result } = renderEditMode();
    act(() => result.current.initDrafts(originals));
    act(() =>
      result.current.updateDraft("cab-1", { rowSizes: [{ row: 0, maxSize: "magnum" }] })
    );

    const changes = result.current.buildChanges(originals, "wall-1");
    expect(changes.updated).toEqual([
      { id: "cab-1", rowSizes: [{ row: 0, maxSize: "magnum" }] },
    ]);
    expect(result.current.hasPendingChanges(originals)).toBe(true);
  });

  it("emits a storageRows-only change", () => {
    const originals = [cabinet({})];
    const { result } = renderEditMode();
    act(() => result.current.initDrafts(originals));
    act(() => result.current.updateDraft("cab-1", { storageRows: [] }));

    const changes = result.current.buildChanges(originals, "wall-1");
    expect(changes.updated).toEqual([{ id: "cab-1", storageRows: [] }]);
  });

  it("classifies new drafts as created with the full shape", () => {
    const originals = [cabinet({})];
    const { result } = renderEditMode();
    act(() => result.current.initDrafts(originals));
    const tempId = generateTempId();
    act(() =>
      result.current.addDraft({
        id: tempId,
        name: "New",
        rows: 2,
        cols: 2,
        depth: 1,
        storageRows: [],
        rowSizes: [],
        sortOrder: 1,
        isNew: true,
      })
    );

    const changes = result.current.buildChanges(originals, "wall-9");
    expect(changes.created).toEqual([
      {
        name: "New",
        rows: 2,
        cols: 2,
        depth: 1,
        storageRows: [],
        rowSizes: [],
        wallId: "wall-9",
        sortOrder: 1,
      },
    ]);
    expect(result.current.hasPendingChanges(originals)).toBe(true);
  });

  it("removing a saved draft marks it deleted; removing a new draft drops it silently", () => {
    const originals = [cabinet({})];
    const { result } = renderEditMode();
    act(() => result.current.initDrafts(originals));
    const tempId = generateTempId();
    act(() =>
      result.current.addDraft({
        id: tempId,
        name: "New",
        rows: 2,
        cols: 2,
        depth: 1,
        storageRows: [],
        rowSizes: [],
        sortOrder: 1,
        isNew: true,
      })
    );

    act(() => result.current.removeDraft(tempId));
    let changes = result.current.buildChanges(originals, "wall-1");
    expect(changes.created).toEqual([]);
    expect(changes.deleted).toEqual([]);
    expect(result.current.hasPendingChanges(originals)).toBe(false);

    act(() => result.current.removeDraft("cab-1"));
    changes = result.current.buildChanges(originals, "wall-1");
    expect(changes.deleted).toEqual(["cab-1"]);
    expect(changes.updated).toEqual([]);
    expect(result.current.hasPendingChanges(originals)).toBe(true);
  });

  it("reordering emits sortOrder-only updates for the moved positions", () => {
    const originals = [
      cabinet({ id: "cab-1", sortOrder: 0 }),
      cabinet({ id: "cab-2", name: "Two", sortOrder: 1 }),
    ];
    const { result } = renderEditMode();
    act(() => result.current.initDrafts(originals));

    act(() => result.current.reorderDraft("cab-2", 0));

    const changes = result.current.buildChanges(originals, "wall-1");
    expect(changes.updated).toEqual([
      { id: "cab-2", sortOrder: 0 },
      { id: "cab-1", sortOrder: 1 },
    ]);
    expect(result.current.hasPendingChanges(originals)).toBe(true);
  });

  it("skips drafts whose original cabinet no longer exists", () => {
    const originals = [cabinet({})];
    const { result } = renderEditMode();
    act(() => result.current.initDrafts(originals));
    act(() => result.current.updateDraft("cab-1", { name: "Orphan edit" }));

    const changes = result.current.buildChanges([], "wall-1");
    expect(changes.updated).toEqual([]);
    expect(changes.created).toEqual([]);
    expect(result.current.hasPendingChanges([])).toBe(false);
  });
});
