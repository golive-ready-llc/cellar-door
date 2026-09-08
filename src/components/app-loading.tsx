"use client";

/**
 * Branded loading screen for app boot. Two phases share one visual so the
 * progress bar reads as a single continuous load:
 *   phase 1 (auth check, in the app layout)  → bar animates 4% → 55%
 *   phase 2 (first data fetch, in the page)  → bar animates 55% → 92%
 * The bar never hits 100% on its own — content replacing it is the "done".
 *
 * Repeat visits resolve from the lib/data read cache in a frame or two, so
 * this only really shows on cold start — exactly when a branded screen with
 * progress beats a wall of gray skeleton bars.
 */
export function AppLoading({
  stage = "Loading…",
  phase = 1,
  fullscreen = false,
}: {
  stage?: string;
  phase?: 1 | 2;
  fullscreen?: boolean;
}) {
  const [from, to] = phase === 1 ? [4, 55] : [55, 92];
  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background"
          : "flex flex-col items-center justify-center gap-5 min-h-[60vh]"
      }
    >
      <style>{`@keyframes cd-progress { from { width: ${from}%; } to { width: ${to}%; } }`}</style>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Cellar Door"
        className="h-16 w-auto rounded-2xl shadow-lg"
      />
      <h1 className="text-xl font-bold tracking-tight">Cellar Door</h1>
      <div className="w-60 space-y-2">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary"
            style={{ animation: "cd-progress 2.4s ease-out forwards" }}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground">{stage}</p>
      </div>
    </div>
  );
}
