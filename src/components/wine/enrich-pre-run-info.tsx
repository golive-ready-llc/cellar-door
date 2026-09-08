"use client";

import { Wine as WineIcon, ShieldCheck } from "lucide-react";

interface EnrichPreRunInfoProps {
  winesNeedingCount: number;
  totalWinesCount: number;
  alreadyEnrichedCount: number;
  uniqueCount: number;
  dupeCount: number;
}

export function EnrichPreRunInfo({
  winesNeedingCount,
  totalWinesCount,
  alreadyEnrichedCount,
  uniqueCount,
  dupeCount,
}: EnrichPreRunInfoProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
        <WineIcon className="h-8 w-8 text-primary shrink-0" />
        <div>
          <p className="text-sm font-medium">
            {winesNeedingCount} wines need enrichment
          </p>
          <p className="text-xs text-muted-foreground">
            Out of {totalWinesCount} total wines in your cellar
          </p>
        </div>
      </div>

      {alreadyEnrichedCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
          {alreadyEnrichedCount} wine{alreadyEnrichedCount !== 1 ? "s" : ""}{" "}
          already enriched — will be skipped
        </div>
      )}
      {dupeCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          {dupeCount} duplicate{dupeCount !== 1 ? "s" : ""} detected — only{" "}
          {uniqueCount} unique AI calls needed
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <p>For each wine, AI will generate:</p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>Food pairing suggestions</li>
          <li>Market value estimate</li>
          <li>Drink window &amp; readiness assessment</li>
          <li>Estimated critic scores (WS, RP, JD, AG)</li>
          <li>Label photo (if missing)</li>
        </ul>
      </div>
    </div>
  );
}
