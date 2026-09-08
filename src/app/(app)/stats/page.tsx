"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useStatsData } from "@/hooks/use-stats-data";
import { StatsHeader } from "@/components/stats/stats-header";
import { HeroStatCards } from "@/components/stats/hero-stat-cards";
import {
  TypeAndDispositionCharts,
  DistributionCharts,
  GeographyCharts,
  ConsumptionChart,
} from "@/components/stats/stats-charts";
import { TopRatedWines } from "@/components/stats/top-rated-wines";
import { FilteredWineSheet } from "@/components/stats/filtered-wine-sheet";
import { DrinkabilityReport } from "@/components/stats/drinkability-report";
import { CellarClimateCard } from "@/components/stats/cellar-climate-card";
import { FlavorGenome } from "@/components/stats/flavor-genome";
import { ValueTracker } from "@/components/stats/value-tracker";
import { WineDetailDialog } from "@/components/wine/wine-detail-dialog";
import { ChallengesSection } from "@/components/challenges/challenges-section";
import { useTier } from "@/hooks/use-tier";
import { useWineData } from "@/contexts/wine-data-context";
import { collectAllTags } from "@/lib/cellar-utils";

export default function StatsPage() {
  const [_mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { can } = useTier();

  const {
    wines,
    walls,
    cabinets,
    history,
    loading,
    selectedWine,
    detailOpen,
    setDetailOpen,
    filterLabel,
    filteredWines,
    handleWineClick,
    handleEditWine,
    showFiltered,
    clearFilter,
    stats,
    typeData,
    vintageData,
    regionData,
    dispositionData,
    consumptionData,
    priceData,
    topRated,
    grapeData,
  } = useStatsData();

  // Push stats data into the shared WineDataContext so the wine detail
  // dialog has the same context regardless of which page opened it.
  const { setWineData } = useWineData();
  useEffect(() => {
    setWineData({ wines, cabinets, walls, allTags: collectAllTags(wines) });
  }, [wines, cabinets, walls, setWineData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (wines.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stats" subtitle="Insights about your wine collection" />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No data yet</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Add some wines to see your collection insights &mdash; type breakdown,
              vintage distribution, regional stats, top-rated bottles, and more.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StatsHeader wines={wines} />

      <DrinkabilityReport wines={wines} onWineClick={handleWineClick} />

      <CellarClimateCard walls={walls} />

      <ChallengesSection />

      <FlavorGenome wineCount={wines.length} />

      {can("valueTracker") && <ValueTracker wines={wines} />}

      <HeroStatCards stats={stats} wines={wines} history={history} />

      <TypeAndDispositionCharts
        typeData={typeData}
        dispositionData={dispositionData}
        wines={wines}
        stats={stats}
        showFiltered={showFiltered}
      />

      <DistributionCharts vintageData={vintageData} priceData={priceData} />

      <GeographyCharts regionData={regionData} grapeData={grapeData} />

      <ConsumptionChart consumptionData={consumptionData} />

      <TopRatedWines topRated={topRated} onWineClick={handleWineClick} />

      <FilteredWineSheet
        filterLabel={filterLabel}
        filteredWines={filteredWines}
        onClose={clearFilter}
        onWineClick={handleWineClick}
      />

      {selectedWine && (
        <WineDetailDialog
          wine={selectedWine}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onUpdate={async (updates) => {
            await handleEditWine(selectedWine.id, updates);
          }}
          onSave={handleEditWine}
        />
      )}
    </div>
  );
}
