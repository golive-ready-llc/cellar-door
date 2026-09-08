"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Wine as WineIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Hourglass,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { categorizeDrinkWindow, parseDrinkWindow, type DrinkCategory } from "@/lib/drink-window";
import {
  WINE_TYPE_COLORS,
  WINE_TYPE_LABELS,
} from "@/types/constants";
import { groupWinesByIdentity } from "@/lib/inventory-utils";
import type { Wine, WineType } from "@/types/wine";

// ─── Props ───────────────────────────────────────────────────

interface DrinkabilityReportProps {
  wines: Wine[];
  onWineClick?: (wine: Wine) => void;
}

// ─── Category config ─────────────────────────────────────────

type ReportCategory = DrinkCategory | "unknown";

interface CategoryConfig {
  label: string;
  color: string;
  icon: typeof WineIcon;
}

const CATEGORY_CONFIG: Record<ReportCategory, CategoryConfig> = {
  "drink-now": {
    label: "Drink Now",
    color: "#22c55e",
    icon: CheckCircle2,
  },
  approaching: {
    label: "Approaching Peak",
    color: "#f59e0b",
    icon: Clock,
  },
  "past-peak": {
    label: "Past Peak",
    color: "#ef4444",
    icon: AlertTriangle,
  },
  hold: {
    label: "Safe to Hold",
    color: "#3b82f6",
    icon: Hourglass,
  },
  unknown: {
    label: "Unknown",
    color: "#6b7280",
    icon: WineIcon,
  },
};

const CATEGORY_ORDER: ReportCategory[] = [
  "past-peak",
  "drink-now",
  "approaching",
  "hold",
  "unknown",
];

// ─── Sorting ─────────────────────────────────────────────────

function sortWinesForCategory(
  wines: Wine[],
  category: ReportCategory,
  currentYear: number
): Wine[] {
  return [...wines].sort((a, b) => {
    const windowA = parseDrinkWindow(a.drinkWindow);
    const windowB = parseDrinkWindow(b.drinkWindow);

    switch (category) {
      case "past-peak": {
        // Most overdue first (furthest past end year)
        const overA = windowA.end !== null ? currentYear - windowA.end : 0;
        const overB = windowB.end !== null ? currentYear - windowB.end : 0;
        return overB - overA;
      }
      case "approaching": {
        // Closest to window start first
        const distA = windowA.start !== null ? windowA.start - currentYear : Infinity;
        const distB = windowB.start !== null ? windowB.start - currentYear : Infinity;
        return distA - distB;
      }
      case "drink-now": {
        // Window end soonest first (drink sooner)
        const endA = windowA.end ?? Infinity;
        const endB = windowB.end ?? Infinity;
        return endA - endB;
      }
      case "hold": {
        // Window start year ascending
        const startA = windowA.start ?? Infinity;
        const startB = windowB.start ?? Infinity;
        return startA - startB;
      }
      default:
        return 0;
    }
  });
}

// ─── Grouping ────────────────────────────────────────────────

function groupWines(wines: Wine[], currentYear: number) {
  const groups: Record<ReportCategory, Wine[]> = {
    "drink-now": [],
    approaching: [],
    "past-peak": [],
    hold: [],
    unknown: [],
  };

  for (const wine of wines) {
    const { start, end } = parseDrinkWindow(wine.drinkWindow);
    if (start === null || end === null) {
      groups.unknown.push(wine);
    } else {
      const cat = categorizeDrinkWindow(wine, currentYear);
      groups[cat].push(wine);
    }
  }

  // Sort each group by urgency
  for (const cat of CATEGORY_ORDER) {
    groups[cat] = sortWinesForCategory(groups[cat], cat, currentYear);
  }

  return groups;
}

// ─── Component ───────────────────────────────────────────────

