"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dna, Loader2, Share2, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/custom-toast";
import { useTier } from "@/hooks/use-tier";
import { useAiToggle } from "@/hooks/use-ai-toggle";
import {
  generateTasteProfile,
  type TasteProfileTypeFilter,
} from "@/server/actions/taste-profile";
import type { TasteProfileResult, TasteProfileBundle } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

const TYPE_FILTERS: { value: TasteProfileTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "red", label: "Reds" },
  { value: "white", label: "Whites" },
];

const EMPTY_SLICE_LABEL: Record<TasteProfileTypeFilter, string> = {
  all: "",
  red: "Add at least 3 reds to see this slice.",
  white: "Add at least 3 whites to see this slice.",
};

const AXES = [
  { key: "body", label: "Body", low: "Light", high: "Full" },
  { key: "tannin", label: "Tannin", low: "Low", high: "High" },
  { key: "acidity", label: "Acidity", low: "Low", high: "High" },
  { key: "sweetness", label: "Sweetness", low: "Dry", high: "Sweet" },
  { key: "fruit", label: "Fruit", low: "Subtle", high: "Bold" },
  { key: "oak", label: "Oak", low: "None", high: "Heavy" },
] as const;

type AxisKey = (typeof AXES)[number]["key"];

// ─── Radar Chart SVG ──────────────────────────────────────────

