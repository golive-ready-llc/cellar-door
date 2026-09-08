"use client";

import { CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { BulkEnrichDialog } from "@/components/wine/bulk-enrich-dialog";
import type { Wine } from "@/types/wine";

interface InventoryHeaderProps {
  wines: Wine[];
  filteredCount: number;
  totalValue: number;
  /** Sum of price across the currently-filtered wines (type/tag/search). */
  filteredValue?: number;
  /** Whether any filter is active (so we show filtered value instead of total). */
  isFiltered?: boolean;
  formatPrice: (amount: number, decimals?: number) => string;
  selectMode: boolean;
  onToggleSelectMode: () => void;
  onEditWine: (id: string, updates: Partial<Wine>) => Promise<void>;
  uniqueWineCount?: number;
}

export function InventoryHeader({
  wines,
  filteredCount,
  totalValue,
  filteredValue,
  isFiltered,
  formatPrice,
  selectMode,
  onToggleSelectMode,
  onEditWine,
  uniqueWineCount,
}: InventoryHeaderProps) {
  // When a filter is active, show the filtered subset's value; otherwise show total.
  const displayValue = isFiltered && filteredValue != null ? filteredValue : totalValue;
  return (
    <div className="space-y-3">
      <PageHeader
        title="Inventory"
        subtitle={
          <div className="flex items-center gap-3">
            <span>
              {filteredCount} of <strong>{wines.length}</strong> wines
              {uniqueWineCount != null && uniqueWineCount < wines.length && (
                <> ({uniqueWineCount} unique)</>
              )}
            </span>
            {displayValue > 0 && (
              <span>
                Value: <strong>{formatPrice(displayValue)}</strong>
              </span>
            )}
          </div>
        }
      />
      <div className="flex items-center gap-2 flex-wrap">
        {wines.length > 1 && (
          <Button
            variant={selectMode ? "secondary" : "outline"}
            size="sm"
            onClick={onToggleSelectMode}
            className="text-xs gap-1.5"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {selectMode ? "Cancel" : "Select"}
          </Button>
        )}
        {wines.length > 0 && (
          <BulkEnrichDialog
            wines={wines}
            onUpdate={async (id, updates) => {
              await onEditWine(id, updates);
            }}
          />
        )}
      </div>
    </div>
  );
}
