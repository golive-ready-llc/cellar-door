"use client";

import { Search, ArrowUpDown, LayoutGrid, List, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SortKey, SortDirection, ViewMode } from "@/lib/inventory-utils";

interface InventoryToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortKey: SortKey;
  sortDir: SortDirection;
  onSort: (key: SortKey) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

function SortButton({
  label,
  sortKey,
  currentKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentKey === sortKey;
  return (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      size="sm"
      onClick={() => onSort(sortKey)}
      className="text-xs"
    >
      {label}
      {isActive && (
        <ArrowUpDown
          className={`ml-1 h-3 w-3 ${dir === "desc" ? "rotate-180" : ""}`}
        />
      )}
    </Button>
  );
}

export function InventoryToolbar({
  searchQuery,
  onSearchChange,
  sortKey,
  sortDir,
  onSort,
  viewMode,
  onViewModeChange,
}: InventoryToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search wines, wineries, grapes, regions..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      {/* On mobile (<sm) the row was overflowing the viewport — sort buttons +
          view toggle didn't fit on one line. Allow wrapping and keep the view
          toggle pinned to the right of whatever line it ends up on. */}
      <div className="flex flex-wrap gap-1 items-center">
        <SortButton label="Name" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={onSort} />
        <SortButton label="Vintage" sortKey="vintage" currentKey={sortKey} dir={sortDir} onSort={onSort} />
        <SortButton label="Price" sortKey="price" currentKey={sortKey} dir={sortDir} onSort={onSort} />
        <SortButton label="Rating" sortKey="rating" currentKey={sortKey} dir={sortDir} onSort={onSort} />

        {/* View toggle */}
        <div className="ml-auto sm:ml-2 flex border border-border rounded-md overflow-hidden">
          <button
            onClick={() => onViewModeChange("grid")}
            className={cn(
              "p-1.5 transition-colors",
              viewMode === "grid"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className={cn(
              "p-1.5 transition-colors",
              viewMode === "list"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => onViewModeChange("gallery")}
            className={cn(
              "p-1.5 transition-colors",
              viewMode === "gallery"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
            title="Label Gallery"
          >
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