function RadarChart({ data }: { data: TasteProfileResult }) {
  const size = 280;
  const center = size / 2;
  const radius = 110;
  const levels = 5; // concentric rings

  // Calculate point positions for a regular hexagon
  const getPoint = (index: number, value: number): [number, number] => {
    const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2; // Start from top
    const r = (value / 10) * radius;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };

  // Grid rings
  const rings = Array.from({ length: levels }, (_, i) => {
    const r = ((i + 1) / levels) * radius;
    const points = Array.from({ length: 6 }, (_, j) => {
      const angle = (Math.PI * 2 * j) / 6 - Math.PI / 2;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(" ");
    return points;
  });

  // Axis lines
  const axisLines = Array.from({ length: 6 }, (_, i) => {
    const [x, y] = getPoint(i, 10);
    return { x1: center, y1: center, x2: x, y2: y };
  });

  // Data polygon
  const dataPoints = AXES.map((axis, i) => {
    const val = data[axis.key as AxisKey] as number;
    const [x, y] = getPoint(i, val);
    return `${x},${y}`;
  }).join(" ");

  // Label positions (slightly outside the chart)
  const labelPositions = AXES.map((axis, i) => {
    const [x, y] = getPoint(i, 12.5);
    return { x, y, label: axis.label, value: data[axis.key as AxisKey] as number };
  });

  // Vertical padding so axis labels (especially "Body" at the top) aren't
  // clipped by the SVG bounds. Without padding, the top label sits at y≈2.5
  // and gets cut off.
  const vPad = 14;
  return (
    <svg
      viewBox={`0 ${-vPad} ${size} ${size + vPad * 2}`}
      className="w-full max-w-[280px] mx-auto"
    >
      <defs>
        <linearGradient id="genome-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Grid rings */}
      {rings.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="var(--border)"
          strokeWidth={i === levels - 1 ? 1.5 : 0.5}
          opacity={0.5}
        />
      ))}

      {/* Axis lines */}
      {axisLines.map((line, i) => (
        <line
          key={i}
          {...line}
          stroke="var(--border)"
          strokeWidth={0.5}
          opacity={0.4}
        />
      ))}

      {/* Data polygon - filled */}
      <polygon
        points={dataPoints}
        fill="url(#genome-gradient)"
        stroke="var(--primary)"
        strokeWidth={2}
        opacity={0.85}
      />

      {/* Data points */}
      {AXES.map((axis, i) => {
        const val = data[axis.key as AxisKey] as number;
        const [x, y] = getPoint(i, val);
        return (
          <circle
            key={axis.key}
            cx={x}
            cy={y}
            r={3.5}
            fill="var(--primary)"
            stroke="var(--background)"
            strokeWidth={1.5}
          />
        );
      })}

      {/* Labels */}
      {labelPositions.map((pos) => (
        <text
          key={pos.label}
          x={pos.x}
          y={pos.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground text-[10px] font-medium"
        >
          {pos.label}
        </text>
      ))}
    </svg>
  );
}

// ─── Score Bar ────────────────────────────────────────────────

function ScoreBar({ axis, value }: { axis: (typeof AXES)[number]; value: number }) {
  const pct = (value / 10) * 100;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-muted-foreground shrink-0">{axis.label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-5 text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}

// ─── Share Card Generator ──────────────────────────────────────

function generateGenomeCard(data: TasteProfileResult): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, 600, 400);

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("My Flavor Genome", 300, 40);

  // Draw radar on canvas
  const cx = 200;
  const cy = 210;
  const r = 120;

  // Grid
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  for (let lev = 1; lev <= 5; lev++) {
    ctx.beginPath();
    const lr = (lev / 5) * r;
    for (let i = 0; i <= 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      const x = cx + lr * Math.cos(angle);
      const y = cy + lr * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Data polygon
  ctx.fillStyle = "rgba(139, 92, 246, 0.3)";
  ctx.strokeStyle = "rgba(139, 92, 246, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  AXES.forEach((axis, i) => {
    const val = data[axis.key as AxisKey] as number;
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const x = cx + (val / 10) * r * Math.cos(angle);
    const y = cy + (val / 10) * r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = "#ffffff";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  AXES.forEach((axis, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const x = cx + (r + 25) * Math.cos(angle);
    const y = cy + (r + 25) * Math.sin(angle);
    ctx.fillText(axis.label, x, y + 4);
  });

  // Scores on the right side
  ctx.textAlign = "left";
  ctx.font = "13px system-ui, sans-serif";
  const startX = 380;
  let startY = 100;
  AXES.forEach((axis) => {
    const val = data[axis.key as AxisKey] as number;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText(axis.label, startX, startY);
    // Bar
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(startX, startY + 5, 150, 6);
    ctx.fillStyle = "rgba(139, 92, 246, 0.8)";
    ctx.fillRect(startX, startY + 5, (val / 10) * 150, 6);
    // Value
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(String(val), startX + 180, startY);
    ctx.textAlign = "left";
    ctx.font = "13px system-ui, sans-serif";
    startY += 35;
  });

  // Summary
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  const summary = data.summary.length > 70 ? data.summary.slice(0, 67) + "..." : data.summary;
  ctx.fillText(summary, 300, 370);

  // Branding
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("mycellardoor.app", 300, 390);

  return canvas;
}

// ─── Main Component ───────────────────────────────────────────

export function FlavorGenome({ wineCount }: { wineCount: number }) {
  const { hasAI: tierHasAI, userId } = useTier();
  const { aiUserEnabled } = useAiToggle();
  const hasAI = tierHasAI && aiUserEnabled;

  // ONE bundle for all three slices — populated by a single server call.
  // Server caches the bundle keyed by a fingerprint of the user's
  // collection, so flipping tabs and signing in on a new device both
  // reuse the cached bundle (zero credits) until the collection changes.
  const [bundle, setBundle] = useState<TasteProfileBundle | null>(null);
  const [typeFilter, setTypeFilter] = useState<TasteProfileTypeFilter>("all");
  const profile: TasteProfileResult | null = bundle ? bundle[typeFilter] : null;
  const [loading, setLoading] = useState(false);
  // Track whether we've issued the initial fetch — prevents the auto-mount
  // effect from racing the manual "Analyze" button.
  const fetchedOnceRef = useRef(false);

  const handleGenerate = useCallback(
    async (force = false) => {
      if (!userId) return;
      // Skip the network round-trip when we already have a bundle (refresh
      // button passes force=true to bypass the server-side cache too).
      if (!force && bundle) return;
      setLoading(true);
      try {
        const result = await generateTasteProfile(userId, { force });
        if (result.success) {
          setBundle(result.data);
        } else {
          toast.error(result.error || "Failed to generate taste profile");
        }
      } catch {
        toast.error("Failed to generate taste profile");
      } finally {
        setLoading(false);
      }
    },
    [userId, bundle]
  );

  // Fetch once on mount when the user has enough wines and AI is on. The
  // server returns the cached bundle with zero credit charge if the
  // collection fingerprint hasn't changed since the last compute.
  useEffect(() => {
    if (!hasAI || !userId || wineCount < 3) return;
    if (fetchedOnceRef.current || bundle) return;
    fetchedOnceRef.current = true;
    void handleGenerate(false);
  }, [hasAI, userId, wineCount, bundle, handleGenerate]);

  const handleShare = useCallback(async () => {
    if (!profile) return;
    try {
      const canvas = generateGenomeCard(profile);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], "flavor-genome.png", { type: "image/png" });
        // Web Share Level 2: check whether THIS payload (with files) is
        // shareable. canShare() truthy-check alone is meaningless since
        // it's always defined when share is defined.
        const payload = {
          title: "My Flavor Genome",
          text: profile.summary,
          files: [file],
        };
        if (navigator.share && navigator.canShare?.(payload)) {
          try {
            await navigator.share(payload);
          } catch {
            // User cancelled share
          }
        } else {
          // Fallback: download the image
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "flavor-genome.png";
          a.click();
          URL.revokeObjectURL(url);
          toast.success("Image downloaded");
        }
      }, "image/png");
    } catch {
      toast.error("Failed to generate share image");
    }
  }, [profile]);

  if (!hasAI || wineCount < 3) {
    return null;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Dna className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Flavor Genome</h3>
              <p className="text-xs text-muted-foreground">Your Taste DNA</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {profile && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleShare}>
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant={profile ? "ghost" : "default"}
              size={profile ? "icon" : "sm"}
              className={profile ? "h-8 w-8" : ""}
              // Refresh forces a fresh AI pass that bypasses the
              // server-side cache and recomputes all three slices.
              onClick={() => handleGenerate(!!bundle)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : profile ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <>
                  <Dna className="h-3.5 w-3.5 mr-1.5" />
                  Analyze
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Type-filter selector — pure local state. Switching tabs just
            re-renders from the cached bundle; no server call. */}
        {(bundle || loading) && (
          <div className="flex items-center gap-1 mb-4 p-1 rounded-lg bg-muted w-fit">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setTypeFilter(f.value)}
                disabled={loading}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  typeFilter === f.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {loading && !bundle && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
            <p className="text-sm">Analyzing your collection...</p>
          </div>
        )}

        {profile && (
          <div className="space-y-4">
            {/* Radar Chart */}
            <RadarChart data={profile} />

            {/* Score bars */}
            <div className="space-y-2">
              {AXES.map((axis) => (
                <ScoreBar
                  key={axis.key}
                  axis={axis}
                  value={profile[axis.key as AxisKey] as number}
                />
              ))}
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Your Taste DNA</p>
              <p className="text-sm">{profile.summary}</p>
            </div>
          </div>
        )}

        {/* Tab is selected but that slice has no data (fewer than 3 wines
            of that color). Show graceful empty state — no AI call. */}
        {bundle && !profile && !loading && typeFilter !== "all" && (
          <div className="text-center py-10">
            <p className="text-sm text-muted-foreground">
              {EMPTY_SLICE_LABEL[typeFilter]}
            </p>
          </div>
        )}

        {!bundle && !loading && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-1">
              Discover your wine personality
            </p>
            <p className="text-xs text-muted-foreground">
              AI analyzes your {wineCount} wines to map your taste preferences
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
