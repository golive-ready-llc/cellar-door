"use client";

import { useState, useRef, useEffect } from "react";
import {
  Thermometer,
  Droplets,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { useHaSensors } from "@/hooks/use-ha-sensors";
import { useTier } from "@/hooks/use-tier";
import { useAuth } from "@/components/auth-provider";
import type { Wall } from "@/types/wine";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HaSensorChipProps {
  wall: Wall;
}

// Ideal wine cellar ranges
const TEMP_IDEAL = { min: 55, max: 65, unit: "°F" };
const HUMID_IDEAL = { min: 55, max: 75, unit: "%" };

function getRangeStatus(
  value: number,
  ideal: { min: number; max: number },
): "good" | "warn" | "bad" {
  if (value >= ideal.min && value <= ideal.max) return "good";
  const margin = (ideal.max - ideal.min) * 0.3;
  if (value >= ideal.min - margin && value <= ideal.max + margin) return "warn";
  return "bad";
}

const STATUS_COLORS = {
  good: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-red-500",
};

const STATUS_BG = {
  good: "bg-emerald-500/10",
  warn: "bg-amber-500/10",
  bad: "bg-red-500/10",
};

interface HistoryStats {
  tempMin: number | null;
  tempMax: number | null;
  tempAvg: number | null;
  humidMin: number | null;
  humidMax: number | null;
  humidAvg: number | null;
  tempUnit: string;
  humidUnit: string;
}

export function HaSensorChip({ wall }: HaSensorChipProps) {
  const { can } = useTier();
  const { getIdToken } = useAuth();
  const haConfigured = !!wall.haConfig?.hasToken;
  const data = useHaSensors(
    haConfigured ? wall.id : null,
    can("haSensors") && haConfigured,
  );
  const { temp, humidity, loading, error } = data;

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fetch 24h history for min/max/avg when popover opens
  useEffect(() => {
    if (!popoverOpen || !wall.id) return;

    const controller = new AbortController();
    setLoadingHistory(true);

    (async () => {
      try {
        const token = await getIdToken();
        if (!token || controller.signal.aborted) return;
        const res = await fetch(
          `/api/ha-sensor/history?wallId=${encodeURIComponent(wall.id)}&period=24h`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        if (!res.ok) return;
        const json = await res.json();

        if (controller.signal.aborted) return;

        const tempData: number[] = (json.temp?.data ?? []).map(
          (p: { value: number }) => p.value,
        );
        const humidData: number[] = (json.humidity?.data ?? []).map(
          (p: { value: number }) => p.value,
        );

        setHistoryStats({
          tempMin: tempData.length ? Math.min(...tempData) : null,
          tempMax: tempData.length ? Math.max(...tempData) : null,
          tempAvg: tempData.length
            ? tempData.reduce((a, b) => a + b, 0) / tempData.length
            : null,
          humidMin: humidData.length ? Math.min(...humidData) : null,
          humidMax: humidData.length ? Math.max(...humidData) : null,
          humidAvg: humidData.length
            ? humidData.reduce((a, b) => a + b, 0) / humidData.length
            : null,
          tempUnit: json.temp?.unit || "°F",
          humidUnit: json.humidity?.unit || "%",
        });
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        // ignore other errors
      } finally {
        if (!controller.signal.aborted) setLoadingHistory(false);
      }
    })();

    return () => controller.abort();
  }, [popoverOpen, wall.id, getIdToken]);

  // Close on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popoverOpen]);

  if (!can("haSensors") || !haConfigured) return null;

  if (loading && !temp && !humidity) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Sensors...</span>
      </div>
    );
  }

  if (error && !temp && !humidity) {
    // If sensors never connected (lastUpdated is null), show subtle offline indicator.
    // If sensors WERE working and stopped, show a warning.
    const wasWorking = !!data?.lastUpdated;
    if (!wasWorking) {
      return (
        <Tooltip>
          <TooltipTrigger>
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/50 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 inline-block" />
              <span>Sensors: offline</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>{error}</TooltipContent>
        </Tooltip>
      );
    }
    return (
      <Tooltip>
        <TooltipTrigger>
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/10 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" />
            <span>Sensor error</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>{error}</TooltipContent>
      </Tooltip>
    );
  }

  const tempStatus = temp ? getRangeStatus(temp.value, TEMP_IDEAL) : null;
  const humidStatus = humidity
    ? getRangeStatus(humidity.value, HUMID_IDEAL)
    : null;

  return (
    <div className="relative" ref={popoverRef}>
      {/* Chip — clickable */}
      <button
        type="button"
        onClick={() => setPopoverOpen(!popoverOpen)}
        className="inline-flex items-center gap-3 px-3 py-1.5 rounded-full bg-muted/50 text-xs font-medium cursor-pointer hover:bg-muted transition-colors"
      >
        {temp && (
          <span
            className={`inline-flex items-center gap-1 ${tempStatus ? STATUS_COLORS[tempStatus] : "text-orange-500"}`}
          >
            <Thermometer className="h-3.5 w-3.5" />
            <span className="font-semibold">
              {temp.value.toFixed(1)}
              {temp.unit || ""}
            </span>
          </span>
        )}
        {humidity && (
          <span
            className={`inline-flex items-center gap-1 ${humidStatus ? STATUS_COLORS[humidStatus] : "text-blue-500"}`}
          >
            <Droplets className="h-3.5 w-3.5" />
            <span className="font-semibold">
              {humidity.value.toFixed(1)}
              {humidity.unit || ""}
            </span>
          </span>
        )}
        {error && (
          <Tooltip>
            <TooltipTrigger>
              <AlertTriangle className="h-3 w-3 text-amber-500" />
            </TooltipTrigger>
            <TooltipContent>{error}</TooltipContent>
          </Tooltip>
        )}
      </button>

      {/* Popover */}
      {popoverOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-border bg-popover shadow-xl p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Cellar Climate</h3>
            <button
              type="button"
              onClick={() => setPopoverOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Temperature section */}
          {temp && (
            <div
              className={`rounded-lg p-3 ${tempStatus ? STATUS_BG[tempStatus] : "bg-orange-500/10"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Thermometer
                    className={`h-4 w-4 ${tempStatus ? STATUS_COLORS[tempStatus] : "text-orange-500"}`}
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    Temperature
                  </span>
                </div>
                <span
                  className={`text-2xl font-bold ${tempStatus ? STATUS_COLORS[tempStatus] : "text-orange-500"}`}
                >
                  {temp.value.toFixed(1)}
                  {temp.unit}
                </span>
              </div>
              {/* Ideal range bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>
                    Ideal: {TEMP_IDEAL.min}–{TEMP_IDEAL.max}
                    {TEMP_IDEAL.unit}
                  </span>
                  <span className={tempStatus ? STATUS_COLORS[tempStatus] : ""}>
                    {tempStatus === "good"
                      ? "✓ In range"
                      : tempStatus === "warn"
                        ? "⚠ Near limit"
                        : "✗ Out of range"}
                  </span>
                </div>
                {/* Visual bar */}
                <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="absolute inset-y-0 bg-emerald-500/30 rounded-full"
                    style={{
                      left: `${((TEMP_IDEAL.min - 40) / 50) * 100}%`,
                      right: `${100 - ((TEMP_IDEAL.max - 40) / 50) * 100}%`,
                    }}
                  />
                  <div
                    className={`absolute top-0 h-full w-1.5 rounded-full ${tempStatus === "good" ? "bg-emerald-500" : tempStatus === "warn" ? "bg-amber-500" : "bg-red-500"}`}
                    style={{
                      left: `${Math.max(0, Math.min(100, ((temp.value - 40) / 50) * 100))}%`,
                      transform: "translateX(-50%)",
                    }}
                  />
                </div>
              </div>
              {/* 24h stats */}
              {historyStats?.tempMin != null && (
                <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                  <span>
                    24h Low:{" "}
                    <strong>
                      {historyStats.tempMin.toFixed(1)}
                      {historyStats.tempUnit}
                    </strong>
                  </span>
                  <span>
                    High:{" "}
                    <strong>
                      {historyStats.tempMax!.toFixed(1)}
                      {historyStats.tempUnit}
                    </strong>
                  </span>
                  <span>
                    Avg:{" "}
                    <strong>
                      {historyStats.tempAvg!.toFixed(1)}
                      {historyStats.tempUnit}
                    </strong>
                  </span>
                </div>
              )}
              {loadingHistory && !historyStats && (
                <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading 24h stats...
                </div>
              )}
            </div>
          )}

          {/* Humidity section */}
          {humidity && (
            <div
              className={`rounded-lg p-3 ${humidStatus ? STATUS_BG[humidStatus] : "bg-blue-500/10"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Droplets
                    className={`h-4 w-4 ${humidStatus ? STATUS_COLORS[humidStatus] : "text-blue-500"}`}
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    Humidity
                  </span>
                </div>
                <span
                  className={`text-2xl font-bold ${humidStatus ? STATUS_COLORS[humidStatus] : "text-blue-500"}`}
                >
                  {humidity.value.toFixed(1)}
                  {humidity.unit}
                </span>
              </div>
              {/* Ideal range bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>
                    Ideal: {HUMID_IDEAL.min}–{HUMID_IDEAL.max}
                    {HUMID_IDEAL.unit}
                  </span>
                  <span
                    className={humidStatus ? STATUS_COLORS[humidStatus] : ""}
                  >
                    {humidStatus === "good"
                      ? "✓ In range"
                      : humidStatus === "warn"
                        ? "⚠ Near limit"
                        : "✗ Out of range"}
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="absolute inset-y-0 bg-emerald-500/30 rounded-full"
                    style={{
                      left: `${(HUMID_IDEAL.min / 100) * 100}%`,
                      right: `${100 - (HUMID_IDEAL.max / 100) * 100}%`,
                    }}
                  />
                  <div
                    className={`absolute top-0 h-full w-1.5 rounded-full ${humidStatus === "good" ? "bg-emerald-500" : humidStatus === "warn" ? "bg-amber-500" : "bg-red-500"}`}
                    style={{
                      left: `${Math.max(0, Math.min(100, (humidity.value / 100) * 100))}%`,
                      transform: "translateX(-50%)",
                    }}
                  />
                </div>
              </div>
              {/* 24h stats */}
              {historyStats?.humidMin != null && (
                <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                  <span>
                    24h Low:{" "}
                    <strong>
                      {historyStats.humidMin.toFixed(1)}
                      {historyStats.humidUnit}
                    </strong>
                  </span>
                  <span>
                    High:{" "}
                    <strong>
                      {historyStats.humidMax!.toFixed(1)}
                      {historyStats.humidUnit}
                    </strong>
                  </span>
                  <span>
                    Avg:{" "}
                    <strong>
                      {historyStats.humidAvg!.toFixed(1)}
                      {historyStats.humidUnit}
                    </strong>
                  </span>
                </div>
              )}
              {loadingHistory && !historyStats && (
                <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading 24h stats...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
