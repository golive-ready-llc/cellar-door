"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { generateStatsCard, shareCanvas } from "@/lib/share-utils";
import { computeShareData } from "@/lib/stats-utils";
import { InsuranceReportButton } from "@/components/stats/insurance-report";
import type { Wine } from "@/types/wine";

interface StatsHeaderProps {
  wines: Wine[];
}

export function StatsHeader({ wines }: StatsHeaderProps) {
  const handleShare = async () => {
    const data = computeShareData(wines);
    const canvas = generateStatsCard(data);
    await shareCanvas(canvas, "My Wine Collection");
  };

  return (
    <PageHeader
      title="Stats"
      subtitle="Insights about your wine collection"
      action={
        <div className="flex items-center gap-2">
          <InsuranceReportButton wineCount={wines.length} />
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8"
            onClick={handleShare}
          >
            <Share2 className="h-3.5 w-3.5 mr-1" />
            Share
          </Button>
        </div>
      }
    />
  );
}
