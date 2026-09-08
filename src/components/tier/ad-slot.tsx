"use client";

import { useEffect, useRef, useState } from "react";
import { useTier } from "@/hooks/use-tier";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────

type AdLocation = "sidebar" | "banner" | "inline";

interface AdSlotProps {
  /** Where this ad slot appears — affects sizing */
  location: AdLocation;
  /** Optional className */
  className?: string;
}

// ─── Size presets per location ───────────────────────────────

const AD_SIZES: Record<AdLocation, { width: string; height: string }> = {
  sidebar: { width: "w-full", height: "h-32" },
  banner: { width: "w-full", height: "h-16" },
  inline: { width: "w-full", height: "h-24" },
};

// ─── Test ad content (shown when AdSense isn't configured) ──

const TEST_ADS = {
  banner: [
    {
      text: "Discover rare vintages at WineExchange.com",
      cta: "Shop Now",
      bg: "from-amber-900/40 to-amber-800/20",
      accent: "text-amber-400",
    },
    {
      text: "Riedel Crystal Glasses — 20% off this week",
      cta: "View Deal",
      bg: "from-rose-900/30 to-rose-800/15",
      accent: "text-rose-400",
    },
    {
      text: "Wine Spectator Digital — 3 months free trial",
      cta: "Subscribe",
      bg: "from-purple-900/30 to-purple-800/15",
      accent: "text-purple-400",
    },
    {
      text: "Coravin Wine Preservation Systems",
      cta: "Learn More",
      bg: "from-sky-900/30 to-sky-800/15",
      accent: "text-sky-400",
    },
  ],
  inline: [
    {
      headline: "Wine Storage Solutions",
      text: "Climate-controlled wine cabinets from $299. Protect your investment.",
      cta: "Shop Wine Fridges",
      bg: "from-amber-900/30 to-stone-900/40",
      accent: "text-amber-400",
    },
    {
      headline: "Master of Wine Course",
      text: "Start your wine education journey. Online courses from $49/month.",
      cta: "Start Learning",
      bg: "from-violet-900/30 to-stone-900/40",
      accent: "text-violet-400",
    },
    {
      headline: "Premium Cork Supplier",
      text: "Natural and synthetic corks for home winemakers. Free shipping over $50.",
      cta: "Order Now",
      bg: "from-emerald-900/30 to-stone-900/40",
      accent: "text-emerald-400",
    },
  ],
  sidebar: [
    {
      headline: "Vivino Premium",
      text: "Scan any wine label. Get ratings, reviews, and price comparisons instantly.",
      cta: "Download Free",
      bg: "from-red-900/30 to-stone-900/40",
      accent: "text-red-400",
    },
    {
      headline: "Napa Valley Wine Train",
      text: "An unforgettable culinary journey through wine country. Book your trip today.",
      cta: "Book Now",
      bg: "from-amber-900/30 to-stone-900/40",
      accent: "text-amber-400",
    },
  ],
};

// ─── Component ───────────────────────────────────────────────

export function AdSlot({ location, className }: AdSlotProps) {
  const { isPaid } = useTier();
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const [adIndex, setAdIndex] = useState(0);

  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  // Pick a random test ad on mount
  useEffect(() => {
    const ads = TEST_ADS[location];
    setAdIndex(Math.floor(Math.random() * ads.length));
  }, [location]);

  useEffect(() => {
    // Push the ad once when the element mounts
    if (!clientId || isPaid || pushed.current) return;
    try {
      const adsbygoogle = (window as unknown as { adsbygoogle: unknown[] })
        .adsbygoogle;
      if (adsbygoogle) {
        adsbygoogle.push({});
        pushed.current = true;
      }
    } catch {
      // AdSense not loaded yet or ad-blocker active — silently ignore
    }
  }, [clientId, isPaid]);

  // Paid users never see ads
  if (isPaid) return null;

  // Inside a Capacitor native app, don't show web ads (use AdMob later)
  if (typeof window !== "undefined" && "Capacitor" in window) {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) return null;
  }

  const size = AD_SIZES[location];

  // If AdSense isn't configured, show realistic test ads
  if (!clientId) {
    const ads = TEST_ADS[location];
    const ad = ads[adIndex % ads.length];

    if (location === "banner") {
      const bannerAd = ad as (typeof TEST_ADS.banner)[number];
      return (
        <div
          className={cn(
            size.width,
            size.height,
            `rounded-lg bg-gradient-to-r ${bannerAd.bg}`,
            "border border-border/30",
            "flex items-center justify-between px-4 gap-3",
            "select-none cursor-pointer group",
            "hover:border-border/50 transition-colors",
            className
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 shrink-0">
              Ad
            </span>
            <p className="text-xs text-muted-foreground truncate">
              {bannerAd.text}
            </p>
          </div>
          <span
            className={cn(
              "text-[10px] font-semibold shrink-0 px-2.5 py-1 rounded-full border border-current/20",
              bannerAd.accent,
              "group-hover:underline"
            )}
          >
            {bannerAd.cta}
          </span>
        </div>
      );
    }

    // inline or sidebar
    const detailAd = ad as (typeof TEST_ADS.inline)[number];
    return (
      <div
        className={cn(
          size.width,
          location === "sidebar" ? "min-h-[8rem]" : "min-h-[5rem]",
          `rounded-lg bg-gradient-to-br ${detailAd.bg}`,
          "border border-border/30",
          "p-3.5 flex flex-col justify-between",
          "select-none cursor-pointer group",
          "hover:border-border/50 transition-colors",
          className
        )}
      >
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50">
              Sponsored
            </span>
          </div>
          <p className="text-xs font-semibold text-foreground/80 mb-0.5">
            {detailAd.headline}
          </p>
          <p className="text-[11px] text-muted-foreground line-clamp-2">
            {detailAd.text}
          </p>
        </div>
        <div className="flex justify-end mt-2">
          <span
            className={cn(
              "text-[10px] font-semibold px-2.5 py-1 rounded-full border border-current/20",
              detailAd.accent,
              "group-hover:underline"
            )}
          >
            {detailAd.cta}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(size.width, "overflow-hidden", className)}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={clientId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
