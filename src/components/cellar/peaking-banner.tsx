"use client";

/**
 * PeakingBanner — first-of-month banner showing how many wines are
 * hitting their drink-now peak this month. The actual native
 * notification body is generic ("Open Cellar Door…") so this banner
 * does the personalised reveal when the user opens the app.
 *
 * Suppression rules:
 *   - only shows in the first 7 days of a calendar month (so a tap on
 *     the notification when it fires still surfaces it)
 *   - dismiss flag stored in localStorage scoped to the YYYY-MM key —
 *     dismissing this month silences only this month's banner
 *   - hidden if zero wines qualify
 */
import { useMemo, useState, useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useWineData } from "@/contexts/wine-data-context";
import { categorizeDrinkWindow } from "@/lib/drink-window";

const SHOW_WINDOW_DAYS = 7;

function thisMonthKey() {
  const now = new Date();
  return `cd:peaking-banner:dismissed:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function PeakingBanner() {
  const { wines } = useWineData();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(thisMonthKey()) === "true");
  }, []);

  const peakingCount = useMemo(() => {
    const year = new Date().getFullYear();
    return wines.filter((w) => {
      const cat = categorizeDrinkWindow(w, year);
      return cat === "drink-now" || cat === "approaching";
    }).length;
  }, [wines]);

  const inWindow = new Date().getDate() <= SHOW_WINDOW_DAYS;

  if (!inWindow || dismissed || peakingCount === 0) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(thisMonthKey(), "true");
    }
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/40 dark:from-amber-950/30 dark:to-amber-900/10 border-amber-200/60 dark:border-amber-800/50">
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="font-medium text-amber-900 dark:text-amber-100">
            {peakingCount} wine{peakingCount === 1 ? "" : "s"} hitting their peak
          </div>
          <p className="text-sm text-amber-800/80 dark:text-amber-200/80 mt-0.5">
            Check the Stats tab for the drinkability report — these bottles are
            in their drink-now window.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-amber-700/60 dark:text-amber-300/60 hover:text-amber-900 dark:hover:text-amber-100 -mr-1 -mt-1 p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
