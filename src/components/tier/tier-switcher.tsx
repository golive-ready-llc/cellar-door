"use client";

import { Zap, Sparkles, Crown, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { TIER_CONFIGS, TIER_ORDER, type Tier } from "@/lib/tier";

const TIER_ICONS: Record<Tier, React.ReactNode> = {
  FREE: <Zap className="h-3.5 w-3.5" />,
  PRO: <Sparkles className="h-3.5 w-3.5" />,
  PREMIUM: <Crown className="h-3.5 w-3.5" />,
};

const TIER_COLORS: Record<Tier, string> = {
  FREE: "text-muted-foreground",
  PRO: "text-primary",
  PREMIUM: "text-amber-500",
};

/**
 * Dev-only tier switcher. Lets you toggle between FREE / PRO / PREMIUM
 * to test feature gating without a real Stripe subscription.
 *
 * Only renders when devMode is true.
 */
export function TierSwitcher() {
  const { devMode, tier, setTier } = useAuth();

  const config = TIER_CONFIGS[tier];

  // Non-dev users: show a read-only tier badge for PAID tiers (Cellar+ / Cellar Pro).
  // FREE users see nothing — the "Upgrade" CTA lives in the pricing card.
  if (!devMode) {
    if (tier === "FREE") return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 h-7 px-2 text-xs font-semibold rounded-md border border-current/20",
          TIER_COLORS[tier],
          tier === "PRO" && "bg-primary/5",
          tier === "PREMIUM" && "bg-amber-500/10"
        )}
        title={`You're on ${config.displayName}`}
      >
        {TIER_ICONS[tier]}
        {config.displayName}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center justify-center gap-1.5 h-7 px-2 text-xs font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer",
          TIER_COLORS[tier]
        )}
      >
        {TIER_ICONS[tier]}
        {config.displayName}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {TIER_ORDER.map((t) => {
          const c = TIER_CONFIGS[t];
          const isActive = t === tier;
          return (
            <DropdownMenuItem
              key={t}
              onClick={() => setTier?.(t)}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                isActive && "bg-accent"
              )}
            >
              <span className={TIER_COLORS[t]}>{TIER_ICONS[t]}</span>
              <span className="flex-1">{c.displayName}</span>
              {c.price !== null && (
                <span className="text-[10px] text-muted-foreground">
                  ${c.price}/mo
                </span>
              )}
              {isActive && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1">
                  Active
                </Badge>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
