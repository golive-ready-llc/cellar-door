"use client";

import { useEffect, useState } from "react";

/**
 * Community CD Score for one wine — fetched the first time `active` turns
 * true and kept for the component's lifetime. A failed fetch is non-fatal:
 * the score is a nice-to-have and the dialogs render fine without it.
 */
export function useCommunityScore(
  active: boolean,
  name: string,
  winery: string,
  vintage: number | null
) {
  const [cdScore, setCdScore] = useState<number | null>(null);
  const [cdRatingCount, setCdRatingCount] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (cdScore != null) return;
    let cancelled = false;
    (async () => {
      try {
        const { fetchCommunityScore } = await import("@/lib/data");
        const res = await fetchCommunityScore(name, winery, vintage);
        if (cancelled || !res) return;
        setCdScore(res.cdScore);
        setCdRatingCount(res.cdRatingCount);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, name, winery, vintage, cdScore]);

  return { cdScore, cdRatingCount };
}
