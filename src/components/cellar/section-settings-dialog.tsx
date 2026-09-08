"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Settings,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Stepper } from "@/components/cellar/stepper";
import {
  StorageTypePicker,
  type SectionTemplate,
} from "@/components/cellar/storage-type-picker";
import { GridPreview } from "@/components/cellar/grid-preview";
import { BOX_SIZES } from "@/types/constants";
import type { Cabinet, Wine, StorageRow, StorageRowType, RowSize } from "@/types/wine";

// ============================================================
// Types
// ============================================================

interface SectionSettingsDialogProps {
  cabinets: Cabinet[];
  wallId: string;
  wines?: Wine[];
  onSave: (changes: SectionChanges) => Promise<void>;
  /** Base UI DialogTrigger's render prop requires a React element, not generic ReactNode. */
  trigger?: React.ReactElement;
}

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

interface EditableSection {
  id: string;
  name: string;
  rows: number;
  cols: number;
  depth: number;
  storageRows: StorageRow[];
  sortOrder: number;
  isNew: boolean;
  markedForDelete: boolean;
  originalName: string;
  originalRows: number;
  originalCols: number;
  originalDepth: number;
  originalStorageRows: StorageRow[];
  originalSortOrder: number;
}

type DialogMode = "list" | "add" | "edit" | "delete-confirm";

let tempIdCounter = 0;

// ============================================================
// Main Dialog
// ============================================================

