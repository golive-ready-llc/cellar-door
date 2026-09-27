"use client";

import {
  Wine as WineIcon,
  TrendingUp,
  Calendar,
  DollarSign,
  Grape,
  MapPin,
  Star,
  Clock,
} from "lucide-react";
import { StatCard } from "@/components/stats/stat-card";
import { useCurrency } from "@/hooks/use-currency";
import type { CoreStats } from "@/lib/stats-utils";
import type { Wine, WineHistoryItem } from "@/types/wine";

interface HeroStatCardsProps {
  stats: CoreStats;
  wines: Wine[];
  history: WineHistoryItem[];
}

export function HeroStatCards({ stats, wines, history }: HeroStatCardsProps) {
  // Values are stored in USD; format in the user's selected currency like
  // every other money figure on /stats (ValueTracker, the detail pages) —
  // hardcoded "$" here put two different totals on the same screen.
  const { formatPrice } = useCurrency();

  return (
    <>
      {/* Primary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Bottles"
          value={stats.totalBottles.toString()}
          icon={WineIcon}
          color="var(--primary)"
          href="/stats/bottles"
        />
        <StatCard
          label="Collection Value"
          value={formatPrice(stats.totalValue)}
          icon={DollarSign}
          color="#22c55e"
          subtext={
            stats.totalRetailValue > 0
              ? `~${formatPrice(stats.totalRetailValue)} retail`
              : undefined
          }
          href="/stats/value"
        />
        <StatCard
          label="Avg. Rating"
          value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—"}
          icon={Star}
          color="#eab308"
          subtext={
            stats.avgRating > 0
              ? `of ${wines.filter((w) => w.userRating !== null).length} rated`
              : "No ratings yet"
          }
          href="/stats/ratings"
        />
        <StatCard
          label="Wines Consumed"
          value={stats.totalConsumed.toString()}
          icon={Clock}
          color="#8b5cf6"
          subtext={
            stats.totalConsumed > 0
              ? `${history.filter((h) => h.reason === "drank").length} drank`
              : undefined
          }
          href="/stats/consumed"
        />
      </div>

      {/* Secondary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Avg. Price"
          value={stats.avgPrice > 0 ? formatPrice(stats.avgPrice) : "—"}
          icon={TrendingUp}
          color="#f97316"
          href="/stats/price"
        />
        <StatCard
          label="Oldest Vintage"
          value={stats.oldestVintage?.toString() ?? "—"}
          icon={Calendar}
          color="#6366f1"
          subtext={
            stats.newestVintage
              ? `Newest: ${stats.newestVintage}`
              : undefined
          }
          href="/stats/vintage"
        />
        <StatCard
          label="Countries"
          value={
            new Set(wines.map((w) => w.country).filter(Boolean)).size.toString()
          }
          icon={MapPin}
          color="#ec4899"
          href="/stats/countries"
        />
        <StatCard
          label="Grape Varieties"
          value={
            new Set(
              wines.flatMap((w) =>
                w.grapeVariety
                  ? w.grapeVariety.split(",").map((g) => g.trim())
                  : []
              )
            ).size.toString()
          }
          icon={Grape}
          color="#14b8a6"
          href="/stats/grapes"
        />
      </div>
    </>
  );
}
