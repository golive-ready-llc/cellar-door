import { NextResponse } from "next/server";

/**
 * Proxy for frankfurter.app exchange-rate API.
 *
 * The upstream doesn't send permissive CORS headers for all origins, so
 * calling it directly from the browser fails with a CORS error on page
 * load. Proxying through our own origin avoids that.
 *
 * Response is cached for 12 hours at the edge and in the client via the
 * browser's HTTP cache (Cache-Control header).
 */
export const revalidate = 43200; // 12 hours (Next.js route segment cache)

export async function GET() {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD", {
      // Server-side fetch uses Next.js data cache with tag-based revalidation
      next: { revalidate: 43200 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream rate fetch failed", rates: fallbackRates() },
        { status: 200, headers: cacheHeaders() }
      );
    }
    const data = await res.json();
    const rates: Record<string, number> = { USD: 1, ...data.rates };
    return NextResponse.json({ rates }, { headers: cacheHeaders() });
  } catch {
    return NextResponse.json(
      { error: "Rate fetch error", rates: fallbackRates() },
      { status: 200, headers: cacheHeaders() }
    );
  }
}

function fallbackRates(): Record<string, number> {
  return { USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.36, AUD: 1.53, CHF: 0.88, JPY: 149, CNY: 7.24 };
}

function cacheHeaders() {
  // Browser caches for 1 hour, shared (CDN) caches for 12 hours with 24h SWR
  return {
    "Cache-Control": "public, max-age=3600, s-maxage=43200, stale-while-revalidate=86400",
  };
}