export function SectionSettingsDialog({
  cabinets,
  wallId,
  wines = [],
  onSave,
  trigger,
}: SectionSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<EditableSection[]>([]);
  const [mode, setMode] = useState<DialogMode>("list");
  const [editSection, setEditSection] = useState<EditableSection | null>(null);

  // Initialize working copy when dialog opens
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setSections(
          cabinets.map((c) => ({
            id: c.id,
            name: c.name,
            rows: c.rows,
            cols: c.cols,
            depth: c.depth,
            storageRows: c.storageRows.map((sr) => ({ ...sr })),
            sortOrder: c.sortOrder,
            isNew: false,
            markedForDelete: false,
            originalName: c.name,
            originalRows: c.rows,
            originalCols: c.cols,
            originalDepth: c.depth,
            originalStorageRows: c.storageRows.map((sr) => ({ ...sr })),
            originalSortOrder: c.sortOrder,
          }))
        );
        setMode("list");
        setEditSection(null);
      }
      setOpen(nextOpen);
    },
    [cabinets]
  );

  const winesInSection = useCallback(
    (sectionId: string) =>
      wines.filter((w) => w.cabinetId === sectionId).length,
    [wines]
  );

  const winesOutOfBounds = useCallback(
    (sectionId: string, newRows: number, newCols: number) =>
      wines.filter(
        (w) =>
          w.cabinetId === sectionId &&
          w.row != null &&
          w.col != null &&
          (w.row >= newRows || w.col >= newCols)
      ).length,
    [wines]
  );

  // ---- List mode actions ----

  const handleTemplateSelect = (template: SectionTemplate) => {
    tempIdCounter++;
    const visibleCount = sections.filter((s) => !s.markedForDelete).length;
    const newSection: EditableSection = {
      id: `new-${tempIdCounter}`,
      name: template.name,
      rows: template.rows,
      cols: template.cols,
      depth: template.depth,
      storageRows: template.storageRows.map((sr) => ({ ...sr })),
      sortOrder: visibleCount,
      isNew: true,
      markedForDelete: false,
      originalName: "",
      originalRows: 0,
      originalCols: 0,
      originalDepth: 0,
      originalStorageRows: [],
      originalSortOrder: 0,
    };
    setEditSection(newSection);
    setMode("add");
  };

  const handleStartEdit = (section: EditableSection) => {
    setEditSection({ ...section, storageRows: section.storageRows.map((sr) => ({ ...sr })) });
    setMode("edit");
  };

  const handleStartDelete = (section: EditableSection) => {
    setEditSection(section);
    setMode("delete-confirm");
  };

  const handleConfirmDelete = () => {
    if (!editSection) return;
    if (editSection.isNew) {
      setSections((prev) => prev.filter((s) => s.id !== editSection.id));
    } else {
      setSections((prev) =>
        prev.map((s) =>
          s.id === editSection.id ? { ...s, markedForDelete: true } : s
        )
      );
    }
    setEditSection(null);
    setMode("list");
  };

  const handleMoveUp = (section: EditableSection) => {
    setSections((prev) => {
      const sorted = [...prev]
        .filter((s) => !s.markedForDelete)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex((s) => s.id === section.id);
      if (idx <= 0) return prev;
      const prevSection = sorted[idx - 1];
      return prev.map((s) => {
        if (s.id === section.id) return { ...s, sortOrder: prevSection.sortOrder };
        if (s.id === prevSection.id) return { ...s, sortOrder: section.sortOrder };
        return s;
      });
    });
  };

  const handleMoveDown = (section: EditableSection) => {
    setSections((prev) => {
      const sorted = [...prev]
        .filter((s) => !s.markedForDelete)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex((s) => s.id === section.id);
      if (idx < 0 || idx >= sorted.length - 1) return prev;
      const nextSection = sorted[idx + 1];
      return prev.map((s) => {
        if (s.id === section.id) return { ...s, sortOrder: nextSection.sortOrder };
        if (s.id === nextSection.id) return { ...s, sortOrder: section.sortOrder };
        return s;
      });
    });
  };

  // ---- Edit form save ----

  const handleEditSave = () => {
    if (!editSection) return;
    // Filter storage rows beyond the row count
    const validStorageRows = editSection.storageRows.filter(
      (sr) => sr.row < editSection.rows
    );
    const cleaned = { ...editSection, storageRows: validStorageRows };

    if (mode === "add") {
      setSections((prev) => [...prev, cleaned]);
    } else {
      setSections((prev) =>
        prev.map((s) => (s.id === cleaned.id ? cleaned : s))
      );
    }
    setEditSection(null);
    setMode("list");
  };

  // ---- Dialog-level save ----

  const hasChanges = useMemo(() => {
    return (
      sections.some((s) => s.isNew && !s.markedForDelete) ||
      sections.some(
        (s) =>
          !s.isNew &&
          !s.markedForDelete &&
          (s.name !== s.originalName ||
            s.rows !== s.originalRows ||
            s.cols !== s.originalCols ||
            s.depth !== s.originalDepth ||
            s.sortOrder !== s.originalSortOrder ||
            JSON.stringify(s.storageRows) !==
              JSON.stringify(s.originalStorageRows))
      ) ||
      sections.some((s) => !s.isNew && s.markedForDelete)
    );
  }, [sections]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const changes: SectionChanges = {
        created: sections
          .filter((s) => s.isNew && !s.markedForDelete)
          .map((s) => ({
            name: s.name,
            rows: s.rows,
            cols: s.cols,
            depth: s.depth,
            storageRows: s.storageRows,
            wallId,
            sortOrder: s.sortOrder,
          })),
        updated: sections
          .filter((s) => !s.isNew && !s.markedForDelete)
          .filter(
            (s) =>
              s.name !== s.originalName ||
              s.rows !== s.originalRows ||
              s.cols !== s.originalCols ||
              s.depth !== s.originalDepth ||
              s.sortOrder !== s.originalSortOrder ||
              JSON.stringify(s.storageRows) !==
                JSON.stringify(s.originalStorageRows)
          )
          .map((s) => ({
            id: s.id,
            ...(s.name !== s.originalName && { name: s.name }),
            ...(s.rows !== s.originalRows && { rows: s.rows }),
            ...(s.cols !== s.originalCols && { cols: s.cols }),
            ...(s.depth !== s.originalDepth && { depth: s.depth }),
            ...(s.sortOrder !== s.originalSortOrder && {
              sortOrder: s.sortOrder,
            }),
            ...(JSON.stringify(s.storageRows) !==
              JSON.stringify(s.originalStorageRows) && {
              storageRows: s.storageRows,
            }),
          })),
        deleted: sections
          .filter((s) => !s.isNew && s.markedForDelete)
          .map((s) => s.id),
      };
      await onSave(changes);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  // ---- Visible sections sorted ----

  const visibleSections = useMemo(
    () =>
      sections
        .filter((s) => !s.markedForDelete)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [sections]
  );

  const deletedSections = sections.filter(
    (s) => !s.isNew && s.markedForDelete
  );

  // ---- Render ----

  const dialogTitles: Record<DialogMode, string> = {
    list: "Manage Sections",
    add: "Add Section",
    edit: "Edit Section",
    "delete-confirm": "Delete Section?",
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger || (
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              Sections
            </Button>
          )
        }
      />
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitles[mode]}</DialogTitle>
          {mode === "list" && (
            <DialogDescription>
              Add, edit, or remove wine rack sections.
            </DialogDescription>
          )}
        </DialogHeader>

        {mode === "list" && (
          <ListMode
            sections={visibleSections}
            deletedSections={deletedSections}
            winesInSection={winesInSection}
            onEdit={handleStartEdit}
            onDelete={handleStartDelete}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onUndoDelete={(id) =>
              setSections((prev) =>
                prev.map((s) =>
                  s.id === id ? { ...s, markedForDelete: false } : s
                )
              )
            }
            onTemplateSelect={handleTemplateSelect}
          />
        )}

        {(mode === "add" || mode === "edit") && editSection && (
          <EditMode
            section={editSection}
            onChange={setEditSection}
            isEdit={mode === "edit"}
            winesOutOfBounds={
              mode === "edit" && !editSection.isNew
                ? winesOutOfBounds(
                    editSection.id,
                    editSection.rows,
                    editSection.cols
                  )
                : 0
            }
          />
        )}

        {mode === "delete-confirm" && editSection && (
          <DeleteConfirmMode
            section={editSection}
            wineCount={winesInSection(editSection.id)}
          />
        )}

        <DialogFooter>
          {mode === "list" && (
            <>
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Close
              </Button>
              {hasChanges && (
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              )}
            </>
          )}
          {(mode === "add" || mode === "edit") && (
            <>
              <Button variant="ghost" onClick={() => setMode("list")}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleEditSave}>
                {mode === "add" ? "Add" : "Update"}
              </Button>
            </>
          )}
          {mode === "delete-confirm" && (
            <>
              <Button variant="ghost" onClick={() => setMode("list")}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete}>
                Delete
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// List Mode
// ============================================================

function ListMode({
  sections,
  deletedSections,
  winesInSection,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onUndoDelete,
  onTemplateSelect,
}: {
  sections: EditableSection[];
  deletedSections: EditableSection[];
  winesInSection: (id: string) => number;
  onEdit: (s: EditableSection) => void;
  onDelete: (s: EditableSection) => void;
  onMoveUp: (s: EditableSection) => void;
  onMoveDown: (s: EditableSection) => void;
  onUndoDelete: (id: string) => void;
  onTemplateSelect: (template: SectionTemplate) => void;
}) {
  return (
    <div className="space-y-3 py-2">
      {sections.length === 0 && deletedSections.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No sections yet. Pick a storage type below to get started.
        </p>
      )}

      {sections.map((section, idx) => {
        const count = winesInSection(section.id);
        const storageCount = section.storageRows.length;
        return (
          <div
            key={section.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">
                {section.name}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {section.rows} &times; {section.cols} grid
                {section.depth > 1 ? ` \u00D7 ${section.depth} deep` : ""}
                {" \u00B7 "}
                {count} bottle{count !== 1 ? "s" : ""}
                {storageCount > 0
                  ? ` \u00B7 ${storageCount} storage row${storageCount !== 1 ? "s" : ""}`
                  : ""}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onMoveUp(section)}
                disabled={idx === 0}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onMoveDown(section)}
                disabled={idx === sections.length - 1}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEdit(section)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(section)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}

      {/* Deleted sections (undo) */}
      {deletedSections.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            {deletedSections.map((section) => (
              <div
                key={section.id}
                className="flex items-center justify-between px-3 py-2 rounded-md bg-destructive/10 text-sm"
              >
                <span className="text-muted-foreground line-through">
                  {section.originalName}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => onUndoDelete(section.id)}
                >
                  Undo
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      <Separator />

      {/* Storage Type Picker */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">
          Add a section
        </Label>
        <StorageTypePicker onSelect={onTemplateSelect} />
      </div>
    </div>
  );
}

// ============================================================
// Edit Mode (Add / Edit)
// ============================================================

function EditMode({
  section,
  onChange,
  winesOutOfBounds,
}: {
  section: EditableSection;
  onChange: (s: EditableSection) => void;
  isEdit: boolean;
  winesOutOfBounds: number;
}) {
  const update = (partial: Partial<EditableSection>) =>
    onChange({ ...section, ...partial });

  const storageRowMap = new Map<number, StorageRow>();
  for (const sr of section.storageRows) {
    storageRowMap.set(sr.row, sr);
  }

  const setRowType = (row: number, type: "slots" | StorageRowType) => {
    if (type === "slots") {
      update({
        storageRows: section.storageRows.filter((sr) => sr.row !== row),
      });
    } else {
      const existing = storageRowMap.get(row);
      const isBox = type === "box";
      const newRow: StorageRow = {
        row,
        name: existing?.name || (isBox ? "Wine Box" : "Bulk Bin"),
        type,
        capacity: isBox ? 12 : 20,
        ...(isBox ? { boxes: [12] } : {}),
      };
      if (existing) {
        update({
          storageRows: section.storageRows.map((sr) =>
            sr.row === row ? newRow : sr
          ),
        });
      } else {
        update({ storageRows: [...section.storageRows, newRow] });
      }
    }
  };

  const updateStorageRow = (row: number, partial: Partial<StorageRow>) => {
    update({
      storageRows: section.storageRows.map((sr) =>
        sr.row === row ? { ...sr, ...partial } : sr
      ),
    });
  };

  const updateBoxCount = (row: number, count: number) => {
    const sr = storageRowMap.get(row);
    if (!sr || sr.type !== "box") return;
    const boxes = [...(sr.boxes || [12])];
    while (boxes.length < count) boxes.push(12);
    while (boxes.length > count) boxes.pop();
    updateStorageRow(row, { boxes, capacity: boxes.reduce((s, b) => s + b, 0) });
  };

  const updateBoxSize = (row: number, boxIndex: number, size: number) => {
    const sr = storageRowMap.get(row);
    if (!sr || sr.type !== "box") return;
    const boxes = [...(sr.boxes || [12])];
    boxes[boxIndex] = size;
    updateStorageRow(row, { boxes, capacity: boxes.reduce((s, b) => s + b, 0) });
  };

  return (
    <div className="space-y-4 py-2">
      {/* Name */}
      <div className="space-y-1.5">
        <Label className="text-xs">Name</Label>
        <Input
          value={section.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Section name"
        />
      </div>

      {/* Stepper row */}
      <div className="flex gap-3">
        <Stepper
          label="Rows"
          value={section.rows}
          min={1}
          max={20}
          onChange={(rows) => {
            // Remove storage rows beyond new row count
            const validStorage = section.storageRows.filter(
              (sr) => sr.row < rows
            );
            update({ rows, storageRows: validStorage });
          }}
          className="flex-1"
        />
        <Stepper
          label="Columns"
          value={section.cols}
          min={1}
          max={20}
          onChange={(cols) => update({ cols })}
          className="flex-1"
        />
        <Stepper
          label="Depth"
          value={section.depth}
          min={1}
          max={6}
          onChange={(depth) => update({ depth })}
          className="flex-1"
        />
      </div>

      {/* Grid preview */}
      <GridPreview
        rows={section.rows}
        cols={section.cols}
        storageRows={section.storageRows}
      />

      {/* Per-row configuration */}
      <div className="space-y-1.5">
        <Label className="text-xs">Row Configuration</Label>
        <div className="max-h-[200px] overflow-y-auto border border-border rounded-lg p-1.5 space-y-1">
          {Array.from({ length: section.rows }, (_, rowIdx) => {
            const sr = storageRowMap.get(rowIdx);
            const currentType = sr?.type || "slots";

            return (
              <div
                key={rowIdx}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm ${
                  sr
                    ? "bg-amber-500/10 border border-amber-500/20"
                    : "hover:bg-muted/50"
                }`}
              >
                <span className="w-7 text-xs font-semibold text-muted-foreground shrink-0">
                  R{rowIdx + 1}
                </span>

                <Select
                  value={currentType}
                  onValueChange={(val) =>
                    setRowType(rowIdx, val as "slots" | StorageRowType)
                  }
                >
                  <SelectTrigger size="sm" className="w-24 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slots">Slots</SelectItem>
                    <SelectItem value="bulk">Bulk Bin</SelectItem>
                    <SelectItem value="box">Wine Box</SelectItem>
                  </SelectContent>
                </Select>

                {!sr && (
                  <span className="text-xs text-muted-foreground">
                    {section.cols} col{section.cols !== 1 ? "s" : ""}
                    {section.depth > 1
                      ? ` \u00D7 ${section.depth} deep`
                      : ""}
                  </span>
                )}

                {sr && sr.type === "bulk" && (
                  <>
                    <Input
                      value={sr.name}
                      onChange={(e) =>
                        updateStorageRow(rowIdx, { name: e.target.value })
                      }
                      className="h-7 w-20 text-xs"
                      placeholder="Name"
                    />
                    <Stepper
                      value={sr.capacity}
                      min={1}
                      max={100}
                      onChange={(cap) =>
                        updateStorageRow(rowIdx, { capacity: cap })
                      }
                      size="sm"
                    />
                  </>
                )}

                {sr && sr.type === "box" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      value={sr.name}
                      onChange={(e) =>
                        updateStorageRow(rowIdx, { name: e.target.value })
                      }
                      className="h-7 w-20 text-xs"
                      placeholder="Name"
                    />
                    <Stepper
                      value={(sr.boxes || [12]).length}
                      min={1}
                      max={10}
                      onChange={(count) => updateBoxCount(rowIdx, count)}
                      size="sm"
                    />
                    {(sr.boxes || [12]).map((boxSize, bi) => (
                      <Select
                        key={bi}
                        value={String(boxSize)}
                        onValueChange={(val) =>
                          updateBoxSize(rowIdx, bi, parseInt(val as string, 10))
                        }
                      >
                        <SelectTrigger size="sm" className="w-16">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BOX_SIZES.map((s) => (
                            <SelectItem key={s} value={String(s)}>
                              {s}-pk
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ))}
                    <span className="text-xs text-muted-foreground">
                      = {sr.capacity}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Out-of-bounds warning */}
      {winesOutOfBounds > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
          Shrinking will unassign {winesOutOfBounds} wine
          {winesOutOfBounds > 1 ? "s" : ""} that are outside the new grid
          bounds.
        </div>
      )}
    </div>
  );
}

// ============================================================
// Delete Confirm Mode
// ============================================================

function DeleteConfirmMode({
  section,
  wineCount,
}: {
  section: EditableSection;
  wineCount: number;
}) {
  return (
    <div className="py-4 space-y-2">
      <p className="text-sm">
        Are you sure you want to delete{" "}
        <strong>&ldquo;{section.name}&rdquo;</strong>?
      </p>
      {wineCount > 0 && (
        <p className="text-sm text-destructive font-medium">
          {wineCount} wine{wineCount > 1 ? "s" : ""} will be unassigned.
        </p>
      )}
    </div>
  );
}
