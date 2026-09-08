"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Gauge geometry constants */
const GAUGE_CX = 100;
const GAUGE_CY = 110;
const GAUGE_R_IN = 56;
const GAUGE_R_OUT = 82;
const GAUGE_R_NEEDLE = 66;
const GAUGE_SEGMENTS = 25;
const GAUGE_START_DEG = -120;
const GAUGE_END_DEG = 120;
const GAUGE_SWEEP = GAUGE_END_DEG - GAUGE_START_DEG;

function gaugeToRad(deg: number) {
  return ((deg - 90) * Math.PI) / 180;
}

function gaugePolar(angleDeg: number, r: number) {
  const rad = gaugeToRad(angleDeg);
  return { x: GAUGE_CX + r * Math.cos(rad), y: GAUGE_CY + r * Math.sin(rad) };
}

export function DialRateDialog({
  open,
  onOpenChange,
  currentRating,
  onRate,
  title = "Rate this wine",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRating: number | null;
  onRate: (rating: number) => void;
  title?: string;
}) {
  const [value, setValue] = useState(currentRating ?? 0);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (open) setValue(currentRating ?? 0);
  }, [open, currentRating]);

  const snap = (v: number) => Math.round(Math.max(0, Math.min(5, v)) * 10) / 10;
  const increment = () => setValue((v) => snap(v + 0.1));
  const decrement = () => setValue((v) => snap(v - 0.1));

  const getValueFromPointer = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * 200;
    const svgY = ((clientY - rect.top) / rect.height) * 140;
    const dx = svgX - GAUGE_CX;
    const dy = svgY - GAUGE_CY;
    const angleRad = Math.atan2(dx, -dy);
    const angleDeg = (angleRad * 180) / Math.PI;
    if (angleDeg < GAUGE_START_DEG) return 0;
    if (angleDeg > GAUGE_END_DEG) return 5;
    const ratio = (angleDeg - GAUGE_START_DEG) / GAUGE_SWEEP;
    return snap(ratio * 5);
  }, []);

  const getLabel = (v: number) => {
    if (v === 0) return "Tap the gauge or use buttons";
    if (v < 1.5) return "Poor";
    if (v < 2.5) return "Below Average";
    if (v < 3.5) return "Good";
    if (v < 4.5) return "Very Good";
    return "Outstanding";
  };

  const ticks = Array.from({ length: GAUGE_SEGMENTS }, (_, i) => {
    const frac = i / (GAUGE_SEGMENTS - 1);
    const angleDeg = GAUGE_START_DEG + frac * GAUGE_SWEEP;
    const inner = gaugePolar(angleDeg, GAUGE_R_IN);
    const outer = gaugePolar(angleDeg, GAUGE_R_OUT);
    const hue = frac * 120;
    const ratingForTick = frac * 5;
    const active = value > 0 && ratingForTick <= value + 0.05;
    return { i, inner, outer, hue, active, angleDeg };
  });

  const needleDeg = GAUGE_START_DEG + (value / 5) * GAUGE_SWEEP;
  const needleTip = gaugePolar(needleDeg, GAUGE_R_NEEDLE);

  const scaleLabels = [0, 1, 2, 3, 4, 5].map((n) => {
    const frac = n / 5;
    const angleDeg = GAUGE_START_DEG + frac * GAUGE_SWEEP;
    const pos = gaugePolar(angleDeg, GAUGE_R_OUT + 12);
    return { n, ...pos };
  });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in-0 duration-100"
      onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}
    >
      <div
        className="relative w-full max-w-xs mx-4 rounded-xl bg-background p-4 ring-1 ring-foreground/10 shadow-xl animate-in zoom-in-95 fade-in-0 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center pb-0 mb-2">
          <h3 className="text-base font-medium">{title}</h3>
        </div>
        <button
          type="button"
          className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
          onClick={() => onOpenChange(false)}
        >
          <span className="sr-only">Close</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <div className="flex flex-col items-center gap-1 py-0">
          <div className="w-full max-w-[260px] aspect-[200/140]">
            <svg
              ref={svgRef}
              viewBox="0 0 200 140"
              className="w-full h-full touch-none select-none"
              onPointerDown={(e) => {
                const v = getValueFromPointer(e.clientX, e.clientY);
                if (v !== null) setValue(v);
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (e.buttons > 0) {
                  const v = getValueFromPointer(e.clientX, e.clientY);
                  if (v !== null) setValue(v);
                }
              }}
            >
              {ticks.map((t) => (
                <line
                  key={t.i}
                  x1={t.inner.x}
                  y1={t.inner.y}
                  x2={t.outer.x}
                  y2={t.outer.y}
                  stroke={`hsl(${t.hue}, 80%, 50%)`}
                  strokeWidth={6}
                  strokeLinecap="round"
                  opacity={t.active ? 1 : 0.15}
                />
              ))}
              {scaleLabels.map((l) => (
                <text
                  key={l.n}
                  x={l.x}
                  y={l.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-muted-foreground"
                  fontSize="9"
                  fontWeight="500"
                >
                  {l.n}
                </text>
              ))}
              <line
                x1={GAUGE_CX}
                y1={GAUGE_CY}
                x2={needleTip.x}
                y2={needleTip.y}
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                className="text-foreground transition-all duration-100"
              />
              <circle cx={GAUGE_CX} cy={GAUGE_CY} r={6} className="fill-foreground" />
              <circle cx={GAUGE_CX} cy={GAUGE_CY} r={3} className="fill-background" />
            </svg>
          </div>

          <div className="flex items-center gap-5 -mt-2">
            <button
              type="button"
              className="h-10 w-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-xl font-bold transition-colors active:scale-95 disabled:opacity-30"
              onClick={decrement}
              disabled={value <= 0}
            >
              −
            </button>
            <div className="text-center min-w-[4.5rem]">
              <div className={cn(
                "text-4xl font-bold tabular-nums tracking-tight transition-colors",
                value > 0 ? "text-foreground" : "text-muted-foreground/40"
              )}>
                {value.toFixed(1)}
              </div>
            </div>
            <button
              type="button"
              className="h-10 w-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-xl font-bold transition-colors active:scale-95 disabled:opacity-30"
              onClick={increment}
              disabled={value >= 5}
            >
              +
            </button>
          </div>

          <p className={cn(
            "text-sm font-medium transition-colors h-5",
            value > 0 ? "text-foreground" : "text-muted-foreground"
          )}>
            {getLabel(value)}
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          {currentRating != null && currentRating > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => { onRate(0); onOpenChange(false); }}
            >
              Clear
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={value === 0 && !(currentRating && currentRating > 0)}
            onClick={() => { onRate(value); onOpenChange(false); }}
          >
            {value > 0 ? `Rate ${value.toFixed(1)}` : "Save"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
