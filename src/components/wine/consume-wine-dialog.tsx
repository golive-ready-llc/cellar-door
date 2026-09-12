"use client";

import { useEffect, useState } from "react";
import {
  Wine as WineIcon,
  Star,
  Gift,
  DollarSign,
  AlertTriangle,
  CircleOff,
  HelpCircle,
} from "lucide-react";
import { DialRateDialog } from "./dial-rate-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  WINE_TYPE_COLORS,
} from "@/types/constants";
import { isLightWineType, type Wine } from "@/types/wine";

interface ConsumeWineDialogProps {
  wine: Wine;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConsume: (wineId: string, reason: string, rating?: number | null, notes?: string) => Promise<void>;
}

const REASONS = [
  { id: "drank", label: "Drank", icon: WineIcon, color: "#8B5CF6" },
  { id: "gifted", label: "Gifted", icon: Gift, color: "#EC4899" },
  { id: "sold", label: "Sold", icon: DollarSign, color: "#22C55E" },
  { id: "broken", label: "Broken", icon: AlertTriangle, color: "#EF4444" },
  { id: "spoiled", label: "Spoiled", icon: CircleOff, color: "#F97316" },
  { id: "other", label: "Other", icon: HelpCircle, color: "#6B7280" },
] as const;

export function ConsumeWineDialog({
  wine,
  open,
  onOpenChange,
  onConsume,
}: ConsumeWineDialogProps) {
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [rating, setRating] = useState<number | null>(null);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");

  // The pages that mount this dialog drive `open` themselves, so the Dialog
  // fires no onOpenChange of its own for an open — reset here instead, or a
  // cancelled removal pre-fills the next wine's dialog with the previous
  // wine's reason, rating and notes.
  useEffect(() => {
    if (!open) return;
    setReason("");
    setRating(null);
    setRateDialogOpen(false);
    setNotes("");
  }, [open, wine.id]);

  const handleConfirm = async () => {
    if (!reason) return;
    setSaving(true);
    try {
      await onConsume(wine.id, reason, rating, notes.trim() || undefined);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const typeColor =
    WINE_TYPE_COLORS[wine.type as keyof typeof WINE_TYPE_COLORS] || "#666";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className={cn(
                "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                isLightWineType(wine.type) && "border-2 border-border"
              )}
              style={{ backgroundColor: typeColor }}
            >
              <WineIcon
                className="h-4 w-4"
                style={{ color: isLightWineType(wine.type) ? "#333" : "#fff" }}
              />
            </div>
            Remove Wine
          </DialogTitle>
          <DialogDescription>
            Log what happened to <strong>{wine.name}</strong>
            {wine.vintage ? ` (${wine.vintage})` : ""}. It will be moved to your history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Reason selector — visual icon buttons */}
          <div className="grid gap-2">
            <Label>Reason</Label>
            <div className="grid grid-cols-3 gap-2">
              {REASONS.map((r) => {
                const Icon = r.icon;
                const isSelected = reason === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all cursor-pointer",
                      isSelected
                        ? "shadow-sm"
                        : "border-transparent bg-muted/50 hover:bg-accent/50"
                    )}
                    // Each reason keeps its accent color at ALL times (the
                    // icon), so the six tiles are scannable before any tap.
                    // Selection = that color as border + tint, not a generic
                    // highlight.
                    style={
                      isSelected
                        ? { borderColor: r.color, backgroundColor: `${r.color}24` }
                        : undefined
                    }
                    onClick={() => setReason(r.id)}
                  >
                    <Icon className="h-5 w-5" style={{ color: r.color }} />
                    <span
                      className={cn(
                        "text-xs font-medium",
                        !isSelected && "text-muted-foreground"
                      )}
                    >
                      {r.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rating (optional) */}
          <div className="grid gap-2">
            <Label>Rating (optional)</Label>
            <button
              type="button"
              className={cn(
                "flex items-center gap-2 rounded-lg border-2 p-3 transition-all cursor-pointer",
                rating != null && rating > 0
                  ? "border-primary bg-accent"
                  : "border-transparent bg-muted/50 hover:bg-accent/50"
              )}
              onClick={() => setRateDialogOpen(true)}
            >
              <Star
                className={cn(
                  "h-5 w-5",
                  rating != null && rating > 0
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-muted-foreground"
                )}
              />
              <span className="text-sm font-medium">
                {rating != null && rating > 0
                  ? `${rating.toFixed(1)} / 5`
                  : "Tap to rate"}
              </span>
            </button>
          </div>
          <DialRateDialog
            open={rateDialogOpen}
            onOpenChange={setRateDialogOpen}
            currentRating={rating}
            title="Rate this wine"
            onRate={(v) => {
              setRating(v > 0 ? v : null);
              setRateDialogOpen(false);
            }}
          />

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="consume-notes">Notes (optional)</Label>
            <Textarea
              id="consume-notes"
              placeholder={
                reason === "drank"
                  ? "How was it? Any tasting impressions..."
                  : "Any additional details..."
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={saving || !reason}
          >
            {saving ? "Saving..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
