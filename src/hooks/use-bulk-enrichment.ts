"use client";

import { useState, useCallback, useRef } from "react";
import type { Wine } from "@/types/wine";
import { aiEnrichWine, aiFetchWineImage } from "@/server/actions/ai";
import { useTier } from "@/hooks/use-tier";
import { BATCH_ENRICH_MAX } from "@/lib/tier";
import {
  type EnrichResult,
  CONCURRENCY,
  isFullyEnriched,
  deduplicateWines,
  buildInitialResults,
  buildWineUpdates,
  buildWineInput,
  countUnique,
} from "@/components/wine/bulk-enrich-utils";

type ResultUpdater = React.Dispatch<React.SetStateAction<EnrichResult[]>>;

/** Update a single result entry by index */
function updateResultAt(
  setResults: ResultUpdater,
  idx: number,
  patch: Partial<EnrichResult>
) {
  setResults((prev) =>
    prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
  );
}

/** Process a single wine: call AI, apply updates to wine + duplicates.
 *  With `fetchImages`, also backfills a label image for wines missing one —
 *  including wines whose TEXT is already fully enriched (image-only pass). */
async function processOneWine(
  wine: Wine,
  idx: number,
  dupes: Wine[],
  userId: string | undefined,
  onUpdate: (wineId: string, updates: Partial<Wine>) => Promise<void>,
  setResults: ResultUpdater,
  fetchImages: boolean
): Promise<void> {
  updateResultAt(setResults, idx, { status: "processing" });

  try {
    const wineInput = buildWineInput(wine);
    const textNeeded = !isFullyEnriched(wine);
    let updates: Partial<Wine> = {};

    if (textNeeded) {
      const result = await aiEnrichWine(wineInput, userId ?? undefined);
      if (!result.success) {
        updateResultAt(setResults, idx, { status: "error", error: result.error });
        return;
      }
      updates = buildWineUpdates(wine, result.data);
    }

    // Image backfill — best-effort: an image miss never fails the wine's
    // text enrichment. aiFetchWineImage checks the shared image cache first
    // (free); only cache misses spend find_image credits.
    let imageFound = false;
    let imageFailReason: string | null = null;
    if (fetchImages && !wine.imageUrl) {
      try {
        // 45s: Gemini's search grounding regularly takes 20-30s — the old
        // 20s cap produced client-side timeouts on searches that then
        // completed (and cached) server-side. Verified live 2026-08-02.
        const img = await Promise.race([
          aiFetchWineImage(wineInput, userId ?? undefined),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 45000)
          ),
        ]);
        if (
          img.success &&
          img.data.imageUrl &&
          (img.data.imageUrl.startsWith("data:") || img.data.imageUrl.startsWith("http"))
        ) {
          updates.imageUrl = img.data.imageUrl;
          imageFound = true;
        } else if (!img.success) {
          // Gate rejections (tier / credits) and provider errors must be
          // VISIBLE — masking them as "no image found" hid a systematic
          // failure where zero searches actually ran.
          imageFailReason =
            img.code === "UPGRADE_REQUIRED"
              ? "Image search needs Cellar+ on your account (server-side tier)"
              : img.code === "CREDITS_EXHAUSTED"
                ? "AI credits exhausted"
                : img.error || "Image search failed";
        } else {
          imageFailReason = "No label image found";
        }
      } catch (err) {
        imageFailReason =
          err instanceof Error && err.message === "timeout"
            ? "Image search timed out"
            : "Image search failed";
      }
    }

    if (Object.keys(updates).length > 0) {
      await onUpdate(wine.id, updates);
      // Apply same updates to all duplicates (no extra AI call)
      for (const dupe of dupes) {
        try {
          await onUpdate(dupe.id, updates);
        } catch {
          // best-effort
        }
      }
    }

    // Image-only wines where no image turned up did nothing useful — report
    // the REAL reason (gate rejection / provider error / genuine miss).
    if (!textNeeded && fetchImages && !imageFound) {
      const reason = imageFailReason ?? "No label image found";
      updateResultAt(setResults, idx, {
        status: reason === "No label image found" ? "skipped" : "error",
        error: reason,
      });
    } else {
      updateResultAt(setResults, idx, { status: "success" });
    }
  } catch (err) {
    updateResultAt(setResults, idx, {
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

export interface BulkEnrichmentState {
  running: boolean;
  results: EnrichResult[];
  processedCount: number;
  completedCount: number;
  errorCount: number;
  skippedCount: number;
  totalCount: number;
  winesNeedingEnrichment: Wine[];
  alreadyEnrichedCount: number;
  uniqueCount: number;
  dupeCount: number;
  /** Image backfill: when on, wines missing a label image are included
   *  (even if their text is already enriched) and get an AI image search. */
  fetchImages: boolean;
  setFetchImages: (v: boolean) => void;
  imagesMissingCount: number;
  handleStart: () => Promise<void>;
  handleStop: () => void;
  resetState: () => void;
}

export function useBulkEnrichment(
  wines: Wine[],
  onUpdate: (wineId: string, updates: Partial<Wine>) => Promise<void>
): BulkEnrichmentState {
  const { userId } = useTier();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<EnrichResult[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [fetchImages, setFetchImages] = useState(false);
  const abortRef = useRef(false);

  const completedCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  const totalCount = results.length;

  const imagesMissingCount = wines.filter((w) => !w.imageUrl).length;
  // With image backfill on, wines that only lack a photo join the batch.
  const winesNeedingEnrichment = wines
    .filter((w) => !isFullyEnriched(w) || (fetchImages && !w.imageUrl))
    .slice(0, BATCH_ENRICH_MAX);
  const alreadyEnrichedCount =
    wines.length - wines.filter((w) => !isFullyEnriched(w)).length;
  const uniqueCount = countUnique(winesNeedingEnrichment);
  const dupeCount = winesNeedingEnrichment.length - uniqueCount;

  const resetState = useCallback(() => {
    setRunning(false);
    setResults([]);
    setProcessedCount(0);
    abortRef.current = false;
  }, []);

  const handleStop = useCallback(() => {
    abortRef.current = true;
    setRunning(false);
  }, []);

  const handleStart = useCallback(async () => {
    if (winesNeedingEnrichment.length === 0) return;

    const { uniqueWines, dupeMap } = deduplicateWines(winesNeedingEnrichment);
    const initialResults = buildInitialResults(uniqueWines, dupeMap);

    setResults(initialResults);
    setRunning(true);
    setProcessedCount(0);
    abortRef.current = false;

    // Worker pool with shared index counter
    let nextIdx = 0;
    const total = uniqueWines.length;

    const worker = async () => {
      while (!abortRef.current) {
        const idx = nextIdx++;
        if (idx >= total) break;
        await processOneWine(
          uniqueWines[idx],
          idx,
          dupeMap.get(idx) || [],
          userId ?? undefined,
          onUpdate,
          setResults,
          fetchImages
        );
        setProcessedCount((c) => c + 1);
      }
    };

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, total) },
      () => worker()
    );
    await Promise.all(workers);

    setRunning(false);
  }, [winesNeedingEnrichment, onUpdate, userId, fetchImages]);

  return {
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
  };
}
