"use client";

import { useState } from "react";
import { Lock, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTier } from "@/hooks/use-tier";
import { useCheckout } from "@/hooks/use-checkout";
import {
  TIER_DISPLAY_NAMES,
  TIER_CONFIGS,
  TIER_FEATURE_BULLETS,
  getUpgradeTier,
  getTierConfig,
  type Tier,
} from "@/lib/tier";

// ─── Upgrade Popup ───────────────────────────────────────────

interface UpgradePopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  requiredTier?: Tier;
}

export function UpgradePopup({
  open,
  onOpenChange,
  feature,
  requiredTier,
}: UpgradePopupProps) {
  const { tier } = useTier();
  const { startCheckout, checkoutLoading } = useCheckout();
  const targetTier = requiredTier ?? getUpgradeTier(tier) ?? "PRO";
  const targetConfig = TIER_CONFIGS[targetTier];
  const bullets = TIER_FEATURE_BULLETS[targetTier];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
        <DialogHeader className="text-center items-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-lg">{feature}</DialogTitle>
          <DialogDescription>
            This feature requires{" "}
            <span className="font-semibold text-foreground">
              {targetConfig.displayName}
            </span>
            {targetConfig.price
              ? ` ($${targetConfig.price.toFixed(2)}/mo)`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            {targetConfig.displayName} includes:
          </p>
          <ul className="space-y-2">
            {bullets.slice(0, 5).map((bullet) => (
              <li
                key={bullet}
                className="flex items-start gap-2 text-sm"
              >
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            className="w-full gap-1.5"
            onClick={() => startCheckout(targetTier)}
            disabled={checkoutLoading}
          >
            <Sparkles className="h-4 w-4" />
            {checkoutLoading ? "Loading..." : `Upgrade to ${targetConfig.displayName}`}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Hook for triggering upgrade popup ───────────────────────

export function useUpgradePopup() {
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState("");
  const [requiredTier, setRequiredTier] = useState<Tier | undefined>();

  const showUpgrade = (feat: string, tier?: Tier) => {
    setFeature(feat);
    setRequiredTier(tier);
    setOpen(true);
  };

  const popup = (
    <UpgradePopup
      open={open}
      onOpenChange={setOpen}
      feature={feature}
      requiredTier={requiredTier}
    />
  );

  return { showUpgrade, popup };
}

// ─── UpgradePrompt — triggers popup on click ─────────────────

interface UpgradePromptProps {
  /** Which feature is locked */
  feature: string;
  /** Visual variant */
  variant?: "inline" | "card" | "banner";
  /** Optional override for the required tier */
  requiredTier?: Tier;
  /** Optional className */
  className?: string;
}

export function UpgradePrompt({
  feature,
  variant = "card",
  requiredTier,
  className,
}: UpgradePromptProps) {
  const { tier } = useTier();
  const [showPopup, setShowPopup] = useState(false);

  const targetTier = requiredTier ?? getUpgradeTier(tier) ?? "PRO";
  const tierName = TIER_DISPLAY_NAMES[targetTier];
  const price = getTierConfig(targetTier).price;

  const trigger = () => setShowPopup(true);

  return (
    <>
      <UpgradePopup
        open={showPopup}
        onOpenChange={setShowPopup}
        feature={feature}
        requiredTier={requiredTier}
      />

      {variant === "inline" && (
        <button
          onClick={trigger}
          className={cn(
            "inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group",
            className
          )}
        >
          <Lock className="h-3 w-3 shrink-0" />
          <span>
            {feature} requires{" "}
            <span className="font-medium text-primary group-hover:underline">
              {tierName}
              {price ? ` ($${price}/mo)` : ""}
            </span>
          </span>
        </button>
      )}

      {variant === "card" && (
        <button
          onClick={trigger}
          className={cn(
            "w-full border border-dashed border-muted-foreground/25 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors",
            className
          )}
        >
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Lock className="h-6 w-6 text-primary/60" />
            </div>
            <h3 className="text-sm font-semibold mb-1">{feature}</h3>
            <p className="text-xs text-muted-foreground max-w-[240px]">
              Tap to upgrade to {tierName}
              {price ? ` for $${price}/mo` : ""}
            </p>
          </div>
        </button>
      )}

      {variant === "banner" && (
        <button
          onClick={trigger}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors text-left",
            className
          )}
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Lock className="h-4 w-4 text-primary/60" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{feature}</p>
            <p className="text-xs text-muted-foreground">
              Available on {tierName}
              {price ? ` ($${price}/mo)` : ""}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Upgrade
          </Badge>
        </button>
      )}
    </>
  );
}

/**
 * Convenience wrapper — only renders children if user has AI access,
 * otherwise shows the upgrade prompt popup.
 */
export function RequireAI({
  children,
  feature,
  variant = "card",
  className,
}: {
  children: React.ReactNode;
  feature: string;
  variant?: "inline" | "card" | "banner";
  className?: string;
}) {
  const { hasAI } = useTier();

  if (hasAI) return <>{children}</>;

  return (
    <UpgradePrompt
      feature={feature}
      variant={variant}
      className={className}
    />
  );
}
