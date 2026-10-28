"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  Wine as WineIcon,
  Plus,
  Gift,
  DollarSign,
  AlertTriangle,
  CircleOff,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { WineDetailDialog } from "@/components/wine/wine-detail-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { StarRating } from "@/components/ui/star-rating";
import { cn } from "@/lib/utils";
import { fetchWines, fetchRecentHistory } from "@/lib/data";
import { useAuth } from "@/components/auth-provider";
import { WINE_TYPE_COLORS, WINE_TYPE_LABELS, type RemovalReasonId } from "@/types/constants";
import { isLightWineType } from "@/types/wine";
import type { Wine, WineHistoryItem } from "@/types/wine";

// Vivino's Activity tab: a personal feed of your wine moments — bottles added,
// tasted, rated, removed — newest first. Built by merging owned wines (addedAt)
// with history events (removedAt) into one timeline.

type Kind = "added" | RemovalReasonId;

interface ActivityEvent {
  id: string;
  kind: Kind;
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  rating: number | null;
  notes: string;
  imageUrl: string | null;
  at: number; // epoch ms
  /** The wine to show when the event is tapped — the owned Wine for "added"
   *  events, or a read-only Wine reconstructed from the history record. */
  wine: Wine;
}

/** Build a read-only Wine from a history record so tapping a removed-wine
 *  event opens the same detail shell as everything else. */
function historyToWine(item: WineHistoryItem): Wine {
  return {
    id: `history-${item.id}`,
    userId: "",
    cabinetId: null,
    barcode: "",
    name: item.name,
    winery: item.winery ?? "",
    region: item.region ?? "",
    country: item.country ?? "",
    vintage: item.vintage ?? null,
    type: ((item.type || "red").toLowerCase()) as Wine["type"],
    sparkling: false,
    grapeVariety: item.grapeVariety ?? "",
    userRating: (item.consumeRating ?? item.rating) ?? null,
    imageUrl: item.imageUrl ?? "",
    price: item.price ?? null,
    retailPrice: item.retailPrice ?? null,
    purchaseDate: "",
    drinkBy: "",
    notes: "",
    description: "",
    foodPairings: "",
    alcohol: "",
    row: null,
    col: null,
    depth: 0,
    zone: "",
    tastingNotes: item.consumeNotes || null,
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    tags: [],
    addedAt: "",
    updatedAt: "",
  };
}

const KIND_META: Record<Kind, { verb: string; icon: typeof WineIcon; color: string }> = {
  added: { verb: "Added", icon: Plus, color: "#22C55E" },
  drank: { verb: "Tasted", icon: WineIcon, color: "#8B1A1A" },
  gifted: { verb: "Gifted", icon: Gift, color: "#A855F7" },
  sold: { verb: "Sold", icon: DollarSign, color: "#3B82F6" },
  broken: { verb: "Broke", icon: AlertTriangle, color: "#F97316" },
  spoiled: { verb: "Spoiled", icon: CircleOff, color: "#EF4444" },
  other: { verb: "Removed", icon: HelpCircle, color: "#6B7280" },
};

