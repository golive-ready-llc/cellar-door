"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, ThumbsUp, ThumbsDown, Compass, Star, Wine as WineIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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

const LIKE_THRESHOLD = 4.0;
const DISLIKE_THRESHOLD = 2.5;
/** A bucket needs this many rated bottles before we trust its average. */
const MIN_RATED_FOR_PREF = 2;

function splitGrapes(raw: string): string[] {
  return raw
    .split(/[,/&]| and /i)
    .map((g) => g.trim())
    .filter((g) => g.length > 1);
}

function labelFor(dim: Dimension, e: { type: string; region: string; country: string; grapeVariety: string }): string[] {
  if (dim === "style") {
    return [WINE_TYPE_LABELS[e.type as keyof typeof WINE_TYPE_LABELS] || e.type || "Unknown"];
  }
  if (dim === "region") {
    const r = e.region?.trim();
    if (r) return [r];
    const c = e.country?.trim();
    return c ? [c] : [];
  }
  return splitGrapes(e.grapeVariety || "");
}

function aggregate(entries: Entry[]): Bucket[] {
  const map = new Map<string, { count: number; sum: number; rated: number }>();
  for (const e of entries) {
    const cur = map.get(e.label) ?? { count: 0, sum: 0, rated: 0 };
    cur.count += 1;
    if (e.rating != null && e.rating > 0) {
      cur.sum += e.rating;
      cur.rated += 1;
    }
    map.set(e.label, cur);
  }
  return [...map.entries()].map(([label, v]) => ({
    label,
    count: v.count,
    rated: v.rated,
    avg: v.rated > 0 ? v.sum / v.rated : null,
  }));
}

function StarAvg({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums">
      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
      {value.toFixed(1)}
    </span>
  );
}

function PrefRow({ bucket, max }: { bucket: Bucket; max: number }) {
  const pct = max > 0 ? Math.round((bucket.count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{bucket.label}</span>
          <span className="shrink-0 flex items-center gap-2">
            {bucket.avg != null && <StarAvg value={bucket.avg} />}
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
            {buckets.map((b) => (
              <PrefRow key={b.label} bucket={b} max={max} />
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
    for (const r of rows) {
      for (const label of labelFor(dim, r)) {
        out.push({ label, rating: r.rating });
      }
    }
    return out;
  }, [rows, dim]);

  const { liked, disliked, tried, max, totalRated } = useMemo(() => {
    const buckets = aggregate(entries);
    const totalRated = buckets.reduce((s, b) => s + b.rated, 0);
    const max = buckets.reduce((m, b) => Math.max(m, b.count), 0);
    const rateable = buckets.filter((b) => b.rated >= MIN_RATED_FOR_PREF && b.avg != null);
    const liked = rateable
      .filter((b) => (b.avg as number) >= LIKE_THRESHOLD)
      .sort((a, b) => (b.avg as number) - (a.avg as number) || b.count - a.count)
      .slice(0, 6);
    const disliked = rateable
      .filter((b) => (b.avg as number) <= DISLIKE_THRESHOLD)
      .sort((a, b) => (a.avg as number) - (b.avg as number) || b.count - a.count)
      .slice(0, 6);
    const tried = [...buckets].sort((a, b) => b.count - a.count).slice(0, 8);
    return { liked, disliked, tried, max, totalRated };
  }, [entries]);

  const dimLabel = dim === "style" ? "style" : dim === "region" ? "region" : "grape";

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
        subtitle={`What you like, what you don't, and what you've explored — by ${dimLabel}.`}
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
          description={`Your taste profile is built from the bottles you rate. Rate a few wines and your likes, dislikes, and most-explored ${dimLabel}s will appear here.`}
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
            empty={`Rate more ${dimLabel}s 4★+ to see your favorites.`}
          />
          <Section
            title="Not your thing"
            icon={ThumbsDown}
            accent="text-orange-500"
            buckets={disliked}
            max={max}
            empty={`Nothing you've rated low yet — your ${dimLabel}s are landing well.`}
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
