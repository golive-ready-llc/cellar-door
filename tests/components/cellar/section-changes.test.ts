import { describe, it, expect } from "vitest";
import {
  buildSectionChanges,
  sectionsHaveChanges,
  type SectionEntry,
  type SectionSnapshot,
} from "@/components/cellar/section-changes";
import type { StorageRow } from "@/types/wine";

const storage: StorageRow[] = [
  { row: 0, name: "Bulk Bin", type: "bulk", capacity: 20 },
];

function snapshot(partial: Partial<SectionSnapshot> = {}): SectionSnapshot {
  return {
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

function entry(partial: Partial<SectionEntry> = {}): SectionEntry {
  return {
    id: "cab-1",
    current: snapshot(),
    original: snapshot(),
    isNew: false,
    markedForDelete: false,
    ...partial,
  };
}

describe("buildSectionChanges", () => {
  it("emits nothing for identical entries", () => {
    const changes = buildSectionChanges([entry()], "wall-1");
    expect(changes).toEqual({ created: [], updated: [], deleted: [] });
  });

  it("classifies new entries as created with the full shape", () => {
    const changes = buildSectionChanges(
      [entry({ isNew: true, original: null, current: snapshot({ name: "New" }) })],
      "wall-9"
    );
    expect(changes.created).toEqual([
      {
        name: "New",
        rows: 4,
        cols: 4,
        depth: 1,
        storageRows: storage,
        rowSizes: [],
        wallId: "wall-9",
        sortOrder: 0,
      },
    ]);
    expect(changes.updated).toEqual([]);
  });

  it("drops new entries that are marked for delete", () => {
    const changes = buildSectionChanges(
      [entry({ isNew: true, original: null, markedForDelete: true })],
      "wall-1"
    );
    expect(changes).toEqual({ created: [], updated: [], deleted: [] });
  });

  it("emits only the changed field on edited entries", () => {
    const changes = buildSectionChanges(
      [entry({ current: snapshot({ name: "After" }) })],
      "wall-1"
    );
    expect(changes.updated).toEqual([{ id: "cab-1", name: "After" }]);
  });

  it("emits rowSizes-only and storageRows-only changes", () => {
    const rowSizes = [{ row: 0, maxSize: "magnum" as const }];
    const changes = buildSectionChanges(
      [
        entry({
          id: "cab-1",
          current: snapshot({ rowSizes }),
        }),
        entry({
          id: "cab-2",
          current: snapshot({ storageRows: [] }),
        }),
      ],
      "wall-1"
    );
    expect(changes.updated).toEqual([
      { id: "cab-1", rowSizes },
      { id: "cab-2", storageRows: [] },
    ]);
  });

  it("moves soft-deleted saved entries to deleted and skips their updates", () => {
    const changes = buildSectionChanges(
      [
        entry({ id: "cab-1", markedForDelete: true, current: snapshot({ name: "X" }) }),
        entry({ id: "cab-2" }),
      ],
      "wall-1"
    );
    expect(changes.deleted).toEqual(["cab-1"]);
    expect(changes.updated).toEqual([]);
  });

  it("carries explicit deletedIds through and ignores their entries", () => {
    const changes = buildSectionChanges(
      [entry({ id: "cab-2", current: snapshot({ name: "X" }) })],
      "wall-1",
      ["cab-2"]
    );
    expect(changes.deleted).toEqual(["cab-2"]);
    expect(changes.updated).toEqual([]);
    expect(changes.created).toEqual([]);
  });

  it("skips non-new entries whose original vanished", () => {
    const changes = buildSectionChanges(
      [entry({ isNew: false, original: null })],
      "wall-1"
    );
    expect(changes).toEqual({ created: [], updated: [], deleted: [] });
  });
});

describe("sectionsHaveChanges", () => {
  it("is false for identical entries", () => {
    expect(sectionsHaveChanges([entry()])).toBe(false);
  });

  it("is true for new, changed, and soft-deleted entries", () => {
    expect(sectionsHaveChanges([entry({ isNew: true, original: null })])).toBe(true);
    expect(sectionsHaveChanges([entry({ current: snapshot({ name: "A" }) })])).toBe(true);
    expect(sectionsHaveChanges([entry({ markedForDelete: true })])).toBe(true);
  });

  it("is true when explicit deletedIds are passed", () => {
    expect(sectionsHaveChanges([], ["cab-gone"])).toBe(true);
  });

  it("ignores new entries marked for delete", () => {
    expect(
      sectionsHaveChanges([entry({ isNew: true, original: null, markedForDelete: true })])
    ).toBe(false);
  });
});