function relativeTime(ms: number, now: number): string {
  const seconds = Math.max(1, Math.round((now - ms) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

const PAGE = 30;
// The feed pages through recent events, so it doesn't need a lifetime of
// history (which only grows). 300 events is ten pages of scrolling.
const ACTIVITY_HISTORY_LIMIT = 300;

export default function ActivityPage() {
  const { userId } = useAuth();
  const [wines, setWines] = useState<Wine[]>([]);
  const [history, setHistory] = useState<WineHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(PAGE);
  const [detailWine, setDetailWine] = useState<Wine | null>(null);
  // Captured once on mount so relative-time strings stay stable across renders.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [fetchedWines, fetchedHistory] = await Promise.all([fetchWines(userId), fetchRecentHistory(userId, ACTIVITY_HISTORY_LIMIT)]);
        if (!active) return;
        setWines(fetchedWines);
        setHistory(fetchedHistory);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const events = useMemo<ActivityEvent[]>(() => {
    const timeline: ActivityEvent[] = [];
    for (const wine of wines) {
      const at = wine.addedAt ? Date.parse(wine.addedAt) : NaN;
      if (Number.isNaN(at)) continue;
      timeline.push({
        id: `add-${wine.id}`,
        kind: "added",
        name: wine.name,
        winery: wine.winery,
        vintage: wine.vintage,
        type: wine.type,
        rating: wine.userRating ?? null,
        notes: "",
        imageUrl: wine.imageUrl || null,
        at,
        wine,
      });
    }
    for (const item of history) {
      const at = item.removedAt ? Date.parse(item.removedAt) : NaN;
      if (Number.isNaN(at)) continue;
      const kind = (KIND_META[item.reason as Kind] ? (item.reason as Kind) : "other");
      timeline.push({
        id: `hist-${item.id}`,
        kind,
        name: item.name,
        winery: item.winery,
        vintage: item.vintage,
        type: item.type,
        rating: (item.consumeRating ?? item.rating) ?? null,
        notes: item.consumeNotes || "",
        imageUrl: item.imageUrl || null,
        at,
        wine: historyToWine(item),
      });
    }
    return timeline.sort((a, b) => b.at - a.at);
  }, [wines, history]);

  const shown = events.slice(0, visible);
  const hasMore = visible < events.length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex gap-3 items-start rounded-xl border border-border surface-elevated p-3"
            >
              <div className="w-11 h-11 rounded-full bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3.5 w-2/3 rounded bg-muted animate-pulse" />
                <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                <div className="h-3 w-1/4 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        icon={ActivityIcon}
        subtitle="Your wine moments — added, tasted, and rated."
      />

      {events.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="No activity yet"
          description="Add a bottle or log a tasting and it'll show up here as a feed."
          action={{ label: "Add a wine", href: "/cellar" }}
        />
      ) : (
        <div className="space-y-2">
          {shown.map((event) => {
            const meta = KIND_META[event.kind];
            const Icon = meta.icon;
            const typeColor = WINE_TYPE_COLORS[event.type as keyof typeof WINE_TYPE_COLORS] || "#666";
            return (
              <Card
                key={event.id}
                className="surface-elevated press cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => setDetailWine(event.wine)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    setDetailWine(event.wine);
                  }
                }}
              >
                <CardContent className="p-3 flex gap-3 items-start">
                  {/* Avatar: label photo or type circle, with a kind badge */}
                  <div className="relative shrink-0">
                    {event.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- user label, base64/external
                      <img src={event.imageUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
                    ) : (
                      <div
                        className={cn(
                          "w-11 h-11 rounded-full flex items-center justify-center",
                          isLightWineType(event.type) && "border-2 border-border"
                        )}
                        style={{ backgroundColor: typeColor }}
                      >
                        <WineIcon className="h-5 w-5" style={{ color: isLightWineType(event.type) ? "#333" : "#fff" }} />
                      </div>
                    )}
                    <span
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-background"
                      style={{ backgroundColor: meta.color }}
                      title={meta.verb}
                    >
                      <Icon className="h-3 w-3 text-white" />
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">
                      <span className="font-medium" style={{ color: meta.color }}>
                        {meta.verb}
                      </span>{" "}
                      <span className="font-semibold">{event.name}</span>
                      {event.vintage ? <span className="text-muted-foreground"> · {event.vintage}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {event.winery}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {WINE_TYPE_LABELS[event.type as keyof typeof WINE_TYPE_LABELS] || event.type}
                      </Badge>
                      {event.rating != null && event.rating > 0 && (
                        <StarRating value={event.rating} compact size={12} />
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                        {relativeTime(event.at, now)}
                      </span>
                    </div>
                    {event.notes && (
                      <p className="text-[11px] text-muted-foreground/80 italic mt-1 line-clamp-2">
                        &ldquo;{event.notes}&rdquo;
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE)}
                className="text-sm text-primary hover:underline"
              >
                Show more ({events.length - visible} older)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Read-only detail when an activity item is tapped */}
      {detailWine && (
        <WineDetailDialog
          wine={detailWine}
          open={!!detailWine}
          onOpenChange={(open) => {
            if (!open) setDetailWine(null);
          }}
        />
      )}
    </div>
  );
}
