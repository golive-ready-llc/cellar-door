"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import type { Wine } from "@/types/wine";

// ─── Types ──────────────────────────────────────────────────

interface ValuePoint {
  label: string;
  cost: number;
  market: number;
}

// ─── SVG Line Chart ──────────────────────────────────────────

function MiniLineChart({
  points,
  width = 320,
  height = 140,
}: {
  points: ValuePoint[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const pad = { top: 10, right: 10, bottom: 24, left: 10 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const allValues = points.flatMap((p) => [p.cost, p.market]);
  const minVal = Math.min(...allValues) * 0.9;
  const maxVal = Math.max(...allValues) * 1.1;
  const range = maxVal - minVal || 1;

  const toX = (i: number) => pad.left + (i / (points.length - 1)) * w;
  const toY = (v: number) => pad.top + h - ((v - minVal) / range) * h;

  const costLine = points.map((p, i) => `${toX(i)},${toY(p.cost)}`).join(" ");
  const marketLine = points
    .map((p, i) => `${toX(i)},${toY(p.market)}`)
    .join(" ");

  // Fill area between lines
  const fillPath = [
    ...points.map((p, i) => `${toX(i)},${toY(p.market)}`),
    ...points
      .slice()
      .reverse()
      .map((p, i) => `${toX(points.length - 1 - i)},${toY(p.cost)}`),
  ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Fill between */}
      <polygon
        points={fillPath}
        fill="currentColor"
        className="text-primary/8"
      />

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
        <line
          key={frac}
          x1={pad.left}
          y1={pad.top + h * (1 - frac)}
          x2={width - pad.right}
          y2={pad.top + h * (1 - frac)}
          stroke="currentColor"
          className="text-border"
          strokeWidth={0.5}
        />
      ))}

      {/* Cost basis line */}
      <polyline
        points={costLine}
        fill="none"
        stroke="currentColor"
        className="text-muted-foreground"
        strokeWidth={1.5}
        strokeDasharray="4 2"
      />

      {/* Market value line */}
      <polyline
        points={marketLine}
        fill="none"
        stroke="currentColor"
        className="text-primary"
        strokeWidth={2}
      />

      {/* Dots */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={toX(i)}
          cy={toY(p.market)}
          r={2.5}
          fill="currentColor"
          className="text-primary"
        />
      ))}

      {/* X-axis labels */}
      {points.map((p, i) => {
        if (points.length > 6 && i % 2 !== 0 && i !== points.length - 1)
          return null;
        return (
          <text
            key={i}
            x={toX(i)}
            y={height - 4}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={9}
          >
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────

function ValueDonut({
  data,
  size = 120,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const r = size / 2;
  const strokeWidth = 20;
  const innerR = r - strokeWidth;
  const circumference = 2 * Math.PI * innerR;

  // Pre-compute cumulative offsets so the map callback stays pure
  // (reassigning a local `let` inside .map confuses React 19's compiler
  // checks and may break with concurrent rendering).
  const segments = data.map((d) => ({
    label: d.label,
    color: d.color,
    dash: circumference * (d.value / total),
  }));
  // Compute cumulative offsets (offsets[i] = sum of dashes[0..i-1]) via
  // reduce so no mutable `let` is needed during render.
  const offsets: number[] = segments.reduce<number[]>((acc, _seg, i) => {
    if (i === 0) acc.push(0);
    else acc.push(acc[i - 1] + segments[i - 1].dash);
    return acc;
  }, []);

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((d, idx) => {
          const { dash } = d;
          const currentOffset = offsets[idx];
          return (
            <circle
              key={d.label}
              cx={r}
              cy={r}
              r={innerR}
              fill="none"
              stroke={d.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-currentOffset}
              transform={`rotate(-90 ${r} ${r})`}
            />
          );
        })}
      </svg>
      <div className="space-y-1">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-muted-foreground whitespace-nowrap">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  red: "#b91c1c",
  white: "#ca8a04",
  "rosé": "#db2777",
  sparkling: "#d97706",
  dessert: "#7c3aed",
  orange: "#ea580c",
  fortified: "#4f46e5",
};

export function ValueTracker({ wines }: { wines: Wine[] }) {
  const { formatPrice } = useCurrency();

  const stats = useMemo(() => {
    const totalCost = wines.reduce((sum, w) => sum + (w.price || 0), 0);
    const totalMarket = wines.reduce((sum, w) => sum + (w.retailPrice || w.price || 0), 0);
    const gain = totalMarket - totalCost;
    const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;

    // Top 5 most valuable wines (by market value)
    const top5 = [...wines]
      .filter((w) => w.retailPrice || w.price)
      .sort(
        (a, b) =>
          (b.retailPrice || b.price || 0) - (a.retailPrice || a.price || 0)
      )
      .slice(0, 5);

    // Value by type
    const byType: Record<string, number> = {};
    wines.forEach((w) => {
      const val = w.retailPrice || w.price || 0;
      if (val > 0) {
        byType[w.type] = (byType[w.type] || 0) + val;
      }
    });

    const typeData = Object.entries(byType)
      .sort(([, a], [, b]) => b - a)
      .map(([type, value]) => ({
        label: type.charAt(0).toUpperCase() + type.slice(1),
        value,
        color: TYPE_COLORS[type] || "#6b7280",
      }));

    // Simulated monthly history from wine addedAt dates
    // Group wines by the month they were added and compute cumulative value
    const monthMap = new Map<string, { cost: number; market: number }>();
    const sortedWines = [...wines].sort(
      (a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
    );

    let cumCost = 0;
    let cumMarket = 0;
    sortedWines.forEach((w) => {
      const month = new Date(w.addedAt).toISOString().slice(0, 7);
      cumCost += w.price || 0;
      cumMarket += w.retailPrice || w.price || 0;
      monthMap.set(month, { cost: cumCost, market: cumMarket });
    });

    const chartPoints: ValuePoint[] = [...monthMap.entries()].map(
      ([month, vals]) => ({
        label: month.slice(5), // "MM" from "YYYY-MM"
        cost: vals.cost,
        market: vals.market,
      })
    );

    // Ensure we have at least 2 points
    if (chartPoints.length === 1) {
      chartPoints.unshift({ label: "Start", cost: 0, market: 0 });
    }

    return { totalCost, totalMarket, gain, gainPct, top5, typeData, chartPoints };
  }, [wines]);

  if (stats.totalCost === 0 && stats.totalMarket === 0) {
    return null; // No value data to show
  }

  const isPositive = stats.gain >= 0;

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Collection Value</h3>
        </div>

        {/* Value summary — 2 cols on phones (Gain on its own row), 3 cols on tablets+ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs text-muted-foreground">Cost Basis</p>
            <p className="text-sm font-semibold whitespace-nowrap">
              {formatPrice(stats.totalCost)}
            </p>
          </div>
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs text-muted-foreground">Market Value</p>
            <p className="text-sm font-semibold whitespace-nowrap">
              {formatPrice(stats.totalMarket)}
            </p>
          </div>
          <div className="space-y-0.5 min-w-0 col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground">
              {isPositive ? "Gain" : "Loss"}
            </p>
            <p
              className={`text-sm font-semibold flex items-center gap-1 whitespace-nowrap ${
                isPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              {isPositive ? (
                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="whitespace-nowrap">
                {isPositive ? "+" : ""}
                {formatPrice(stats.gain)}
              </span>
              <span className="text-xs font-normal text-muted-foreground whitespace-nowrap">
                ({stats.gainPct > 0 ? "+" : ""}
                {stats.gainPct.toFixed(1)}%)
              </span>
            </p>
          </div>
        </div>

        {/* Chart */}
        {stats.chartPoints.length >= 2 && (
          <div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-1">
              <span className="flex items-center gap-1">
                <span className="w-4 border-t-2 border-dashed border-muted-foreground" />
                Cost Basis
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 border-t-2 border-primary" />
                Market Value
              </span>
            </div>
            <MiniLineChart points={stats.chartPoints} />
          </div>
        )}

        {/* Top 5 most valuable */}
        {stats.top5.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Most Valuable Bottles
            </p>
            <div className="space-y-1.5">
              {stats.top5.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="truncate max-w-[220px]">
                    {w.name}
                    {w.vintage ? ` ${w.vintage}` : ""}
                  </span>
                  <span className="font-medium whitespace-nowrap ml-2">
                    {formatPrice(w.retailPrice || w.price || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Value by type donut */}
        {stats.typeData.length > 1 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Value by Type
            </p>
            <ValueDonut data={stats.typeData} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
