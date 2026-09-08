"use client";

import {
  Loader2,
  Check,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EnrichResult } from "@/components/wine/bulk-enrich-utils";

const STATUS_ICON: Record<EnrichResult["status"], React.ReactNode> = {
  pending: <span className="w-4 h-4 rounded-full border border-border shrink-0" />,
  processing: <Loader2 className="h-4 w-4 text-amber-500 animate-spin shrink-0" />,
  success: <Check className="h-4 w-4 text-green-500 shrink-0" />,
  error: <AlertCircle className="h-4 w-4 text-destructive shrink-0" />,
  skipped: <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />,
};

function ResultRow({ result, index }: { result: EnrichResult; index: number }) {
  return (
    <div
      className={cn(
        "text-xs py-1.5 px-2 rounded",
        result.status === "processing" && "bg-amber-50/50 dark:bg-amber-950/20",
        result.status === "success" && "opacity-60",
        result.status === "skipped" && "opacity-60"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-5 text-right shrink-0">
          {index + 1}.
        </span>
        {STATUS_ICON[result.status]}
        <span className="flex-1 min-w-0 truncate">{result.wineName}</span>
      </div>
      {/* The WHY. Without this line every failure mode — tier rejection,
          exhausted credits, provider error, genuine no-image — looked
          identical, which hid a run where zero image searches executed. */}
      {result.error && (result.status === "error" || result.status === "skipped") && (
        <p
          className={cn(
            "ml-11 mt-0.5 text-[10px] leading-tight",
            result.status === "error" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {result.error}
        </p>
      )}
    </div>
  );
}

interface EnrichProgressViewProps {
  results: EnrichResult[];
  completedCount: number;
  errorCount: number;
  skippedCount: number;
  totalCount: number;
  running: boolean;
}

export function EnrichProgressView({
  results,
  completedCount,
  errorCount,
  skippedCount,
  totalCount,
  running,
}: EnrichProgressViewProps) {
  const donePercent = ((completedCount + errorCount + skippedCount) / totalCount) * 100;

  return (
    <>
      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-amber-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${donePercent}%` }}
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          <Check className="h-3 w-3 mr-1 text-green-500" />
          {completedCount} done
        </Badge>
        {errorCount > 0 && (
          <Badge variant="outline" className="text-xs text-destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            {errorCount} failed
          </Badge>
        )}
        {running && (
          <Badge variant="outline" className="text-xs text-amber-600">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        )}
      </div>

      {/* Wine list — parent dialog owns scrolling */}
      <div className="space-y-1 border border-border rounded-lg p-2 min-w-0 overflow-hidden">
        {results.map((result, idx) => (
          <ResultRow key={result.wineId} result={result} index={idx} />
        ))}
      </div>
    </>
  );
}
