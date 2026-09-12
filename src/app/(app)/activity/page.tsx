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
import { WINE_TYPE_COLORS, WINE_TYPE_LABELS } from "@/types/constants";
import { isLightWineType } from "@/types/wine";
import type { Wine, WineHistoryItem } from "@/types/wine";

// Vivino's Activity tab: a personal feed of your wine moments — bottles added,
// tasted, rated, removed — newest first. Built by merging owned wines (addedAt)
// with history events (removedAt) into one timeline.

type Kind = "added" | "drank" | "gifted" | "sold" | "broken" | "spoiled" | "other";

interface Event {
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
function historyToWine(h: WineHistoryItem): Wine {
  return {
    id: `history-${h.id}`,
    userId: "",
    cabinetId: null,
    barcode: "",
    name: h.name,
    winery: h.winery ?? "",
    region: h.region ?? "",
    country: h.country ?? "",
    vintage: h.vintage ?? null,
    type: ((h.type || "red").toLowerCase()) as Wine["type"],
    sparkling: false,
    grapeVariety: h.grapeVariety ?? "",
    userRating: (h.consumeRating ?? h.rating) ?? null,
    imageUrl: h.imageUrl ?? "",
    price: h.price ?? null,
    retailPrice: h.retailPrice ?? null,
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
    tastingNotes: h.consumeNotes || null,
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
  const s = Math.max(1, Math.round((now - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(d / 365)}y ago`;
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
        const [w, h] = await Promise.all([fetchWines(userId), fetchRecentHistory(userId, ACTIVITY_HISTORY_LIMIT)]);
        if (!active) return;
        setWines(w);
        setHistory(h);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const events = useMemo<Event[]>(() => {
    const evs: Event[] = [];
    for (const w of wines) {
      const t = w.addedAt ? Date.parse(w.addedAt) : NaN;
      if (Number.isNaN(t)) continue;
      evs.push({
        id: `add-${w.id}`,
        kind: "added",
        name: w.name,
        winery: w.winery,
        vintage: w.vintage,
        type: w.type,
        rating: w.userRating ?? null,
        notes: "",
        imageUrl: w.imageUrl || null,
        at: t,
        wine: w,
      });
    }
    for (const h of history) {
      const t = h.removedAt ? Date.parse(h.removedAt) : NaN;
      if (Number.isNaN(t)) continue;
      const kind = (KIND_META[h.reason as Kind] ? (h.reason as Kind) : "other");
      evs.push({
        id: `hist-${h.id}`,
        kind,
        name: h.name,
        winery: h.winery,
        vintage: h.vintage,
        type: h.type,
        rating: (h.consumeRating ?? h.rating) ?? null,
        notes: h.consumeNotes || "",
        imageUrl: h.imageUrl || null,
        at: t,
        wine: historyToWine(h),
      });
    }
    return evs.sort((a, b) => b.at - a.at);
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
          {shown.map((e) => {
            const meta = KIND_META[e.kind];
            const Icon = meta.icon;
            const typeColor = WINE_TYPE_COLORS[e.type as keyof typeof WINE_TYPE_COLORS] || "#666";
            return (
              <Card
                key={e.id}
                className="surface-elevated press cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => setDetailWine(e.wine)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    setDetailWine(e.wine);
                  }
                }}
              >
                <CardContent className="p-3 flex gap-3 items-start">
                  {/* Avatar: label photo or type circle, with a kind badge */}
                  <div className="relative shrink-0">
                    {e.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- user label, base64/external
                      <img src={e.imageUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
                    ) : (
                      <div
                        className={cn(
                          "w-11 h-11 rounded-full flex items-center justify-center",
                          isLightWineType(e.type) && "border-2 border-border"
                        )}
                        style={{ backgroundColor: typeColor }}
                      >
                        <WineIcon className="h-5 w-5" style={{ color: isLightWineType(e.type) ? "#333" : "#fff" }} />
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
                      <span className="font-semibold">{e.name}</span>
                      {e.vintage ? <span className="text-muted-foreground"> · {e.vintage}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {e.winery}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {WINE_TYPE_LABELS[e.type as keyof typeof WINE_TYPE_LABELS] || e.type}
                      </Badge>
                      {e.rating != null && e.rating > 0 && (
                        <StarRating value={e.rating} compact size={12} />
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                        {relativeTime(e.at, now)}
                      </span>
                    </div>
                    {e.notes && (
                      <p className="text-[11px] text-muted-foreground/80 italic mt-1 line-clamp-2">
                        &ldquo;{e.notes}&rdquo;
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
          onOpenChange={(o) => {
            if (!o) setDetailWine(null);
          }}
        />
      )}
    </div>
  );
}
