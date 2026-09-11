"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useTier } from "@/hooks/use-tier";
import { fetchWines, fetchWalls } from "@/lib/data";
import type { Wine, Wall } from "@/types/wine";

export default function InsuranceReportPage() {
  const router = useRouter();
  const { user, userId } = useAuth();
  const { tier } = useTier();
  const isPremium = tier === "PREMIUM";

  const [wines, setWines] = useState<Wine[]>([]);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      try {
        const [w, wa] = await Promise.all([fetchWines(userId!), fetchWalls(userId!)]);
        setWines(w);
        setWalls(wa);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  const now = new Date();
  const reportDate = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const stats = useMemo(() => {
    const totalBottles = wines.length;
    const totalValue = wines.reduce((sum, w) => sum + (w.retailPrice ?? w.price ?? 0), 0);
    const totalCost = wines.reduce((sum, w) => sum + (w.price ?? 0), 0);
    const avgValue = totalBottles > 0 ? totalValue / totalBottles : 0;
    const mostValuable = wines.length > 0
      ? wines.reduce((best, w) => {
          const val = w.retailPrice ?? w.price ?? 0;
          const bestVal = best.retailPrice ?? best.price ?? 0;
          return val > bestVal ? w : best;
        }, wines[0])
      : null;
    return { totalBottles, totalValue, totalCost, avgValue, mostValuable };
  }, [wines]);

  // Group wines by wall/location for storage reference
  const _wallMap = useMemo(() => {
    const map: Record<string, string> = {};
    walls.forEach((w) => {
      map[w.id] = w.name + (w.location ? ` (${w.location})` : "");
    });
    return map;
  }, [walls]);

  // Check for HA sensors
  const haWalls = useMemo(
    () => walls.filter((w) => w.haConfig?.tempEntityId || w.haConfig?.humidityEntityId),
    [walls]
  );

  // Wines with images — deduplicated by name+winery+vintage (same wine = same label)
  const winesWithImages = useMemo(() => {
    const seen = new Set<string>();
    return wines.filter((w) => {
      if (!w.imageUrl || w.imageUrl.startsWith("data:image/svg")) return false;
      const key = `${w.name.toLowerCase()}|${w.winery.toLowerCase()}|${w.vintage ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [wines]);

  const [includePhotos, setIncludePhotos] = useState(false);

  if (!isPremium) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold">Cellar Pro Required</h2>
          <p className="text-sm text-muted-foreground">
            The Insurance Report feature requires a Cellar Pro subscription.
          </p>
          <Button variant="outline" onClick={() => window.close()}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading collection data...</p>
      </div>
    );
  }

  return (
    <>
      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          /* Hide non-report elements */
          header, nav, footer,
          .sidebar, [data-sidebar],
          .bottom-nav,
          .print-hide,
          [data-radix-popper-content-wrapper] {
            display: none !important;
          }
          /* Full-width layout */
          main {
            padding: 0 !important;
            margin: 0 !important;
          }
          [data-sidebar-inset] {
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Report styles */
          body {
            background: white !important;
            color: black !important;
            font-size: 11pt !important;
          }
          .report-container {
            max-width: 100% !important;
            padding: 0.5in !important;
          }
          .report-header {
            border-bottom: 2px solid #333 !important;
          }
          table {
            page-break-inside: auto !important;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          .photo-grid {
            page-break-before: always !important;
          }
          .page-break {
            page-break-before: always !important;
          }
        }
      `}</style>

      {/* Action bar (hidden in print). Wraps to two rows on narrow screens
          — previously the middle "Include label photos (N)" label got
          squeezed by the surrounding buttons and wrapped one character per
          line, becoming illegible. */}
      <div className="print-hide flex flex-wrap items-center gap-2 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              router.push("/stats");
            }
          }}
          className="text-xs gap-1 whitespace-nowrap"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Stats
        </Button>
        <div className="flex-1" />
        {winesWithImages.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={includePhotos}
              onChange={(e) => setIncludePhotos(e.target.checked)}
              className="rounded border-border shrink-0"
            />
            Include label photos ({winesWithImages.length})
          </label>
        )}
        <Button
          onClick={() => window.print()}
          size="sm"
          className="gap-1.5 whitespace-nowrap"
        >
          <Printer className="h-3.5 w-3.5" />
          Print / Save as PDF
        </Button>
      </div>

      {/* Report content */}
      <div className="report-container max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="report-header pb-4 border-b-2 border-foreground/20">
          <h1 className="text-2xl font-bold">Wine Collection Insurance Report</h1>
          {/* whitespace-nowrap on each value prevents per-character wrapping
              of the date / value in narrow PDF columns — "April 28, 2026"
              was breaking after "202" so the trailing "6" landed alone on
              the next line. */}
          <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted-foreground">
            <span className="whitespace-nowrap">
              <strong>Owner:</strong> {user?.displayName || user?.email || "Wine Collector"}
            </span>
            <span className="whitespace-nowrap">
              <strong>Date:</strong> {reportDate}
            </span>
            <span className="whitespace-nowrap">
              <strong>Total Estimated Value:</strong>{" "}
              <span className="text-foreground font-semibold">
                ${stats.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </span>
          </div>
        </div>

        {/* Summary Section */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Collection Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Total Bottles" value={stats.totalBottles.toString()} />
            <SummaryCard
              label="Total Estimated Value"
              value={`$${stats.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            />
            <SummaryCard
              label="Average Bottle Value"
              value={`$${stats.avgValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <SummaryCard
              label="Most Valuable"
              value={
                stats.mostValuable
                  ? `${stats.mostValuable.name} ($${(stats.mostValuable.retailPrice ?? stats.mostValuable.price ?? 0).toLocaleString()})`
                  : "N/A"
              }
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <SummaryCard
              label="Total Purchase Cost"
              value={`$${stats.totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            />
            <SummaryCard
              label="Appreciation"
              value={
                stats.totalCost > 0
                  ? `${((stats.totalValue / stats.totalCost - 1) * 100).toFixed(1)}%`
                  : "N/A"
              }
            />
            <SummaryCard label="Storage Locations" value={walls.length.toString()} />
            <SummaryCard
              label="Photos Available"
              value={`${winesWithImages.length} of ${wines.length}`}
            />
          </div>
        </section>

        {/* Wine Inventory Table */}
        <section className="page-break">
          <h2 className="text-lg font-semibold mb-3">Detailed Wine Inventory</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-foreground/20">
                  <th className="text-left py-2 pr-2 font-semibold">#</th>
                  <th className="text-left py-2 pr-2 font-semibold">Wine</th>
                  <th className="text-left py-2 pr-2 font-semibold">Winery</th>
                  <th className="text-left py-2 pr-2 font-semibold">Vintage</th>
                  <th className="text-right py-2 pr-2 font-semibold">Purchase Price</th>
                  <th className="text-right py-2 pr-2 font-semibold">Est. Market Value</th>
                  <th className="text-left py-2 pr-2 font-semibold">Purchase Date</th>
                  <th className="text-left py-2 font-semibold">Storage</th>
                </tr>
              </thead>
              <tbody>
                {wines.map((wine, idx) => (
                  <tr key={wine.id} className="border-b border-foreground/10">
                    <td className="py-1.5 pr-2 text-muted-foreground">{idx + 1}</td>
                    <td className="py-1.5 pr-2 font-medium">{wine.name}</td>
                    <td className="py-1.5 pr-2">{wine.winery}</td>
                    <td className="py-1.5 pr-2">{wine.vintage ?? "NV"}</td>
                    <td className="py-1.5 pr-2 text-right">
                      {wine.price ? `$${wine.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-medium">
                      {(wine.retailPrice ?? wine.price)
                        ? `$${(wine.retailPrice ?? wine.price ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                    <td className="py-1.5 pr-2">
                      {wine.purchaseDate
                        ? new Date(wine.purchaseDate).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                          })
                        : "—"}
                    </td>
                    <td className="py-1.5 text-xs">
                      {wine.cabinetId ? "Filed" : "Unfiled"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground/20 font-semibold">
                  <td colSpan={4} className="py-2 pr-2">
                    Total ({wines.length} bottles)
                  </td>
                  <td className="py-2 pr-2 text-right">
                    ${stats.totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    ${stats.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Storage Conditions */}
        {haWalls.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Storage Conditions</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Home Assistant sensor data is configured for the following storage locations.
              Live readings may vary; consult your HA dashboard for historical data.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {haWalls.map((w) => (
                <div key={w.id} className="border rounded-lg p-3">
                  <p className="font-medium text-sm">{w.name}</p>
                  {w.location && (
                    <p className="text-xs text-muted-foreground">{w.location}</p>
                  )}
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    {w.haConfig?.tempEntityId && (
                      <span>Temperature sensor: configured</span>
                    )}
                    {w.haConfig?.humidityEntityId && (
                      <span>Humidity sensor: configured</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Photo Gallery — only shown when user opts in */}
        {includePhotos && winesWithImages.length > 0 && (
          <section className="photo-grid">
            <h2 className="text-lg font-semibold mb-3">
              Wine Label Photos ({winesWithImages.length})
            </h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {winesWithImages.map((wine) => (
                <div key={wine.id} className="text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={wine.imageUrl}
                    alt={`${wine.name} label`}
                    className="w-full aspect-[3/4] object-cover rounded border"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">
                    {wine.name} {wine.vintage ?? ""}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="pt-4 border-t border-foreground/10 text-xs text-muted-foreground">
          <p>
            This report was generated by Cellar Door on {reportDate}. Estimated market values
            are based on AI analysis and may not reflect actual resale or replacement costs.
            Consult a professional appraiser for official insurance valuations.
          </p>
          <p className="mt-1">
            Report generated for: {user?.email || "N/A"} &bull; mycellardoor.app
          </p>
        </footer>
      </div>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-0.5 truncate" title={value}>
        {value}
      </p>
    </div>
  );
}
