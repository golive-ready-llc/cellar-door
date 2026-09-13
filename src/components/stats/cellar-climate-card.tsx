"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Thermometer, Droplets, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useTier } from "@/hooks/use-tier";
import { useHaSensors } from "@/hooks/use-ha-sensors";
import type { Wall } from "@/types/wine";
import type { HistoryResponse } from "@/types/ha";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Period = "24h" | "7d" | "30d";

const PERIODS: { value: Period; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
};

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };

function formatTime(ts: string, period: Period): string {
  const d = new Date(ts);
  if (period === "24h") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (period === "7d") {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function CellarClimateCard({ walls }: { walls: Wall[] }) {
  const { can } = useTier();
  const { getIdToken } = useAuth();

  const sensorWalls = useMemo(
    () => walls.filter((w) => w.haConfig?.hasToken),
    [walls],
  );

  const [selectedWallId, setSelectedWallId] = useState<string>("");
  const [period, setPeriod] = useState<Period>("7d");
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Live current value — same source the cellar-page chip uses. Shown
  // even when history is empty (HA's recorder retention can be short)
  // so users see *something* on the stats screen rather than two empty
  // "No data" boxes when their sensors are clearly working elsewhere.
  const liveSensors = useHaSensors(
    selectedWallId || null,
    can("haSensors") && !!selectedWallId
  );

  useEffect(() => {
    if (sensorWalls.length > 0 && !selectedWallId) {
      setSelectedWallId(sensorWalls[0].id);
    }
  }, [sensorWalls, selectedWallId]);

  useEffect(() => {
    if (!selectedWallId) return;

    const controller = new AbortController();
    setLoading(true);

    setHistoryError(null);
    (async () => {
      try {
        const token = await getIdToken();
        if (!token || controller.signal.aborted) return;
        const res = await fetch(
          `/api/ha-sensor/history?wallId=${encodeURIComponent(selectedWallId)}&period=${period}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        const json = await res.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (res.ok) {
          setData(json);
          if (json?.error) setHistoryError(json.error);
        } else {
          setHistoryError(json?.error || `History fetch failed (HTTP ${res.status})`);
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setHistoryError(e instanceof Error ? e.message : "Network error");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [selectedWallId, period, getIdToken]);

  if (!can("haSensors") || sensorWalls.length === 0) return null;

  const tempData = (data?.temp?.data ?? []).map((p) => ({
    label: formatTime(p.time, period),
    value: p.value,
  }));

  const humidData = (data?.humidity?.data ?? []).map((p) => ({
    label: formatTime(p.time, period),
    value: p.value,
  }));

  // Prefer history-derived units; fall back to live sensor units when
  // history is empty (e.g. HA recorder retention shorter than the period).
  const tempUnit = data?.temp?.unit || liveSensors.temp?.unit || "°F";
  const humidUnit = data?.humidity?.unit || liveSensors.humidity?.unit || "%";
  // "Current" reading: prefer live (it's the most recent reading anyway)
  // and fall back to the last history point if live is unavailable.
  const currentTemp =
    liveSensors.temp?.value ??
    (tempData.length > 0 ? tempData[tempData.length - 1].value : null);
  const currentHumid =
    liveSensors.humidity?.value ??
    (humidData.length > 0 ? humidData[humidData.length - 1].value : null);

  // Compute range stats
  const tempMin = tempData.length > 0 ? Math.min(...tempData.map((d) => d.value)) : null;
  const tempMax = tempData.length > 0 ? Math.max(...tempData.map((d) => d.value)) : null;
  const humidMin = humidData.length > 0 ? Math.min(...humidData.map((d) => d.value)) : null;
  const humidMax = humidData.length > 0 ? Math.max(...humidData.map((d) => d.value)) : null;

  const selectedWall = sensorWalls.find((w) => w.id === selectedWallId);

  return (
    <div className="space-y-4">
      {/* Section header + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Thermometer className="h-5 w-5 text-orange-500" />
          <h2 className="font-semibold text-base">
            Cellar Climate
            {selectedWall && sensorWalls.length === 1 && (
              <span className="text-muted-foreground font-normal text-sm ml-2">
                {selectedWall.name}
              </span>
            )}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {sensorWalls.length > 1 && (
            <select
              value={selectedWallId}
              onChange={(e) => setSelectedWallId(e.target.value)}
              className="text-xs rounded-md border border-border bg-background px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {sensorWalls.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex rounded-lg border border-border overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  period === p.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Temperature */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <Thermometer className="h-4 w-4" style={{ color: "#f97316" }} />
                Temperature
              </h3>
              {currentTemp != null && (
                <span className="text-xl font-bold" style={{ color: "#f97316" }}>
                  {currentTemp.toFixed(1)}{tempUnit}
                </span>
              )}
            </div>
            {tempMin != null && tempMax != null && (
              <p className="text-xs text-muted-foreground mb-3">
                Range: {tempMin.toFixed(1)} – {tempMax.toFixed(1)}{tempUnit}
              </p>
            )}
            <div className="h-48">
              {loading && !data ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </div>
              ) : tempData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground gap-1 px-4 text-center">
                  <span>No history available for this period</span>
                  {historyError && (
                    <span className="text-xs text-muted-foreground/70">
                      {historyError}
                    </span>
                  )}
                  {currentTemp != null && (
                    <span className="text-xs text-muted-foreground/70">
                      Live reading: {currentTemp.toFixed(1)}{tempUnit}
                    </span>
                  )}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tempData}>
                    <defs>
                      <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={AXIS_TICK} interval="preserveStartEnd" />
                    <YAxis domain={["auto", "auto"]} tick={AXIS_TICK} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={((value: unknown) => [`${(Number(value) || 0).toFixed(1)}${tempUnit}`, "Temp"]) as unknown as never}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#f97316"
                      strokeWidth={2}
                      fill="url(#tempGradient)"
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Humidity */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <Droplets className="h-4 w-4" style={{ color: "#3b82f6" }} />
                Humidity
              </h3>
              {currentHumid != null && (
                <span className="text-xl font-bold" style={{ color: "#3b82f6" }}>
                  {currentHumid.toFixed(1)}{humidUnit}
                </span>
              )}
            </div>
            {humidMin != null && humidMax != null && (
              <p className="text-xs text-muted-foreground mb-3">
                Range: {humidMin.toFixed(1)} – {humidMax.toFixed(1)}{humidUnit}
              </p>
            )}
            <div className="h-48">
              {loading && !data ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </div>
              ) : humidData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground gap-1 px-4 text-center">
                  <span>No history available for this period</span>
                  {historyError && (
                    <span className="text-xs text-muted-foreground/70">
                      {historyError}
                    </span>
                  )}
                  {currentHumid != null && (
                    <span className="text-xs text-muted-foreground/70">
                      Live reading: {currentHumid.toFixed(1)}{humidUnit}
                    </span>
                  )}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={humidData}>
                    <defs>
                      <linearGradient id="humidGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={AXIS_TICK} interval="preserveStartEnd" />
                    <YAxis domain={["auto", "auto"]} tick={AXIS_TICK} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={((value: unknown) => [`${(Number(value) || 0).toFixed(1)}${humidUnit}`, "Humidity"]) as unknown as never}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#humidGradient)"
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