export function DrinkabilityReport({ wines, onWineClick }: DrinkabilityReportProps) {
  const currentYear = new Date().getFullYear();
  const groups = useMemo(() => groupWines(wines, currentYear), [wines, currentYear]);

  const [expanded, setExpanded] = useState<Record<ReportCategory, boolean>>({
    "past-peak": true,
    "drink-now": true,
    approaching: false,
    hold: false,
    unknown: false,
  });

  function toggleCategory(cat: ReportCategory) {
    setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  return (
    <div className="space-y-4">
      {/* ── Summary cards ────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CATEGORY_ORDER.map((cat) => {
          const config = CATEGORY_CONFIG[cat];
          const Icon = config.icon;
          const count = groups[cat].length;

          return (
            <Card
              key={cat}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md active:scale-[0.98]",
                expanded[cat] && count > 0 && "ring-1 ring-offset-1 dark:ring-offset-background"
              )}
              style={
                expanded[cat] && count > 0
                  ? ({ "--ring-color": config.color, borderColor: `${config.color}40` } as React.CSSProperties)
                  : undefined
              }
              onClick={() => count > 0 && toggleCategory(cat)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                      {config.label}
                    </p>
                    <p className="text-2xl font-bold mt-0.5" style={{ color: count > 0 ? config.color : undefined }}>
                      {count}
                    </p>
                  </div>
                  <div
                    className="p-1.5 rounded-lg shrink-0"
                    style={{ backgroundColor: `${config.color}15` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: config.color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Expandable sections ───────────────────────────── */}
      {CATEGORY_ORDER.map((cat) => {
        const config = CATEGORY_CONFIG[cat];
        const winesInCategory = groups[cat];
        if (winesInCategory.length === 0) return null;

        const isOpen = expanded[cat];
        const Chevron = isOpen ? ChevronDown : ChevronRight;

        return (
          <Card key={cat}>
            <CardContent className="p-0">
              {/* Section header */}
              <button
                type="button"
                className="flex w-full items-center gap-2.5 p-4 text-left hover:bg-muted/50 transition-colors rounded-t-lg"
                onClick={() => toggleCategory(cat)}
                aria-expanded={isOpen}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                <span className="font-semibold text-sm flex-1">
                  {config.label} ({winesInCategory.length})
                </span>
                <Chevron className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>

              {/* Wine list (grouped by identity) */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-2">
                  {groupWinesByIdentity(winesInCategory).map((group) => (
                    <ReportWineCard
                      key={group.groupKey}
                      wine={group.wine}
                      accent={config.color}
                      category={cat}
                      currentYear={currentYear}
                      onClick={onWineClick}
                      groupCount={group.count}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Wine Card ───────────────────────────────────────────────

function ReportWineCard({
  wine,
  accent,
  category,
  currentYear,
  onClick,
  groupCount,
}: {
  wine: Wine;
  accent: string;
  category: ReportCategory;
  currentYear: number;
  onClick?: (wine: Wine) => void;
  groupCount?: number;
}) {
  const typeColor = WINE_TYPE_COLORS[wine.type as WineType] || "#666";
  const typeLabel = WINE_TYPE_LABELS[wine.type as WineType] || wine.type;
  const { start, end } = parseDrinkWindow(wine.drinkWindow);

  // Urgency label
  let urgencyLabel = "";
  if (category === "past-peak" && end !== null) {
    const yearsOver = currentYear - end;
    urgencyLabel = yearsOver === 1 ? "1 year past" : `${yearsOver} years past`;
  } else if (category === "approaching" && start !== null) {
    const yearsUntil = start - currentYear;
    urgencyLabel = yearsUntil <= 0 ? "this year" : yearsUntil === 1 ? "1 year away" : `${yearsUntil} years away`;
  } else if (category === "drink-now" && end !== null) {
    const yearsLeft = end - currentYear;
    urgencyLabel = yearsLeft === 0 ? "last year in window" : yearsLeft === 1 ? "1 year left" : `${yearsLeft} years left`;
  } else if (category === "hold" && start !== null) {
    const yearsUntil = start - currentYear;
    urgencyLabel = `opens in ${yearsUntil} ${yearsUntil === 1 ? "year" : "years"}`;
  }

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 transition-all",
        onClick
          ? "cursor-pointer hover:shadow-md hover:border-primary/30 active:scale-[0.99]"
          : "hover:shadow-sm"
      )}
      onClick={onClick ? () => onClick(wine) : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(wine);
              }
            }
          : undefined
      }
    >
      {/* Left accent bar */}
      <div
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: accent }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium leading-tight truncate">
            {wine.name}
            {groupCount != null && groupCount > 1 && (
              <span className="ml-1.5 inline-flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0 leading-4">
                &times;{groupCount}
              </span>
            )}
          </p>
          {/* Wine type badge */}
          <Badge
            variant="outline"
            className="text-[10px] h-4 px-1.5 shrink-0"
            style={{
              borderColor: `${typeColor}60`,
              color: typeColor,
              backgroundColor: `${typeColor}10`,
            }}
          >
            {typeLabel}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {wine.winery && <span className="truncate">{wine.winery}</span>}
          {wine.vintage && (
            <>
              <span className="text-border">|</span>
              <span>{wine.vintage}</span>
            </>
          )}
          {wine.grapeVariety && (
            <>
              <span className="text-border">|</span>
              <span className="truncate">{wine.grapeVariety}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Drink window */}
          {wine.drinkWindow && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: `${accent}15`, color: accent }}
            >
              <Clock className="h-2.5 w-2.5" />
              {wine.drinkWindow}
            </span>
          )}
          {/* Urgency */}
          {urgencyLabel && (
            <span className="text-[10px] text-muted-foreground italic">
              {urgencyLabel}
            </span>
          )}
        </div>
      </div>

      {/* Chevron hint */}
      {onClick && (
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
      )}
    </div>
  );
}
