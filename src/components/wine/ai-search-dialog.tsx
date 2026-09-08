"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles, Search, Wine as WineIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTier } from "@/hooks/use-tier";
import { aiSearchWineSuggestions, aiSearchWine } from "@/server/actions/ai";
import type { WineSuggestion } from "@/lib/ai";
import { WINE_TYPE_COLORS, WINE_TYPE_LABELS } from "@/types/constants";
import type { WineType } from "@/types/wine";

const MAX_RESULTS = 20;

export interface AISearchFillData {
  /** Present when the picked candidate came with a full AI identification
   * (description, alcohol, price, drink window, critic ratings, etc.) */
  description?: string;
  alcohol?: string;
  estimatedPrice?: number | null;
  drinkBy?: string;
  drinkWindow?: string;
  disposition?: string;
  ratings?: {
    rating_ws?: number | null;
    rating_rp?: number | null;
    rating_jd?: number | null;
    rating_ag?: number | null;
  } | null;
  sparkling?: boolean;
}

interface AISearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Initial query seeded from whatever the user already typed in the form */
  initialQuery: string;
  /**
   * Called when the user picks a result. Receives the lightweight
   * suggestion immediately (core fields), plus — once the full
   * identification call resolves — any extra fields in `fill`.
   * Parent fills only empty form fields so it never clobbers user input.
   */
  onPick: (pick: WineSuggestion, fill: AISearchFillData) => void;
}

/**
 * Two-step AI Search: shows up to 20 candidate wines matching the user's
 * partial query. Picking one triggers a richer AI identification call
 * that fills description / alcohol / price / drink window / critic scores.
 */
export function AISearchDialog({
  open,
  onOpenChange,
  initialQuery,
  onPick,
}: AISearchDialogProps) {
  const { userId } = useTier();
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<WineSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pickingIdx, setPickingIdx] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Reset state when the dialog opens with a new query
  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setResults([]);
    setError(null);
    setHasSearched(false);
    setPickingIdx(null);
  }, [open, initialQuery]);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setResults([]);
        setError(trimmed ? "Type at least 2 characters" : null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await aiSearchWineSuggestions(trimmed, userId ?? undefined, MAX_RESULTS);
        if (res.success) {
          setResults(res.data.suggestions ?? []);
        } else {
          setResults([]);
          setError(res.error || "Search failed");
        }
      } catch (err) {
        setResults([]);
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
        setHasSearched(true);
      }
    },
    [userId]
  );

  // Auto-run the initial search when the dialog opens with a meaningful query
  useEffect(() => {
    if (!open) return;
    if (initialQuery.trim().length >= 2) {
      runSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handlePick = async (s: WineSuggestion, idx: number) => {
    setPickingIdx(idx);
    try {
      // Richer identification call — pulls description, critic scores, drink
      // window, alcohol, etc. Query includes the winery + vintage so AI
      // identifies the specific bottling we want.
      const parts = [s.name, s.winery, s.vintage ? String(s.vintage) : ""].filter(Boolean);
      const fullQuery = parts.join(" ");
      const fill: AISearchFillData = {};
      try {
        const full = await aiSearchWine(fullQuery, userId ?? undefined);
        if (full.success) {
          fill.description = full.data.description;
          fill.alcohol = full.data.alcohol;
          fill.estimatedPrice = full.data.estimatedPrice;
          fill.drinkBy = full.data.drinkBy;
          fill.drinkWindow = full.data.drinkWindow;
          fill.disposition = full.data.disposition;
          fill.ratings = full.data.ratings ?? null;
          fill.sparkling = full.data.sparkling;
        }
      } catch {
        // Full-detail call is best-effort — still pick the suggestion with
        // whatever core fields we have.
      }
      onPick(s, fill);
      onOpenChange(false);
    } finally {
      setPickingIdx(null);
    }
  };

  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Search
          </DialogTitle>
          <DialogDescription>
            Search a wine name or winery — pick a result to fill in the details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmitSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Opus One 2019, Caymus, Cloudy Bay..."
              className="pl-8"
            />
          </div>
          <Button type="submit" disabled={loading || query.trim().length < 2} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </form>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-4 px-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3 my-2">
              {error}
            </div>
          )}

          {loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Searching...</p>
            </div>
          )}

          {!loading && hasSearched && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <WineIcon className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No matches found</p>
              <p className="text-xs text-muted-foreground/70">
                Try a different spelling, or add the wine manually below.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <ul className="space-y-1.5 py-2">
              {results.map((s, i) => {
                const typeColor = WINE_TYPE_COLORS[s.type as WineType] ?? "#888";
                const typeLabel = WINE_TYPE_LABELS[s.type as WineType] ?? s.type;
                const picking = pickingIdx === i;
                const anyPicking = pickingIdx !== null;
                return (
                  <li key={`${s.name}-${s.winery}-${i}`}>
                    <button
                      type="button"
                      disabled={anyPicking}
                      onClick={() => handlePick(s, i)}
                      className={cn(
                        "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors cursor-pointer",
                        picking
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent/50",
                        anyPicking && !picking && "opacity-50 cursor-wait"
                      )}
                    >
                      <span
                        className="shrink-0 w-3 h-3 rounded-full mt-1.5"
                        style={{ backgroundColor: typeColor }}
                        aria-hidden
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.winery}
                          {s.vintage ? ` \u00B7 ${s.vintage}` : ""}
                          {s.region ? ` \u00B7 ${s.region}` : ""}
                          {s.country && s.region !== s.country
                            ? `, ${s.country}`
                            : ""}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {typeLabel}
                          {s.grapeVariety ? ` \u00B7 ${s.grapeVariety}` : ""}
                        </p>
                      </div>
                      {picking && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0 mt-1" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 shrink-0 border-t pt-3">
          <p className="text-[10px] text-muted-foreground flex-1 text-left">
            Up to {MAX_RESULTS} results · Powered by AI
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
