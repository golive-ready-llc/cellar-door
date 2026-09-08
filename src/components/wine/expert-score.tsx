"use client";

import { Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { aiRatingsToBaseline } from "@/lib/cd-score";
import { getScoreColor } from "@/components/community/community-score";
import { AI_RATING_LABELS } from "@/types/constants";
import type { AiRatings } from "@/types/wine";

/**
 * The labeled "Expert Score" block shown in the detail-view rating row,
 * between "Your Rating" and the CD Score. A single 0–5 score derived from
 * the AI-estimated public critic ratings (WS / RP / JD / AG) via the same
 * conversion the CD-Score baseline uses, so the two are directly comparable.
 * Renders nothing when no critic has scored the wine — an empty placeholder
 * here would read as missing data on every non-AI context.
 */
export function ExpertScoreInline({
  aiRatings,
}: {
  aiRatings?: AiRatings | null;
}) {
  const score = aiRatingsToBaseline(aiRatings);
  if (score === null) return null;

  const sources = Object.entries(aiRatings ?? {})
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([key, v]) => `${AI_RATING_LABELS[key] || key} ${v}`)
    .join(" · ");

  return (
    <div className="text-center shrink-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        Expert Score
      </p>
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold",
          getScoreColor(score)
        )}
        title={`AI-estimated from public critic scores: ${sources}`}
      >
        <Award className="h-3.5 w-3.5" />
        {score.toFixed(1)}
      </div>
    </div>
  );
}
