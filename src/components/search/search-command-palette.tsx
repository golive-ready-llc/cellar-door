"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, X } from "lucide-react";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";


import { useSearch } from "./search-provider";
import { fetchWines, fetchCabinets } from "@/lib/data";
import { WINE_TYPE_COLORS } from "@/types/constants";
import { useAuth } from "@/components/auth-provider";
import type { Wine, WineType } from "@/types/wine";

interface SearchResult {
  wine: Wine;
  cabinetName: string | null;
}

export function SearchCommandPalette() {
  const { userId } = useAuth();
  const { open, setOpen } = useSearch();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [wines, setWines] = useState<Wine[]>([]);
  const [cabinetMap, setCabinetMap] = useState<Map<string, string>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const resultsListId = "search-results-list";

  // Lazy-load wines + cabinets on first open
  useEffect(() => {
    if (open && !loaded) {
      Promise.all([fetchWines(userId), fetchCabinets(userId)]).then(
        ([wineData, cabinetData]) => {
          setWines(wineData);
          const map = new Map<string, string>();
          for (const c of cabinetData) {
            map.set(c.id, c.name);
          }
          setCabinetMap(map);
          setLoaded(true);
        }
      );
    }
  }, [open, loaded, userId]);

  // Reset query when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      // Small delay so the dialog animation completes
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Search logic: AND across all tokens
  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];

    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const matched = wines.filter((wine) => {
      const searchable = [
        wine.name,
        wine.winery,
        wine.region,
        wine.country,
        wine.grapeVariety,
        wine.vintage?.toString() ?? "",
        wine.type,
        ...(wine.tags || []),
      ]
        .join(" ")
        .toLowerCase();

      return tokens.every((token) => searchable.includes(token));
    });

    return matched.slice(0, 20).map((wine) => ({
      wine,
      cabinetName: wine.cabinetId ? cabinetMap.get(wine.cabinetId) ?? null : null,
    }));
  }, [query, wines, cabinetMap]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length, query]);

  const navigateToWine = useCallback(
    (wine: Wine) => {
      setOpen(false);
      router.push(`/cellar?wine=${wine.id}`);
    },
    [setOpen, router]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        navigateToWine(results[selectedIndex].wine);
      }
    },
    [results, selectedIndex, navigateToWine]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className="fixed top-[15%] left-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-xl bg-background text-sm ring-1 ring-foreground/10 shadow-xl outline-none overflow-hidden sm:max-w-lg data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          {/* Search input */}
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls={resultsListId}
              aria-activedescendant={
                results.length > 0 ? `search-result-${results[selectedIndex].wine.id}` : undefined
              }
              autoComplete="off"
              type="text"
              placeholder="Search wines…"
              className="flex-1 h-11 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div
            role="listbox"
            id={resultsListId}
            className="max-h-80 overflow-y-auto p-1.5"
          >
            {!loaded && query.trim() && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Loading wines…
              </p>
            )}

            {loaded && query.trim() && results.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No wines found for &ldquo;{query}&rdquo;
              </p>
            )}

            {!query.trim() && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Type to search across all wines
              </p>
            )}

            {results.map((result, idx) => {
              const { wine, cabinetName } = result;
              const typeColor =
                WINE_TYPE_COLORS[wine.type as WineType] || "#666";
              const isSelected = idx === selectedIndex;

              return (
                <button
                  key={wine.id}
                  role="option"
                  aria-selected={isSelected}
                  id={`search-result-${wine.id}`}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors ${
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => navigateToWine(wine)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  {/* Type dot */}
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: typeColor }}
                  />

                  {/* Wine info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{wine.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {wine.winery}
                      {wine.vintage ? ` · ${wine.vintage}` : ""}
                      {wine.grapeVariety ? ` · ${wine.grapeVariety}` : ""}
                    </p>
                  </div>

                  {/* Location badge */}
                  <div className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="max-w-20 truncate">
                      {cabinetName ?? "Unfiled"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer with wine count */}
          {loaded && (
            <div className="border-t px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
              <span aria-live="polite">{wines.length} wines indexed</span>
              <div className="flex items-center gap-2">
                <span>↑↓ navigate</span>
                <span>↵ open</span>
                <span>esc close</span>
              </div>
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
