"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, X, Loader2, Wine as WineIcon, GlassWater } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Wine } from "@/types/wine";
import { aiDecantRecommendation } from "@/server/actions/ai";
import { toast } from "@/components/ui/custom-toast";
import { scheduleDecantTimer, cancelDecantTimer } from "@/lib/notifications";
import { isNative } from "@/lib/capacitor";

interface DecantTimerDialogProps {
  wine: Wine;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string | null;
}

type TimerState = "idle" | "running" | "paused" | "complete";

// Persist the active decant so the OS notification — not fragile React state —
// is the source of truth. Survives dialog close, app background, and restart.
const ACTIVE_DECANT_KEY = "cd:decant:active";

interface ActiveDecant {
  wineId: string;
  endTime: number; // epoch ms
  totalSeconds: number;
}

function readActiveDecant(): ActiveDecant | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_DECANT_KEY);
    return raw ? (JSON.parse(raw) as ActiveDecant) : null;
  } catch {
    return null;
  }
}

function writeActiveDecant(a: ActiveDecant): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_DECANT_KEY, JSON.stringify(a));
  } catch {
    /* storage unavailable — the OS notification still fires */
  }
}

function clearActiveDecant(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVE_DECANT_KEY);
  } catch {
    /* ignore */
  }
}

// ── Circular Progress Ring ────────────────────────────────────

