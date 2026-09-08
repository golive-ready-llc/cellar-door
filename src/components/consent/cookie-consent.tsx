"use client";

import * as React from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCookieConsent,
  setCookieConsent,
  onOpenCookieSettings,
} from "@/lib/cookie-consent";

/**
 * Cookie consent banner. Appears on the first visit (consent undecided) and
 * whenever the visitor reopens it from the footer "Cookie settings" link.
 *
 * "Accept" and "Reject" are given equal weight (GDPR requires rejecting to be
 * as easy as accepting). Rejecting is also the default outcome if the visitor
 * ignores the banner — nothing non-essential loads until they explicitly accept.
 */
export function CookieConsent() {
  const consent = useCookieConsent();
  const [mounted, setMounted] = React.useState(false);
  const [forceOpen, setForceOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return onOpenCookieSettings(() => setForceOpen(true));
  }, []);

  // Don't render until mounted (consent depends on localStorage → avoids a
  // hydration mismatch and a flash on every load for those who've decided).
  if (!mounted) return null;

  const visible = consent === null || forceOpen;
  if (!visible) return null;

  function choose(value: "accepted" | "rejected") {
    setCookieConsent(value);
    setForceOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur supports-backdrop-filter:bg-card/80 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:flex">
              <Cookie className="h-5 w-5 text-primary" />
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">We use cookies</p>
              <p className="mt-1 leading-relaxed">
                Essential cookies keep you signed in and the app working — those
                are always on. With your permission, free-tier pages also load
                Google AdSense, which sets advertising cookies. Read more in our{" "}
                <Link
                  href="/terms#privacy"
                  className="text-primary underline underline-offset-2 hover:text-foreground"
                >
                  Privacy&nbsp;Policy
                </Link>
                .
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2 sm:flex-col sm:justify-center">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => choose("rejected")}
            >
              Reject non-essential
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              onClick={() => choose("accepted")}
            >
              Accept all
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
