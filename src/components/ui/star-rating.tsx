import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  /** 0–5, fractional allowed */
  value: number;
  /** Star pixel size */
  size?: number;
  /** Show the numeric value next to the stars */
  showValue?: boolean;
  /** Compact: a single filled star + the value (for dense list rows). */
  compact?: boolean;
  /** Text size of the numeric value — "sm" for larger list rows */
  valueSize?: "xs" | "sm";
  className?: string;
}

/**
 * Canonical read-only star rating. Full mode renders five stars with a smooth
 * fractional fill; compact mode renders one filled star + the value (for dense
 * rows). One component so every ratings display looks identical.
 */
export function StarRating({ value, size = 14, showValue = false, compact = false, valueSize = "xs", className }: StarRatingProps) {
  const clamped = Math.max(0, Math.min(5, value));
  const valueClass = valueSize === "sm" ? "text-sm" : "text-xs";
  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${clamped.toFixed(1)} out of 5`}>
        <Star className="text-yellow-500 fill-yellow-500" style={{ width: `${size}px`, height: `${size}px` }} />
        <span className={cn(valueClass, "font-semibold tabular-nums")}>{clamped.toFixed(1)}</span>
      </span>
    );
  }
  const pct = (clamped / 5) * 100;
  const px = `${size}px`;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative inline-flex" aria-label={`${clamped.toFixed(1)} out of 5`}>
        {/* Muted base row */}
        <span className="inline-flex">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className="text-muted-foreground/25" style={{ width: px, height: px }} />
          ))}
        </span>
        {/* Gold fill row, clipped to the rating */}
        <span
          className="absolute inset-0 inline-flex overflow-hidden"
          style={{ width: `${pct}%` }}
          aria-hidden
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <Star
              key={i}
              className="shrink-0 text-yellow-500 fill-yellow-500"
              style={{ width: px, height: px }}
            />
          ))}
        </span>
      </span>
      {showValue && (
        <span className={cn(valueClass, "font-semibold tabular-nums")}>{clamped.toFixed(1)}</span>
      )}
    </span>
  );
}

interface RatingDistributionProps {
  /** Individual ratings (0–5); bucketed into 5→1 rows */
  ratings: number[];
  className?: string;
}

/**
 * Vivino-style rating distribution — five bars (5★ at top) sized by how many
 * ratings fall in each bucket.
 */
export function RatingDistribution({ ratings, className }: RatingDistributionProps) {
  const buckets = [0, 0, 0, 0, 0]; // index 0 = 1★ … index 4 = 5★
  for (const r of ratings) {
    const b = Math.min(5, Math.max(1, Math.round(r)));
    buckets[b - 1] += 1;
  }
  const max = Math.max(1, ...buckets);
  const total = ratings.length;

  return (
    <div className={cn("space-y-1", className)}>
      {[5, 4, 3, 2, 1].map((star) => {
        const count = buckets[star - 1];
        const pct = Math.round((count / max) * 100);
        return (
          <div key={star} className="flex items-center gap-2">
            <span className="w-3 text-[11px] text-muted-foreground tabular-nums text-right">{star}</span>
            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-yellow-500/80" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-6 text-[11px] text-muted-foreground tabular-nums">{count}</span>
          </div>
        );
      })}
      <p className="text-[11px] text-muted-foreground pt-0.5">
        {total} {total === 1 ? "rating" : "ratings"}
      </p>
    </div>
  );
}