function CircularProgress({
  progress,
  size = 200,
  strokeWidth = 8,
  children,
}: {
  progress: number; // 0-1
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#decant-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
        <defs>
          <linearGradient id="decant-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export function DecantTimerDialog({
  wine,
  open,
  onOpenChange,
  userId,
}: DecantTimerDialogProps) {
  // AI recommendation state
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<{
    decantMinutes: number;
    recommended: boolean;
    explanation: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Timer state
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedRef = useRef(false);
  // Absolute end timestamp (epoch ms). The countdown derives "remaining" from
  // this so it stays correct across throttling, dialog close, and reopen.
  const endTimeRef = useRef<number | null>(null);

  // On open: rehydrate any still-running decant for THIS wine (survives dialog
  // close, app background, even an app restart), then (re)fetch the AI
  // recommendation for context.
  useEffect(() => {
    if (!open) return;
    setRecommendation(null);
    setError(null);
    notifiedRef.current = false;

    const active = readActiveDecant();
    const rehydrating = !!(active && active.wineId === wine.id);
    if (active && active.wineId === wine.id) {
      const remaining = Math.round((active.endTime - Date.now()) / 1000);
      setTotalSeconds(active.totalSeconds);
      if (remaining > 0) {
        endTimeRef.current = active.endTime;
        setRemainingSeconds(remaining);
        setTimerState("running");
      } else {
        // Finished while we were away — the completion effect cleans up.
        endTimeRef.current = null;
        setRemainingSeconds(0);
        setTimerState("complete");
      }
    } else {
      endTimeRef.current = null;
      setTimerState("idle");
      setRemainingSeconds(0);
      setTotalSeconds(0);
    }

    const fetchRecommendation = async () => {
      setLoading(true);
      try {
        const result = await aiDecantRecommendation(
          {
            name: wine.name,
            winery: wine.winery,
            vintage: wine.vintage,
            type: wine.type,
            region: wine.region,
            country: wine.country,
            grapeVariety: wine.grapeVariety,
          },
          userId ?? undefined
        );
        if (result.success) {
          setRecommendation(result.data);
          // Only seed the timer length from the recommendation when we're not
          // resuming an in-flight timer (don't clobber a running countdown).
          if (!rehydrating) {
            const secs = result.data.decantMinutes * 60;
            setTotalSeconds(secs);
            setRemainingSeconds(secs);
          }
        } else {
          setError(result.error || "Failed to get recommendation");
        }
      } catch {
        setError("Failed to get decant recommendation");
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendation();
  }, [open, wine, userId]);

  // Timer tick — derive "remaining" from the absolute end time so it stays
  // accurate even if the interval was throttled while backgrounded.
  useEffect(() => {
    if (timerState !== "running") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    const tick = () => {
      const end = endTimeRef.current;
      if (end == null) return;
      const remaining = Math.max(0, Math.round((end - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) setTimerState("complete");
    };
    tick(); // sync immediately so reopening doesn't show a stale value
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timerState]);

  // On completion (whether reached in-app or rehydrated from a finished
  // background timer): clear the persisted timer + OS notifications and
  // surface the result in-app.
  useEffect(() => {
    if (timerState === "complete" && !notifiedRef.current) {
      notifiedRef.current = true;
      endTimeRef.current = null;
      clearActiveDecant();
      // The native alarm has already fired (or is firing now); since the user
      // is looking at the result in-app, clear the ongoing + alarm shade.
      void cancelDecantTimer();
      toast.success(`${wine.name} is ready to pour!`);

      // Web fallback — only effective while the tab is open.
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("Decant Timer Complete", {
          body: `${wine.name} is ready to pour!`,
          icon: "/logo-192.png",
        });
      }
    }
  }, [timerState, wine.name]);

  // Closing the dialog only tears down the visual ticker — the scheduled OS
  // notifications keep the timer running in the background (the whole point).
  // Use Reset / "Cancel timer" to actually stop a running decant.
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    onOpenChange(nextOpen);
  }, [onOpenChange]);

  const handleStart = async () => {
    const end = Date.now() + remainingSeconds * 1000;
    endTimeRef.current = end;
    writeActiveDecant({ wineId: wine.id, endTime: end, totalSeconds });
    setTimerState("running");

    // Back the timer with OS notifications so it survives leaving the screen:
    // an ongoing "decanting…" notification now + an alarm at the end time.
    const scheduled = await scheduleDecantTimer(wine.name, new Date(end));
    if (!scheduled) {
      if (isNative) {
        toast.info("Allow notifications to be alerted when decanting finishes.");
      } else if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "default"
      ) {
        // Web fallback: best-effort in-tab notification when complete.
        Notification.requestPermission();
      }
    }
  };

  const handlePause = () => {
    // Freeze the remaining time and drop the OS schedule.
    const end = endTimeRef.current;
    if (end != null) {
      setRemainingSeconds(Math.max(0, Math.round((end - Date.now()) / 1000)));
    }
    endTimeRef.current = null;
    clearActiveDecant();
    setTimerState("paused");
    void cancelDecantTimer();
  };

  const handleReset = () => {
    endTimeRef.current = null;
    clearActiveDecant();
    setTimerState("idle");
    setRemainingSeconds(totalSeconds);
    notifiedRef.current = false;
    void cancelDecantTimer();
  };

  // Format time display
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const progress = totalSeconds > 0 ? 1 - remainingSeconds / totalSeconds : 0;

  // Responsive sizing for the circular progress ring — on small phones the
  // 180px ring + buttons + AI explanation easily exceeds the 85vh dialog cap
  // (especially in landscape). Pick the size at first render based on the
  // current viewport so the timer never overflows.
  const [ringSize, setRingSize] = useState(180);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const measure = () => {
      const vh = window.innerHeight;
      // Available vertical space for the ring inside the dialog (rough
      // budget: header + wine info + AI box + controls + skip = ~280px)
      const budget = Math.max(120, Math.floor(vh * 0.85) - 280);
      setRingSize(Math.min(180, budget));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto p-3 sm:p-4 flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GlassWater className="h-5 w-5 text-purple-500" />
            Decant Timer
          </DialogTitle>
        </DialogHeader>

        {/* Wine info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <WineIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {wine.name}
            {wine.vintage ? ` (${wine.vintage})` : ""}
          </span>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            <p className="text-sm text-muted-foreground">
              Analyzing wine for decant recommendation...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-6">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
          </div>
        )}

        {/* Recommendation loaded - not recommended */}
        {recommendation && !recommendation.recommended && !loading && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <X className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="font-medium text-sm">Decanting not recommended</p>
              <p className="text-sm text-muted-foreground mt-2">
                {recommendation.explanation}
              </p>
            </div>
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Got it
              </Button>
            </div>
          </div>
        )}

        {/* Recommendation loaded - timer */}
        {recommendation && recommendation.recommended && !loading && (
          <div className="space-y-4">
            {/* AI explanation */}
            <div className="rounded-lg bg-purple-500/5 border border-purple-500/10 px-4 py-3">
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">
                Decant for {recommendation.decantMinutes} minutes
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {recommendation.explanation}
              </p>
            </div>

            {/* Timer display */}
            <div className="flex flex-col items-center gap-4 py-2">
              <CircularProgress progress={progress} size={ringSize} strokeWidth={6}>
                <div className="text-center">
                  {timerState === "complete" ? (
                    <div className="space-y-1">
                      <WineIcon className="h-8 w-8 mx-auto text-purple-500 animate-pulse" />
                      <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                        Ready!
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className={cn(
                        "font-bold tabular-nums tracking-tight",
                        ringSize >= 160 ? "text-4xl" : ringSize >= 130 ? "text-3xl" : "text-2xl",
                        timerState === "paused" && "opacity-50"
                      )}>
                        {timeDisplay}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {timerState === "idle" && "Ready to start"}
                        {timerState === "running" && "Decanting..."}
                        {timerState === "paused" && "Paused"}
                      </p>
                    </>
                  )}
                </div>
              </CircularProgress>

              {/* Controls */}
              <div className="flex items-center gap-3">
                {timerState === "complete" ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReset}
                    >
                      <RotateCcw className="h-4 w-4 mr-1.5" />
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleOpenChange(false)}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <WineIcon className="h-4 w-4 mr-1.5" />
                      Pour
                    </Button>
                  </>
                ) : timerState === "running" ? (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleReset}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={handlePause}
                      className="rounded-full w-14 h-14"
                    >
                      <Pause className="h-6 w-6" />
                    </Button>
                  </>
                ) : (
                  <>
                    {timerState === "paused" && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleReset}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="lg"
                      onClick={handleStart}
                      className="rounded-full w-14 h-14 bg-purple-600 hover:bg-purple-700"
                    >
                      <Play className="h-6 w-6 ml-0.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Skip (idle) / Cancel (running) */}
            {timerState !== "complete" && (
              <div className="flex justify-center pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    // Closing the dialog keeps a running timer alive, so an
                    // explicit Skip/Cancel must stop it (and its notifications).
                    if (timerState === "running" || timerState === "paused") {
                      handleReset();
                    }
                    handleOpenChange(false);
                  }}
                >
                  {timerState === "idle" ? "Skip" : "Cancel timer"}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
