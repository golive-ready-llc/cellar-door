import { cn } from "@/lib/utils";
import { TIER_DISPLAY_NAMES, type Tier } from "@/lib/tier";

const TIER_COLORS: Record<Tier, string> = {
  FREE: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  PRO: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  PREMIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

export function TierBadge({
  tier,
  className,
}: {
  tier: Tier;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        TIER_COLORS[tier],
        className
      )}
    >
      {TIER_DISPLAY_NAMES[tier]}
    </span>
  );
}
