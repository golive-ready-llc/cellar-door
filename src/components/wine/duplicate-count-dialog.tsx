"use client";

import { useState, useEffect } from "react";
import { Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const QUICK_COUNTS = [1, 3, 6, 12] as const;
const MAX_COUNT = 99;

interface DuplicateCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Wine name for the prompt copy — keeps the dialog non-generic. */
  wineName: string;
  /** Called when the user confirms. Caller is responsible for actually
   * creating `count` duplicate bottles (typically loops `addWine`). */
  onConfirm: (count: number) => void | Promise<void>;
}

/**
 * Lightweight count-picker for the "Duplicate" action. Replaces the old
 * one-bottle-at-a-time behavior — users with cases want to add 6 / 12
 * bottles in one tap, not click Duplicate twelve times in a row.
 *
 * Quick-pick buttons cover the common case sizes; the input handles
 * arbitrary counts up to 99.
 */
export function DuplicateCountDialog({
  open,
  onOpenChange,
  wineName,
  onConfirm,
}: DuplicateCountDialogProps) {
  // Hold the input as a free string so it can be cleared and retyped. Clamping
  // a controlled number on every keystroke made the field un-editable: backspace
  // to empty → parseInt("")=NaN → no update → it snapped back to "1", so you
  // could never clear the 1 to type, say, 2. Parse + clamp only when needed.
  const [countStr, setCountStr] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  const count = Math.max(1, Math.min(MAX_COUNT, parseInt(countStr, 10) || 1));

  // Reset to 1 each time the dialog opens — avoids stale "12" sticking
  // around if the user duplicated a case earlier and now wants 1 bottle.
  useEffect(() => {
    if (open) {
      setCountStr("1");
      setSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(count);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Duplicate Wine
          </DialogTitle>
          <DialogDescription className="text-sm">
            How many copies of <span className="font-medium text-foreground">{wineName}</span> would you like to add? They&apos;ll go to your unfiled-wines pile so you can place each one.
          </DialogDescription>
        </DialogHeader>

        {/* Quick-pick row — case sizes most users actually buy */}
        <div className="flex flex-wrap gap-2">
          {QUICK_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCountStr(String(n))}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium border transition-colors min-w-[3.5rem]",
                countStr === String(n)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              )}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Manual count for non-standard cases (magnums, samples, etc.) */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label
              htmlFor="duplicate-count-input"
              className="block text-xs text-muted-foreground mb-1"
            >
              Or enter a custom count (1-{MAX_COUNT})
            </label>
            <Input
              id="duplicate-count-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_COUNT}
              value={countStr}
              // Allow free editing (incl. empty + partial); keep digits only and
              // cap at 2 digits (max 99). The value is clamped on confirm.
              onChange={(e) => setCountStr(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting) handleConfirm();
              }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || count < 1}
          >
            {submitting
              ? "Duplicating..."
              : `Add ${count} ${count === 1 ? "bottle" : "bottles"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
