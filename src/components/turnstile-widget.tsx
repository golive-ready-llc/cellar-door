"use client";

import * as React from "react";

/**
 * Cloudflare Turnstile widget. Renders the challenge and hands the parent a
 * token via onVerify (null when it errors/expires). Renders nothing when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set, so forms work before Turnstile is
 * provisioned — pair with `turnstileEnabled` to decide whether to require a token.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/** True when Turnstile is configured — callers gate "require a token" on this. */
export const turnstileEnabled = Boolean(SITE_KEY);

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptLoading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile script failed"));
    document.head.appendChild(s);
  });
  return scriptLoading;
}

export function TurnstileWidget({
  onVerify,
  className,
}: {
  onVerify: (token: string | null) => void;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const cb = React.useRef(onVerify);
  cb.current = onVerify;

  React.useEffect(() => {
    if (!SITE_KEY) return;
    let widgetId: string | null = null;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => cb.current(token),
          "error-callback": () => cb.current(null),
          "expired-callback": () => cb.current(null),
          theme: "auto",
        });
      })
      .catch(() => cb.current(null));

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          /* already gone */
        }
      }
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={ref} className={className} />;
}
