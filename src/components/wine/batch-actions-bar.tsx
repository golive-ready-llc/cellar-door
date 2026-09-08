"use client";

import { useState } from "react";
import {
  X,
  Trash2,
  Tag,
  ArrowRight,
  Wine as WineIcon,
  CheckSquare,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagSelector } from "@/components/wine/tag-selector";
import { WINE_TYPES, WINE_TYPE_LABELS } from "@/types/constants";
import type { Wine, Cabinet, WineType } from "@/types/wine";

interface BatchActionsBarProps {
  selectedWines: Wine[];
  cabinets: Cabinet[];
  allTags: string[];
  onClearSelection: () => void;
  onBatchMove: (wineIds: string[], cabinetId: string | null) => Promise<void>;
  onBatchDelete: (wineIds: string[]) => Promise<void>;
  onBatchTag: (wineIds: string[], tags: string[]) => Promise<void>;
  onBatchType: (wineIds: string[], type: WineType) => Promise<void>;
}

export function BatchActionsBar({
  selectedWines,
  cabinets,
  allTags,
  onClearSelection,
  onBatchMove,
  onBatchDelete,
  onBatchTag,
  onBatchType,
}: BatchActionsBarProps) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Move dialog state
  const [targetCabinet, setTargetCabinet] = useState("");

  // Tag dialog state
  const [batchTags, setBatchTags] = useState<string[]>([]);
  const [_tagMode, setTagMode] = useState<"add" | "replace">("add");

  // Type dialog state
  const [targetType, setTargetType] = useState<WineType>("red");

  if (selectedWines.length === 0) return null;

  const wineIds = selectedWines.map((w) => w.id);

  const handleMove = async () => {
    setLoading(true);
    try {
      await onBatchMove(wineIds, targetCabinet || null);
      setMoveOpen(false);
      onClearSelection();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onBatchDelete(wineIds);
      setDeleteOpen(false);
      onClearSelection();
    } finally {
      setLoading(false);
    }
  };

  const handleTag = async () => {
    setLoading(true);
    try {
      await onBatchTag(wineIds, batchTags);
      setTagOpen(false);
      onClearSelection();
    } finally {
      setLoading(false);
    }
  };

  const handleType = async () => {
    setLoading(true);
    try {
      await onBatchType(wineIds, targetType);
      setTypeOpen(false);
      onClearSelection();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating action bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-primary text-primary-foreground rounded-full shadow-2xl px-5 py-2.5 animate-in slide-in-from-bottom-4 fade-in duration-200">
        <div className="flex items-center gap-2 mr-2">
          <CheckSquare className="h-4 w-4" />
          <span className="text-sm font-medium">
            {selectedWines.length} selected
          </span>
        </div>

        <div className="w-px h-5 bg-primary-foreground/30" />

        <Button
          variant="ghost"
          size="sm"
          className="text-primary-foreground hover:bg-primary-foreground/20 gap-1.5 text-xs h-7"
          onClick={() => {
            setTargetCabinet(cabinets[0]?.id ?? "");
            setMoveOpen(true);
          }}
        >
          <ArrowRight className="h-3.5 w-3.5" />
          Move
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-primary-foreground hover:bg-primary-foreground/20 gap-1.5 text-xs h-7"
          onClick={() => {
            setBatchTags([]);
            setTagMode("add");
            setTagOpen(true);
          }}
        >
          <Tag className="h-3.5 w-3.5" />
          Tag
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-primary-foreground hover:bg-primary-foreground/20 gap-1.5 text-xs h-7"
          onClick={() => {
            setTargetType("red");
            setTypeOpen(true);
          }}
        >
          <WineIcon className="h-3.5 w-3.5" />
          Type
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-primary-foreground hover:bg-primary-foreground/20 gap-1.5 text-xs h-7 text-red-300 hover:text-red-200"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </Button>

        <div className="w-px h-5 bg-primary-foreground/30" />

        <Button
          variant="ghost"
          size="sm"
          className="text-primary-foreground hover:bg-primary-foreground/20 p-1 h-7 w-7"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Move Dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Move {selectedWines.length} Wines
            </DialogTitle>
            <DialogDescription>
              Move selected wines to a different section.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={targetCabinet} onValueChange={(v) => setTargetCabinet(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select section...">
                  {cabinets.find((c) => c.id === targetCabinet)?.name ||
                    "Unassigned"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {cabinets.map((cab) => (
                  <SelectItem key={cab.id} value={cab.id}>
                    {cab.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMove} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete/Remove Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Remove {selectedWines.length} Wines
            </DialogTitle>
            <DialogDescription>
              This will remove selected wines from your cellar. They will be
              moved to your history.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 max-h-48 overflow-y-auto space-y-1">
            {selectedWines.map((wine) => (
              <div
                key={wine.id}
                className="text-sm text-muted-foreground truncate"
              >
                {wine.name}
                {wine.vintage ? ` (${wine.vintage})` : ""}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Remove All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Dialog */}
      <Dialog open={tagOpen} onOpenChange={setTagOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Tag {selectedWines.length} Wines
            </DialogTitle>
            <DialogDescription>
              Add tags to the selected wines.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <TagSelector
              tags={batchTags}
              onChange={setBatchTags}
              allTags={allTags}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleTag}
              disabled={loading || batchTags.length === 0}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Add Tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Type Dialog */}
      <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WineIcon className="h-5 w-5" />
              Change Type for {selectedWines.length} Wines
            </DialogTitle>
            <DialogDescription>
              Set the wine type for all selected wines.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={targetType}
              onValueChange={(v) => v && setTargetType(v as WineType)}
            >
              <SelectTrigger>
                <SelectValue>
                  {WINE_TYPE_LABELS[targetType]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {WINE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {WINE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleType} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Change Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
