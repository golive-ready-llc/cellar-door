"use client";

import { useState, useCallback } from "react";
import {
  GlassWater,
  Loader2,
  Wine as WineIcon,
  Users,
  Clock,
  DollarSign,
  ShoppingCart,
  ChevronRight,
  MessageCircle,
  Lightbulb,
  Palette,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { WINE_TYPE_COLORS } from "@/types/constants";
import { isLightWineType, isSparklingType } from "@/types/wine";
import type { Wine } from "@/types/wine";
import { aiPourCostCalculation } from "@/server/actions/ai";
import { useTier } from "@/hooks/use-tier";
import { UpgradePrompt } from "@/components/tier/upgrade-prompt";
import type { AiPourCostResult } from "@/lib/ai";

interface PourCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wines: Wine[];
  onWineClick?: (wine: Wine) => void;
}

const DURATION_OPTIONS = [
  { value: "2", label: "2 hours" },
  { value: "3", label: "3 hours" },
  { value: "4", label: "4 hours" },
  { value: "5", label: "5 hours" },
];

const STYLE_OPTIONS = [
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "mixed", label: "Mixed" },
];

export function PourCostDialog({
  open,
  onOpenChange,
  wines,
  onWineClick,
}: PourCostDialogProps) {
  const { hasAI, userId, tier } = useTier();
  const isPremium = tier === "PREMIUM";

  const [guestCount, setGuestCount] = useState(10);
  const [duration, setDuration] = useState("3");
  const [budget, setBudget] = useState("");
  const [withMealPairing, setWithMealPairing] = useState(false);
  const [courseCount, setCourseCount] = useState(3);
  const [style, setStyle] = useState("casual");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiPourCostResult | null>(null);

  const handleCalculate = useCallback(async () => {
    if (guestCount <= 0 || wines.length === 0) return;
    setLoading(true);
    try {
      const wineData = wines.map((w) => ({
        id: w.id,
        name: w.name,
        winery: w.winery,
        vintage: w.vintage,
        type: w.type,
        grapeVariety: w.grapeVariety,
        region: w.region,
        country: w.country,
        price: w.price,
        disposition: w.disposition,
      }));
      const res = await aiPourCostCalculation(
        {
          guestCount,
          duration: parseInt(duration, 10),
          budget: budget ? parseFloat(budget) : undefined,
          courseCount: withMealPairing ? courseCount : 1,
          style: style as "casual" | "formal" | "mixed",
        },
        wineData,
        userId ?? undefined
      );
      if (res.success) {
        setResult(res.data);
      }
    } finally {
      setLoading(false);
    }
  }, [guestCount, duration, budget, withMealPairing, courseCount, style, wines, userId]);

  const handleWineClick = useCallback(
    (wineId: string) => {
      const wine = wines.find((w) => w.id === wineId);
      if (wine && onWineClick) {
        onOpenChange(false);
        setTimeout(() => onWineClick(wine), 200);
      }
    },
    [wines, onWineClick, onOpenChange]
  );

  const handleReset = useCallback(() => {
    setResult(null);
  }, []);

  const COURSE_LABELS = ["Aperitif", "Starter", "Main", "Cheese", "Dessert"];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setTimeout(handleReset, 300);
        }
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <GlassWater className="h-4 w-4 text-purple-600" />
            </div>
            Wine Tasting Planner
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Plan a tasting event with AI-curated flights, discussion topics, and pairing order.
          </p>
        </DialogHeader>

        {!isPremium ? (
          <UpgradePrompt feature="Wine Tasting Planner" variant="card" requiredTier="PREMIUM" />
        ) : !hasAI ? (
          <UpgradePrompt feature="AI Features" variant="card" />
        ) : (
          <div className="space-y-4">
            {!result ? (
              <>
                {/* Input Form */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <Users className="h-3 w-3" /> Guests
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={guestCount}
                      onChange={(e) => setGuestCount(parseInt(e.target.value, 10) || 0)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Duration
                    </Label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      disabled={loading}
                      className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm transition-colors"
                    >
                      {DURATION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value} className="bg-background text-foreground">{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Budget (optional)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="No limit"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Style</Label>
                    <select
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                      disabled={loading}
                      className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm transition-colors"
                    >
                      {STYLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value} className="bg-background text-foreground">{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Meal pairing toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={withMealPairing}
                    onChange={(e) => setWithMealPairing(e.target.checked)}
                    disabled={loading}
                    className="rounded border-input h-4 w-4 accent-purple-600"
                  />
                  <span className="text-xs text-foreground">Pair with meal courses</span>
                </label>

                {/* Course selector — only when meal pairing enabled */}
                {withMealPairing && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                    <Label className="text-xs">Courses</Label>
                    <select
                      value={courseCount}
                      onChange={(e) => setCourseCount(parseInt(e.target.value, 10))}
                      disabled={loading}
                      className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm transition-colors"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n} className="bg-background text-foreground">
                          {n} — {COURSE_LABELS.slice(0, n).join(", ")}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <Button
                  onClick={handleCalculate}
                  disabled={loading || guestCount <= 0}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      Planning tasting...
                    </>
                  ) : (
                    <>
                      <GlassWater className="h-4 w-4 mr-1.5" />
                      Plan Wine Tasting
                    </>
                  )}
                </Button>

                {loading && (
                  <div className="flex flex-col items-center py-4 gap-2">
                    <div className="relative">
                      <WineIcon className="h-8 w-8 text-purple-600 animate-bounce" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Curating your tasting flight and discussion notes...
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Results */}
                <div className="space-y-4">
                  {/* Summary stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{result.totalBottles}</p>
                      <p className="text-[10px] text-muted-foreground">Bottles</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">
                        ${result.estimatedCost.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Est. Cost</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">
                        ${result.perGuestCost.toFixed(0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Per Guest</p>
                    </div>
                  </div>

                  {/* Courses */}
                  {result.courses.map((course, idx) => (
                    <div key={idx} className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {course.courseName}
                      </p>
                      {course.wines.map((pw, wIdx) => {
                        const wine = wines.find((w) => w.id === pw.wineId);
                        return (
                          <button
                            key={pw.wineId + wIdx}
                            onClick={() => handleWineClick(pw.wineId)}
                            className="w-full text-left p-3 rounded-lg border border-border hover:border-purple-300 dark:hover:border-purple-700 transition-colors bg-background overflow-hidden"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
                                style={{
                                  backgroundColor:
                                    WINE_TYPE_COLORS[
                                      (wine?.type || "red") as keyof typeof WINE_TYPE_COLORS
                                    ] || "#666",
                                }}
                              >
                                <WineIcon
                                  className="h-3.5 w-3.5"
                                  style={{
                                    color: isLightWineType(wine?.type || "") ? "#333" : "#fff",
                                  }}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-sm truncate">
                                    {pw.wineName}
                                  </span>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                </div>
                                <p className="text-xs text-muted-foreground">{pw.winery}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {pw.bottlesNeeded} bottle{pw.bottlesNeeded !== 1 ? "s" : ""}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    ~{pw.poursPerBottle} pours each
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                  {pw.reason}
                                </p>
                                {/* Tasting discussion features */}
                                <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                                  <div className="flex items-start gap-1.5">
                                    <Palette className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                                    <p className="text-[11px] text-amber-200/80">
                                      <span className="font-medium text-amber-400">Look for:</span>{" "}
                                      {wine?.type === "red" ? "Deep ruby hues, viscosity on the glass" :
                                       wine?.type === "rosé" ? "Salmon to pale pink, brilliance" :
                                       isSparklingType(wine?.type ?? "") ? "Fine persistent bubbles, mousse" :
                                       isLightWineType(wine?.type || "") ? "Pale gold to straw color, clarity" :
                                       "Color depth and clarity"}
                                    </p>
                                  </div>
                                  <div className="flex items-start gap-1.5">
                                    <MessageCircle className="h-3 w-3 text-blue-400 mt-0.5 shrink-0" />
                                    <p className="text-[11px] text-blue-200/80">
                                      <span className="font-medium text-blue-400">Discuss:</span>{" "}
                                      {wine?.region && wine?.country
                                        ? `How ${wine.region} (${wine.country}) terroir shapes this ${wine.grapeVariety || wine.type}`
                                        : `What aromas and flavors stand out on first taste`}
                                    </p>
                                  </div>
                                  <div className="flex items-start gap-1.5">
                                    <Lightbulb className="h-3 w-3 text-green-400 mt-0.5 shrink-0" />
                                    <p className="text-[11px] text-green-200/80">
                                      <span className="font-medium text-green-400">Tip:</span>{" "}
                                      {wine?.vintage && wine.vintage < new Date().getFullYear() - 5
                                        ? `This ${new Date().getFullYear() - wine.vintage}-year-old wine may show evolved secondary notes — ask guests to compare with the younger wines`
                                        : "Serve slightly below room temperature for reds, or well-chilled for whites — let guests notice how flavors open as it warms"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}

                  {/* Shopping list */}
                  {result.shoppingList.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <ShoppingCart className="h-3 w-3" /> Shopping List
                      </p>
                      {result.shoppingList.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border border-dashed border-border bg-muted/30 overflow-hidden"
                        >
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.type} &middot; {item.grapeVariety}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.quantity} bottle{item.quantity !== 1 ? "s" : ""} &middot; ~${item.estimatedPrice}/ea
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="w-full"
                  >
                    Plan another tasting
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
