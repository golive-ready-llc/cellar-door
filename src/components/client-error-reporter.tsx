"use client";

import { useEffect } from "react";

/**
 * Ships uncaught client errors and unhandled promise rejections to
 * /api/client-log so phone-side failures show up in the server logs.
 * Mounted once in the root layout. Renders nothing.
 *
 * Bounded: at most 10 reports per page load, deduped by message, and
 * fire-and-forget (a failing report must never cause its own error loop).
 */
export function ClientErrorReporter() {
  useEffect(() => {
    let budget = 10;
    const seen = new Set<string>();

    const report = (source: string, message: string, stack?: string) => {
      if (budget <= 0) return;
      const key = message.slice(0, 200);
      if (seen.has(key)) return;
      seen.add(key);
      budget--;
      try {
        const body = JSON.stringify({
          source,
          message: message.slice(0, 500),
          stack: stack?.slice(0, 1500),
          path: window.location.pathname,
        });
        // sendBeacon survives page unloads; fetch keepalive as fallback.
        if (!navigator.sendBeacon?.("/api/client-log", new Blob([body], { type: "application/json" }))) {
          fetch("/api/client-log", { method: "POST", body, keepalive: true }).catch(() => {});
        }
      } catch {
        // never throw from the reporter
      }
    };

    const onError = (e: ErrorEvent) => {
      report("window.onerror", e.message || "unknown error", e.error?.stack);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      report(
        "unhandledrejection",
        r instanceof Error ? `${r.name}: ${r.message}` : String(r).slice(0, 500),
        r instanceof Error ? r.stack : undefined
      );
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
