"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, ThumbsUp, ThumbsDown, Compass, Wine as WineIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StarRating } from "@/components/ui/star-rating";
import { cn } from "@/lib/utils";
import { fetchTasteProfileEntries } from "@/lib/data";
import { useAuth } from "@/components/auth-provider";
import { WINE_TYPE_LABELS } from "@/types/constants";

// Vivino's Taste Profile: "What you've tried / like / dislike" by wine style,
// region, and grape. Pure aggregation over rated wines + history — no AI, so
// it's available to every tier and costs nothing to compute.

type Dimension = "style" | "region" | "grape";

interface Entry {
  /** Display label for the bucket (e.g. "Red", "Bordeaux", "Malbec") */
  label: string;
  rating: number | null;
}

interface Bucket {
  label: string;
  count: number;
  rated: number;
  avg: number | null;
}

const DISLIKE_THRESHOLD = 2.5; // absolute: a 2.5★ average is a dislike at any generosity
/** A bucket needs this many rated bottles before we trust its average. */
const MIN_RATED_FOR_PREF = 2;

function splitGrapes(raw: string): string[] {
  return raw
    .split(/[,/&]| and /i)
    .map((grape) => grape.trim())
    .filter((grape) => grape.length > 1);
}

function labelFor(dim: Dimension, row: { type: string; region: string; country: string; grapeVariety: string }): string[] {
  if (dim === "style") {
    return [WINE_TYPE_LABELS[row.type as keyof typeof WINE_TYPE_LABELS] || row.type || "Unknown"];
  }
  if (dim === "region") {
    const region = row.region?.trim();
    if (region) return [region];
    const country = row.country?.trim();
    return country ? [country] : [];
  }
  return splitGrapes(row.grapeVariety || "");
}

function aggregate(entries: Entry[]): Bucket[] {
  const map = new Map<string, { count: number; sum: number; rated: number }>();
  for (const entry of entries) {
    const totals = map.get(entry.label) ?? { count: 0, sum: 0, rated: 0 };
    totals.count += 1;
    if (entry.rating != null && entry.rating > 0) {
      totals.sum += entry.rating;
      totals.rated += 1;
    }
    map.set(entry.label, totals);
  }
  return [...map.entries()].map(([label, totals]) => ({
    label,
    count: totals.count,
    rated: totals.rated,
    avg: totals.rated > 0 ? totals.sum / totals.rated : null,
  }));
}

function PrefRow({ bucket, max }: { bucket: Bucket; max: number }) {
  const pct = max > 0 ? Math.round((bucket.count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{bucket.label}</span>
          <span className="shrink-0 flex items-center gap-2">
            {bucket.avg != null && <StarRating value={bucket.avg} compact size={12} />}
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {bucket.count} {bucket.count === 1 ? "bottle" : "bottles"}
            </span>
          </span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  accent,
  buckets,
  max,
  empty,
}: {
  title: string;
  icon: typeof ThumbsUp;
  accent: string;
  buckets: Bucket[];
  max: number;
  empty: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={cn("h-4 w-4", accent)} />
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {buckets.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">{empty}</p>
        ) : (
          <div className="divide-y divide-border/60">
            {buckets.map((bucket) => (
              <PrefRow key={bucket.label} bucket={bucket} max={max} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TasteProfilePage() {
  const { userId } = useAuth();
  const [rows, setRows] = useState<
    import("@/server/actions/wines").TasteProfileEntryRow[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [dim, setDim] = useState<Dimension>("style");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Slim entries only: this page aggregates labels + ratings and must
        // not pull the ~10 MB of base64 label images that full wines+history
        // carried for a long-lived account (that fetch failed on mobile and
        // rendered the page empty).
        const entries = await fetchTasteProfileEntries(userId);
        if (!active) return;
        setRows(entries);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  // Flatten cellar + history rows into rating-bearing entries for the chosen
  // dimension. History rows arrive with consumeRating already preferred.
  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const row of rows) {
      for (const label of labelFor(dim, row)) {
        out.push({ label, rating: row.rating });
      }
    }
    return out;
  }, [rows, dim]);

  const { liked, disliked, tried, max, totalRated } = useMemo(() => {
    const buckets = aggregate(entries);
    const totalRated = buckets.reduce((sum, bucket) => sum + bucket.rated, 0);
    const max = buckets.reduce((highest, bucket) => Math.max(highest, bucket.count), 0);
    const rateable = buckets.filter((bucket) => bucket.rated >= MIN_RATED_FOR_PREF && bucket.avg != null);
    // "Like" is relative to the owner's own generosity: a rater whose whole
    // cellar averages 3.8★ never crosses an absolute 4.0 cutoff and saw
    // "rate more 4★+" after 700+ rated bottles (2026-09-12). Above the
    // owner's personal average (floored at 3.0 so rounding noise near a
    // low mean can't crown a mediocre style) counts as a like.
    const ratedEntries = entries.filter((entry) => entry.rating != null && entry.rating > 0);
    const personalMean =
      ratedEntries.length > 0
        ? ratedEntries.reduce((sum, entry) => sum + (entry.rating as number), 0) / ratedEntries.length
        : 0;
    const likeCutoff = Math.max(3.0, personalMean);
    const liked = rateable
      .filter((bucket) => (bucket.avg as number) >= likeCutoff)
      .sort((a, b) => (b.avg as number) - (a.avg as number) || b.count - a.count)
      .slice(0, 6);
    const disliked = rateable
      .filter((bucket) => (bucket.avg as number) <= DISLIKE_THRESHOLD)
      .sort((a, b) => (a.avg as number) - (b.avg as number) || b.count - a.count)
      .slice(0, 6);
    const tried = [...buckets].sort((a, b) => b.count - a.count).slice(0, 8);
    return { liked, disliked, tried, max, totalRated };
  }, [entries]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 w-full animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Taste Profile"
        icon={Sparkles}
        subtitle={`What you like, what you don't, and what you've explored — by ${dim}.`}
      />

      {/* Dimension switch */}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { key: "style", label: "Style" },
            { key: "region", label: "Region" },
            { key: "grape", label: "Grape" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setDim(key)}
            className={cn(
              "h-9 rounded-lg text-sm font-medium transition-colors border",
              dim === key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {totalRated === 0 ? (
        <EmptyState
          icon={WineIcon}
          title="Rate some wines first"
          description={`Your taste profile is built from the bottles you rate. Rate a few wines and your likes, dislikes, and most-explored ${dim}s will appear here.`}
          action={{ label: "Go to your cellar", href: "/cellar" }}
        />
      ) : (
        <div className="space-y-4">
          <Section
            title="What you like"
            icon={ThumbsUp}
            accent="text-green-500"
            buckets={liked}
            max={max}
            empty={`Rate more ${dim}s to see your favorites.`}
          />
          <Section
            title="Not your thing"
            icon={ThumbsDown}
            accent="text-orange-500"
            buckets={disliked}
            max={max}
            empty={`Nothing you've rated low yet — your ${dim}s are landing well.`}
          />
          <Section
            title="Most explored"
            icon={Compass}
            accent="text-primary"
            buckets={tried}
            max={max}
            empty="Add wines to start exploring."
          />
        </div>
      )}
    </div>
  );
}
