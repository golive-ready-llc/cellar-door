"use client";

import Script from "next/script";
import { useCookieConsent } from "@/lib/cookie-consent";

/**
 * Loads the Google AdSense script — but only after the visitor has opted in to
 * advertising cookies. Until consent is "accepted" the script never loads, so
 * no AdSense cookies are set. Paid users see no ads regardless (AdSlot returns
 * null), but the script is account-wide, so gating it here is what actually
 * keeps ad cookies off the page pre-consent.
 */
export function AdSenseLoader() {
  const consent = useCookieConsent();
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  if (!clientId || consent !== "accepted") return null;

  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
