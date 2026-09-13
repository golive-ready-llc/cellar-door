"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTier } from "@/hooks/use-tier";
import { UpgradePrompt } from "@/components/tier/upgrade-prompt";

export function InsuranceReportButton({ wineCount }: { wineCount: number }) {
  const { tier } = useTier();
  const isPremium = tier === "PREMIUM";
  const [loading, setLoading] = useState(false);

  if (!isPremium) {
    return (
      <UpgradePrompt
        feature="Insurance Report"
        variant="inline"
        requiredTier="PREMIUM"
        className="mt-1"
      />
    );
  }

  const handleClick = () => {
    setLoading(true);
    window.open("/insurance-report", "_blank");
    // Reset after short delay
    setTimeout(() => setLoading(false), 1000);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs h-8 gap-1.5"
      onClick={handleClick}
      disabled={loading || wineCount === 0}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileText className="h-3.5 w-3.5" />
      )}
      Insurance Report
    </Button>
  );
}
