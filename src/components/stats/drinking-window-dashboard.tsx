"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Wine as WineIcon, GlassWater, Clock, AlertTriangle, Shield } from "lucide-react";
import {
  getDrinkWindowStats,
  getDrinkWindowTimeline,
  DRINK_CATEGORY_LABELS,
  DRINK_CATEGORY_COLORS,
  type DrinkCategory,
} from "@/lib/drink-window";
import {
  WINE_TYPE_COLORS,
  WINE_TYPE_LABELS,
} from "@/types/constants";
import type { Wine, WineType } from "@/types/wine";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

interface DrinkingWindowDashboardProps {
  wines: Wine[];
  onWineClick?: (wine: Wine) => void;
  onCategoryClick?: (label: string, wines: Wine[]) => void;
}

const CATEGORY_ICONS: Record<DrinkCategory, typeof WineIcon> = {
  "drink-now": GlassWater,
  approaching: Clock,
  "past-peak": AlertTriangle,
  hold: Shield,
};

export function DrinkingWindowDashboard({ wines, onWineClick, onCategoryClick }: DrinkingWindowDashboardProps) {
  const stats = useMemo(() => getDrinkWindowStats(wines), [wines]);
  const timeline = useMemo(() => getDrinkWindowTimeline(wines), [wines]);

  const categories: DrinkCategory[] = ["drink-now", "approaching", "past-peak", "hold"];

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <GlassWater className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-semibold text-base">Drinking Window</h2>
      </div>

      {/* 4 category summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat];
          const color = DRINK_CATEGORY_COLORS[cat];
          const count = stats[cat].length;
          return (
            <Card
              key={cat}
              className={cn(
                onCategoryClick && count > 0 && "cursor-pointer hover:border-primary/30 hover:shadow-md active:scale-[0.98] transition-all"
              )}
              onClick={onCategoryClick && count > 0 ? () => onCategoryClick(DRINK_CATEGORY_LABELS[cat], stats[cat]) : undefined}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                      {DRINK_CATEGORY_LABELS[cat]}
                    </p>
                    <p className="text-2xl font-bold mt-0.5">{count}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {wines.length > 0
                        ? `${Math.round((count / wines.length) * 100)}% of cellar`
                        : "—"}
                    </p>
                  </div>
                  <div
                    className="p-1.5 rounded-lg shrink-0"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Timeline chart */}
      {timeline.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold text-sm mb-4">
              Drinking Timeline by Window Start Year
            </h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeline}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "11px" }}
                  />
                  <Bar
                    dataKey="drinkNow"
                    name="Drink Now"
                    stackId="a"
                    fill={DRINK_CATEGORY_COLORS["drink-now"]}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="approaching"
                    name="Approaching"
                    stackId="a"
                    fill={DRINK_CATEGORY_COLORS.approaching}
                  />
                  <Bar
                    dataKey="hold"
                    name="Hold"
                    stackId="a"
                    fill={DRINK_CATEGORY_COLORS.hold}
                  />
                  <Bar
                    dataKey="pastPeak"
                    name="Past Peak"
                    stackId="a"
                    fill={DRINK_CATEGORY_COLORS["past-peak"]}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drink Now wines — scrollable row */}
      {stats["drink-now"].length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: DRINK_CATEGORY_COLORS["drink-now"] }}
              />
              <h3 className="font-semibold text-sm">
                Wines to Drink Now ({stats["drink-now"].length})
              </h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
              {stats["drink-now"].slice(0, 30).map((wine) => (
                <WineCard key={wine.id} wine={wine} accent={DRINK_CATEGORY_COLORS["drink-now"]} onClick={onWineClick} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past Peak wines — scrollable row */}
      {stats["past-peak"].length > 0 && (
        <Card className="border-red-200/50 dark:border-red-900/30">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: DRINK_CATEGORY_COLORS["past-peak"] }}
              />
              <h3 className="font-semibold text-sm">
                Past Peak — Consider Drinking Soon ({stats["past-peak"].length})
              </h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
              {stats["past-peak"].slice(0, 30).map((wine) => (
                <WineCard key={wine.id} wine={wine} accent={DRINK_CATEGORY_COLORS["past-peak"]} onClick={onWineClick} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approaching Peak wines */}
      {stats.approaching.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: DRINK_CATEGORY_COLORS.approaching }}
              />
              <h3 className="font-semibold text-sm">
                Approaching Peak ({stats.approaching.length})
              </h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
              {stats.approaching.slice(0, 30).map((wine) => (
                <WineCard key={wine.id} wine={wine} accent={DRINK_CATEGORY_COLORS.approaching} onClick={onWineClick} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Wine Card (compact, for horizontal scroll) ──────────────

function WineCard({ wine, accent, onClick }: { wine: Wine; accent: string; onClick?: (wine: Wine) => void }) {
  const typeColor =
    WINE_TYPE_COLORS[wine.type as WineType] || "#666";
  const typeLabel =
    WINE_TYPE_LABELS[wine.type as WineType] || wine.type;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "shrink-0 w-36 rounded-lg border bg-card p-2.5 space-y-1.5 transition-shadow",
        onClick ? "cursor-pointer hover:shadow-md hover:border-primary/30 active:scale-[0.98]" : "hover:shadow-sm"
      )}
      onClick={onClick ? () => onClick(wine) : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(wine); } : undefined}
    >
      {/* Type dot + vintage */}
      <div className="flex items-center gap-1.5">
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: typeColor }}
        />
        <span className="text-[10px] text-muted-foreground truncate">
          {typeLabel}
          {wine.vintage ? ` · ${wine.vintage}` : ""}
        </span>
      </div>
      {/* Name */}
      <p className="text-xs font-medium leading-tight line-clamp-2">{wine.name}</p>
      {/* Winery */}
      <p className="text-[10px] text-muted-foreground truncate">{wine.winery}</p>
      {/* Window */}
      {wine.drinkWindow && (
        <div
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
          style={{ backgroundColor: `${accent}15`, color: accent }}
        >
          <Clock className="h-2.5 w-2.5" />
          {wine.drinkWindow}
        </div>
      )}
    </div>
  );
}
