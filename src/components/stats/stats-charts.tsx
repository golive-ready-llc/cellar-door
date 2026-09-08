"use client";

import { Card, CardContent } from "@/components/ui/card";
import { DISPOSITION_LABELS } from "@/types/constants";
import type { Wine } from "@/types/wine";
import type {
  TypeDataItem,
  VintageDataItem,
  RegionDataItem,
  DispositionDataItem,
  ConsumptionDataItem,
  PriceDataItem,
  GrapeDataItem,
  CoreStats,
} from "@/lib/stats-utils";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
};

// ============ Donut Chart (shared for type & disposition) ============

interface DonutChartCardProps {
  title: string;
  data: { name: string; value: number; color: string }[];
  emptyText: string;
  onItemClick?: (entry: { name: string; value: number; color: string }) => void;
  totalBottles?: number;
  footer?: React.ReactNode;
}

export function DonutChartCard({ title, data, emptyText, onItemClick, totalBottles, footer }: DonutChartCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="font-semibold text-sm mb-4">{title}</h3>
        {data.length > 0 ? (
          <div className="flex items-center gap-4">
            <div className="shrink-0" style={{ width: 160, height: 160 }}>
              <PieChart width={160} height={160}>
                <Pie
                  data={data}
                  cx={80}
                  cy={80}
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </div>
            <div className="flex-1 space-y-2">
              {data.map((entry) => (
                <div
                  key={entry.name}
                  role="button"
                  tabIndex={0}
                  className="flex items-center gap-2 text-sm cursor-pointer rounded-md px-1 -mx-1 py-0.5 hover:bg-muted/50 active:scale-[0.98] transition-all"
                  onClick={() => onItemClick?.(entry)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onItemClick?.(entry);
                  }}
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="flex-1 truncate" title={entry.name}>{entry.name}</span>
                  <span className="font-semibold shrink-0">{entry.value}</span>
                  {totalBottles != null && (
                    <span className="text-muted-foreground text-xs w-10 text-right shrink-0">
                      {Math.round((entry.value / totalBottles) * 100)}%
                    </span>
                  )}
                </div>
              ))}
              {footer}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ============ Bar Chart Card (reusable) ============

interface BarChartCardProps {
  title: string;
  // Recharts accepts any record-like shape; the specific chart data item
  // types (VintageDataItem, PriceDataItem, etc.) pass through structurally.
  data: readonly Record<string, unknown>[] | readonly object[];
  dataKey: string;
  xKey: string;
  fill: string;
  emptyText: string;
  layout?: "horizontal" | "vertical";
  yWidth?: number;
  radius?: [number, number, number, number];
}

function BarChartCard({
  title,
  data,
  dataKey,
  xKey,
  fill,
  emptyText,
  layout = "horizontal",
  yWidth,
  radius = [4, 4, 0, 0],
}: BarChartCardProps) {
  const isVertical = layout === "vertical";
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="font-semibold text-sm mb-4">{title}</h3>
        {data.length > 0 ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout={isVertical ? "vertical" : undefined} margin={isVertical ? { left: 0, right: 8, top: 4, bottom: 4 } : undefined}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                {isVertical ? (
                  <>
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                    <YAxis
                      type="category"
                      dataKey={xKey}
                      width={yWidth || 90}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      interval={0}
                      tickFormatter={(v: string) =>
                        typeof v === "string" && v.length > 18 ? v.slice(0, 17) + "…" : v
                      }
                    />
                  </>
                ) : (
                  <>
                    <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  </>
                )}
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey={dataKey} fill={fill} radius={radius} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ============ Exported Chart Sections ============

interface TypeAndDispositionChartsProps {
  typeData: TypeDataItem[];
  dispositionData: DispositionDataItem[];
  wines: Wine[];
  stats: CoreStats;
  showFiltered: (label: string, filtered: Wine[]) => void;
}

export function TypeAndDispositionCharts({
  typeData,
  dispositionData,
  wines,
  stats,
  showFiltered,
}: TypeAndDispositionChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <DonutChartCard
        title="Wine Types"
        data={typeData}
        emptyText="No data"
        totalBottles={stats.totalBottles}
        onItemClick={(entry) => {
          const td = typeData.find((t) => t.name === entry.name);
          if (td) showFiltered(entry.name, wines.filter((w) => w.type === td.type));
        }}
      />
      <DonutChartCard
        title="Readiness"
        data={dispositionData}
        emptyText="Set dispositions on wines to see readiness breakdown"
        onItemClick={(entry) => {
          const key = Object.entries(DISPOSITION_LABELS).find(([, v]) => v === entry.name)?.[0];
          if (key) showFiltered(entry.name, wines.filter((w) => w.disposition === key));
        }}
        footer={
          wines.filter((w) => !w.disposition).length > 0 ? (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full shrink-0 bg-muted-foreground/30" />
              <span className="flex-1 text-muted-foreground truncate">Not set</span>
              <span className="font-semibold text-muted-foreground shrink-0">
                {wines.filter((w) => !w.disposition).length}
              </span>
            </div>
          ) : undefined
        }
      />
    </div>
  );
}

interface DistributionChartsProps {
  vintageData: VintageDataItem[];
  priceData: PriceDataItem[];
}

export function DistributionCharts({ vintageData, priceData }: DistributionChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <BarChartCard
        title="Vintage Distribution"
        data={vintageData}
        dataKey="count"
        xKey="vintage"
        fill="#9B2335"
        emptyText="Add vintages to see distribution"
      />
      <BarChartCard
        title="Price Distribution"
        data={priceData}
        dataKey="count"
        xKey="label"
        fill="#22c55e"
        emptyText="Add prices to see distribution"
      />
    </div>
  );
}

interface GeographyChartsProps {
  regionData: RegionDataItem[];
  grapeData: GrapeDataItem[];
}

export function GeographyCharts({ regionData, grapeData }: GeographyChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <BarChartCard
        title="By Country"
        data={regionData}
        dataKey="count"
        xKey="country"
        fill="#6366f1"
        emptyText="Add countries to see breakdown"
        layout="vertical"
        yWidth={90}
        radius={[0, 4, 4, 0]}
      />
      <BarChartCard
        title="Top Grape Varieties"
        data={grapeData}
        dataKey="count"
        xKey="grape"
        fill="#14b8a6"
        emptyText="Add grape varieties to see breakdown"
        layout="vertical"
        yWidth={140}
        radius={[0, 4, 4, 0]}
      />
    </div>
  );
}

interface ConsumptionChartProps {
  consumptionData: ConsumptionDataItem[];
}

export function ConsumptionChart({ consumptionData }: ConsumptionChartProps) {
  if (consumptionData.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="font-semibold text-sm mb-4">Consumption Timeline</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={consumptionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <defs>
                <linearGradient id="consumptionGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="count"
                stroke="#8b5cf6"
                fill="url(#consumptionGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
