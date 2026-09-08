"use client";

import { useState, useEffect } from "react";
import { Archive, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CASE_SIZES } from "@/types/constants";
import { Stepper } from "./stepper";
import type { StorageRow } from "@/types/wine";
import type { SectionTemplate } from "./storage-type-picker";

interface BulkConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (template: SectionTemplate) => void;
}

type BulkMode = "bin" | "crate";

export function BulkConfigDialog({
  open,
  onOpenChange,
  onConfirm,
}: BulkConfigDialogProps) {
  const [mode, setMode] = useState<BulkMode>("bin");
  const [name, setName] = useState("Bulk Storage");
  const [capacity, setCapacity] = useState(20);
  const [boxes, setBoxes] = useState<number[]>([]);

  const totalBoxCapacity = boxes.reduce((sum, b) => sum + b, 0);

  // Reset state whenever dialog opens (handles cancel / escape / re-open)
  useEffect(() => {
    if (open) {
      setMode("bin");
      setName("Bulk Storage");
      setCapacity(20);
      setBoxes([]);
    }
  }, [open]);

  const handleAddCase = (size: number) => {
    const newBoxes = [...boxes, size];
    const newTotal = newBoxes.reduce((s, b) => s + b, 0);
    setBoxes(newBoxes);
    // Auto-increase capacity if cases exceed it
    if (newTotal > capacity) {
      setCapacity(newTotal);
    }
  };

  const handleRemoveCase = (idx: number) => {
    setBoxes(boxes.filter((_, i) => i !== idx));
  };

  const handleConfirm = () => {
    const storageRow: StorageRow = {
      row: 0,
      name,
      type: "bulk",
      capacity,
      ...(mode === "crate" && boxes.length > 0 ? { boxes } : {}),
    };

    onConfirm({
      name,
      rows: 1,
      cols: 1,
      depth: 1,
      storageRows: [storageRow],
    });

    onOpenChange(false);
  };

  const handleModeChange = (newMode: BulkMode) => {
    setMode(newMode);
    if (newMode === "bin") {
      setBoxes([]);
      setName("Bulk Storage");
    } else {
      setName("Case Storage");
      if (boxes.length === 0) {
        // Start with a default case
        setBoxes([12]);
        if (capacity < 12) setCapacity(12);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Bulk Storage</DialogTitle>
          <DialogDescription>
            Choose a storage type and configure capacity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all",
                mode === "bin"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/40"
              )}
              onClick={() => handleModeChange("bin")}
            >
              <Archive className={cn("h-6 w-6", mode === "bin" ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-sm font-medium", mode === "bin" ? "text-primary" : "text-muted-foreground")}>
                Bulk Bin
              </span>
              <span className="text-[10px] text-muted-foreground">
                Open storage
              </span>
            </button>
            <button
              type="button"
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all",
                mode === "crate"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/40"
              )}
              onClick={() => handleModeChange("crate")}
            >
              <Package className={cn("h-6 w-6", mode === "crate" ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-sm font-medium", mode === "crate" ? "text-primary" : "text-muted-foreground")}>
                Crate Storage
              </span>
              <span className="text-[10px] text-muted-foreground">
                Cases & boxes
              </span>
            </button>
          </div>

          {/* Name */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0 w-16">Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-sm"
              placeholder="Bulk Storage"
            />
          </div>

          {/* Capacity */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0 w-16">Capacity</span>
            <Stepper
              value={capacity}
              min={Math.max(1, totalBoxCapacity)}
              max={200}
              size="sm"
              onChange={setCapacity}
            />
            <span className="text-xs text-muted-foreground">bottles</span>
          </div>

          {/* Cases section — only in crate mode */}
          {mode === "crate" && (
            <div className="space-y-2 pt-1 border-t border-border/50">
              <span className="text-xs font-medium text-muted-foreground">
                Cases
              </span>

              {/* Current cases */}
              {boxes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {boxes.map((size, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs"
                    >
                      <Package className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{size}-pk</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                        onClick={() => handleRemoveCase(idx)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add case buttons */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground shrink-0">
                  Add case:
                </span>
                {CASE_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className="h-7 px-2.5 flex items-center justify-center text-xs border rounded-md hover:bg-muted transition-colors"
                    onClick={() => handleAddCase(size)}
                  >
                    {size}-pk
                  </button>
                ))}
              </div>

              {/* Capacity breakdown */}
              {boxes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Cases: {totalBoxCapacity} + Loose: {Math.max(0, capacity - totalBoxCapacity)} = {capacity} total
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Add Storage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
