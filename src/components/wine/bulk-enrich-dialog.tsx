"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Wine } from "@/types/wine";
import { useTier } from "@/hooks/use-tier";
import { useBulkEnrichment } from "@/hooks/use-bulk-enrichment";
import { CONCURRENCY } from "@/components/wine/bulk-enrich-utils";
import { EnrichPreRunInfo } from "@/components/wine/enrich-pre-run-info";
import { EnrichProgressView } from "@/components/wine/enrich-progress-view";

interface BulkEnrichDialogProps {
  wines: Wine[];
  onUpdate: (wineId: string, updates: Partial<Wine>) => Promise<void>;
  trigger?: React.ReactElement;
}

export function BulkEnrichDialog({
  wines,
  onUpdate,
  trigger,
}: BulkEnrichDialogProps) {
  const { canUseAi } = useTier();
  const [open, setOpen] = useState(false);

  const enrichment = useBulkEnrichment(wines, onUpdate);

  // Only available on tiers with bulkEnrich (PREMIUM)
  // canUseAi returns false both when the tier lacks bulkEnrich AND when
  // the user has toggled AI features off — perfect for hiding the button.
  if (!canUseAi("bulkEnrich")) {
    return null;
  }

  const {
    running,
    results,
    processedCount,
    completedCount,
    errorCount,
    skippedCount,
    totalCount,
    winesNeedingEnrichment,
    alreadyEnrichedCount,
    uniqueCount,
    dupeCount,
    fetchImages,
    setFetchImages,
    imagesMissingCount,
    handleStart,
    handleStop,
    resetState,
  } = enrichment;

  const isPreRun = !running && results.length === 0;
  const isDone = !running && results.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && running) return;
        setOpen(o);
        if (!o) resetState();
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="ai" size="sm" className="gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              AI Enrich All
            </Button>
          )
        }
      />
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Bulk AI Enrichment
          </DialogTitle>
          <DialogDescription>
            <DescriptionText
              isPreRun={isPreRun}
              running={running}
              isDone={isDone}
              processedCount={processedCount}
              totalCount={totalCount}
              completedCount={completedCount}
              errorCount={errorCount}
            />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-4 py-2 flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
          {isPreRun && (
            <>
              <EnrichPreRunInfo
                winesNeedingCount={winesNeedingEnrichment.length}
                totalWinesCount={wines.length}
                alreadyEnrichedCount={alreadyEnrichedCount}
                uniqueCount={uniqueCount}
                dupeCount={dupeCount}
              />
              {/* Image backfill — pulls in wines that only lack a photo.
                  canUseAi respects both the tier flag and the AI toggle. */}
              {canUseAi("aiFindImage") && imagesMissingCount > 0 && (
                <label className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-amber-500"
                    checked={fetchImages}
                    onChange={(e) => setFetchImages(e.target.checked)}
                  />
                  <span>
                    Also find missing label images
                    <span className="block text-xs text-muted-foreground">
                      {imagesMissingCount} wine{imagesMissingCount === 1 ? "" : "s"} without a
                      photo. Uses image-search credits (5/wine) on cache misses — cached
                      labels are free.
                    </span>
                  </span>
                </label>
              )}
            </>
          )}

          {results.length > 0 && (
            <EnrichProgressView
              results={results}
              completedCount={completedCount}
              errorCount={errorCount}
              skippedCount={skippedCount}
              totalCount={totalCount}
              running={running}
            />
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 px-4 pb-4 shrink-0 border-t pt-3">
          {isPreRun && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleStart}
                disabled={winesNeedingEnrichment.length === 0}
                className="gap-1.5"
              >
                <Sparkles className="h-4 w-4" />
                Enrich {winesNeedingEnrichment.length} Wines
              </Button>
            </>
          )}

          {running && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleStop}
              className="w-full sm:w-auto"
            >
              Stop
            </Button>
          )}

          {isDone && (
            // Close through the same path as backdrop/X so results reset —
            // setOpen alone left stale results on the next open (verified
            // live: reopening showed the previous run instead of pre-run).
            <Button
              onClick={() => {
                setOpen(false);
                resetState();
              }}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Renders the appropriate description text based on enrichment phase */
function DescriptionText({
  isPreRun,
  running,
  isDone,
  processedCount,
  totalCount,
  completedCount,
  errorCount,
}: {
  isPreRun: boolean;
  running: boolean;
  isDone: boolean;
  processedCount: number;
  totalCount: number;
  completedCount: number;
  errorCount: number;
}) {
  if (isPreRun) {
    return (
      <>
        AI will generate food pairings, pricing, drink windows, and critic
        scores in a single call per wine.
      </>
    );
  }
  if (running) {
    return (
      <>
        Processing {processedCount} of {totalCount} wines
        {totalCount > 1
          ? ` (${Math.min(CONCURRENCY, totalCount)} in parallel)`
          : ""}
        ...
      </>
    );
  }
  if (isDone) {
    return (
      <>
        Enrichment complete! {completedCount} succeeded
        {errorCount > 0 && `, ${errorCount} failed`}.
      </>
    );
  }
  return null;
}
