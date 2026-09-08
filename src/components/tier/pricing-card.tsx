"use client";

import { useState } from "react";
import { Check, Crown, Sparkles, Zap, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTier } from "@/hooks/use-tier";
import { useCheckout } from "@/hooks/use-checkout";
import {
  TIER_ORDER,
  TIER_CONFIGS,
  TIER_FEATURE_BULLETS,
  type Tier,
} from "@/lib/tier";
import type { BillingInterval } from "@/lib/stripe-helpers";

// ─── Icon per tier ───────────────────────────────────────────

const TIER_ICONS: Record<Tier, React.ReactNode> = {
  FREE: <Zap className="h-5 w-5" />,
  PRO: <Sparkles className="h-5 w-5" />,
  PREMIUM: <Crown className="h-5 w-5" />,
};

// ─── Billing Toggle ──────────────────────────────────────────

function BillingToggle({
  interval,
  onChange,
}: {
  interval: BillingInterval;
  onChange: (i: BillingInterval) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm">
      <button
        type="button"
        className={cn(
          "px-3 py-1.5 rounded-md font-medium transition-colors",
          interval === "monthly"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onChange("monthly")}
      >
        Monthly
      </button>
      <button
        type="button"
        className={cn(
          "px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5",
          interval === "annual"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onChange("annual")}
      >
        Annual
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Save 17%
        </Badge>
      </button>
    </div>
  );
}

// ─── Single Pricing Card ─────────────────────────────────────

function PricingTierCard({
  tier,
  isCurrent,
  isPopular,
  isUpgrade,
  interval,
}: {
  tier: Tier;
  isCurrent: boolean;
  isPopular: boolean;
  isUpgrade: boolean;
  interval: BillingInterval;
}) {
  const config = TIER_CONFIGS[tier];
  const bullets = TIER_FEATURE_BULLETS[tier];
  const { startCheckout, checkoutLoading } = useCheckout();

  const monthlyPrice = config.pricing.monthly;
  const annualPrice = config.pricing.annual;
  const showPrice = interval === "annual" && annualPrice
    ? annualPrice / 12
    : monthlyPrice;

  return (
    <Card
      className={cn(
        "relative flex flex-col",
        isPopular &&
          "overflow-visible border-primary shadow-md ring-1 ring-primary/20",
        isCurrent && "border-primary/50 bg-primary/[0.02]"
      )}
    >
      {/* Popular badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground text-[10px] px-2.5 py-0.5 shadow-sm">
            Most Popular
          </Badge>
        </div>
      )}

      <CardHeader className="pb-3 pt-5">
        <div className="flex items-center gap-2 mb-1">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              tier === "FREE" && "bg-muted text-muted-foreground",
              tier === "PRO" && "bg-primary/10 text-primary",
              tier === "PREMIUM" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            )}
          >
            {TIER_ICONS[tier]}
          </div>
          <div>
            <h3 className="text-base font-semibold leading-tight">
              {config.displayName}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {config.tagline}
            </p>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1 mt-2">
          {showPrice === null ? (
            <span className="text-2xl font-bold">Free</span>
          ) : (
            <>
              <span className="text-2xl font-bold">
                ${showPrice.toFixed(2)}
              </span>
              <span className="text-sm text-muted-foreground">/month</span>
            </>
          )}
        </div>
        {interval === "annual" && annualPrice && (
          <p className="text-[11px] text-muted-foreground">
            ${annualPrice.toFixed(2)} billed annually
          </p>
        )}
        {config.trialDays && !isCurrent && interval === "monthly" && (
          <p className="text-xs text-primary font-medium mt-1">
            {config.trialDays}-day free trial
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {config.description}
        </p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col pb-5">
        {/* Feature bullets */}
        <ul className="space-y-2 flex-1 mb-4">
          {bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-2 text-xs"
            >
              <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        {isCurrent ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled
          >
            Current Plan
          </Button>
        ) : isUpgrade ? (
          <Button
            size="sm"
            className={cn(
              "w-full gap-1.5",
              isPopular && "bg-primary hover:bg-primary/90"
            )}
            onClick={() => startCheckout(tier, interval)}
            disabled={checkoutLoading}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {checkoutLoading
              ? "Loading..."
              : config.trialDays && interval === "monthly"
                ? `Start Free Trial`
                : `Upgrade to ${config.displayName}`}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled
          >
            {config.pricing.monthly === null ? "Free Forever" : "Included"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Export ─────────────────────────────────────────────

export function PricingCards() {
  const { tier: currentTier, isPaid } = useTier();
  const { openPortal, portalLoading } = useCheckout();
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  const currentIdx = TIER_ORDER.indexOf(currentTier);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Subscription</h2>
          <p className="text-sm text-muted-foreground">
            Choose the plan that fits your collection
          </p>
        </div>
        {isPaid && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={openPortal}
            disabled={portalLoading}
          >
            <Settings className="h-3.5 w-3.5" />
            {portalLoading ? "Loading..." : "Manage Subscription"}
          </Button>
        )}
      </div>

      <BillingToggle interval={interval} onChange={setInterval} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
        {TIER_ORDER.map((tier) => {
          const tierIdx = TIER_ORDER.indexOf(tier);
          return (
            <PricingTierCard
              key={tier}
              tier={tier}
              isCurrent={tier === currentTier}
              isPopular={tier === "PRO"}
              isUpgrade={tierIdx > currentIdx}
              interval={interval}
            />
          );
        })}
      </div>
    </div>
  );
}
