"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, Loader2, Wine as WineIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTier } from "@/hooks/use-tier";
import { useUpgradePopup } from "@/components/tier/upgrade-prompt";
import { aiSearchWineSuggestions } from "@/server/actions/ai";
import type { WineSuggestion } from "@/lib/ai";
import { WINE_TYPE_COLORS } from "@/types/constants";

interface WineNameAutocompleteProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  /** Fired when the user picks a suggestion — receives the full candidate
   * so the form can fill winery/vintage/region/etc. in one go. */
  onPickSuggestion?: (s: WineSuggestion) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** Disable the inline tier-gate hint (e.g. when the form already has a
   * separate AI Search button). Defaults to false. */
  hideUpgradeHint?: boolean;
}

const DEBOUNCE_MS = 150;
const MIN_QUERY = 2;

/**
 * Wine name input with AI-powered autocomplete. Typing triggers a debounced
 * search; picking a result calls `onPickSuggestion` so the parent form can
 * pre-fill related fields. Free-tier users see a lock icon that opens the
 * upgrade popup instead of firing AI requests.
 */
export function WineNameAutocomplete({
  id,
  value,
  onChange,
  onPickSuggestion,
  placeholder,
  autoFocus,
  className,
  hideUpgradeHint,
}: WineNameAutocompleteProps) {
  const { hasAI, tierHasAI, userId } = useTier();
  const { showUpgrade, popup } = useUpgradePopup();
  // Only show the upgrade lock icon to users whose tier can't access AI
  // at all. Users who've toggled AI off don't need an upgrade prompt —
  // the input just works as a plain text field.
  const showUpgradeLock = !hasAI && !tierHasAI;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<WineSuggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);

  // Abort + debounce handle for in-flight requests
  const timerRef = useRef<number | null>(null);
  const abortCounterRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const onDocPointer = (e: PointerEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, []);

  // Debounced search
  const runSearch = useCallback(
    async (query: string) => {
      const myGen = ++abortCounterRef.current;
      const trimmed = query.trim();
      if (trimmed.length < MIN_QUERY) {
        setSuggestions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await aiSearchWineSuggestions(trimmed, userId ?? undefined);
        // Ignore stale responses if the user kept typing
        if (abortCounterRef.current !== myGen) return;
        if (res.success) {
          setSuggestions(res.data.suggestions ?? []);
          setActiveIdx(-1);
        } else {
          setSuggestions([]);
        }
      } catch {
        if (abortCounterRef.current === myGen) setSuggestions([]);
      } finally {
        if (abortCounterRef.current === myGen) setLoading(false);
      }
    },
    [userId]
  );

  const scheduleSearch = useCallback(
    (query: string) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => runSearch(query), DEBOUNCE_MS);
    },
    [runSearch]
  );

  const handleChange = (v: string) => {
    onChange(v);
    if (!hasAI) return; // free tier — just type, no autocomplete
    setOpen(true);
    scheduleSearch(v);
  };

  const pickSuggestion = (s: WineSuggestion) => {
    onChange(s.name);
    onPickSuggestion?.(s);
    setOpen(false);
    setSuggestions([]);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      pickSuggestion(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Clean up timer on unmount
  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    []
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => hasAI && value.trim().length >= MIN_QUERY && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={id ? `${id}-suggestions` : undefined}
          aria-autocomplete="list"
          className="pr-8"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {hasAI && loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : showUpgradeLock && !hideUpgradeHint ? (
            <button
              type="button"
              onClick={() => showUpgrade("AI wine search")}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="AI search — Cellar+ feature"
              aria-label="Upgrade to enable AI wine search"
            >
              <Lock className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {hasAI && open && suggestions.length > 0 && (
        <ul
          id={id ? `${id}-suggestions` : undefined}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg max-h-80 overflow-y-auto"
        >
          {suggestions.map((s, i) => {
            const active = i === activeIdx;
            const typeColor = WINE_TYPE_COLORS[s.type] ?? "#888";
            return (
              <li
                key={`${s.name}-${s.winery}-${i}`}
                role="option"
                aria-selected={active}
                className={cn(
                  "flex items-start gap-2 px-3 py-2 text-sm cursor-pointer",
                  active ? "bg-accent" : "hover:bg-accent/60"
                )}
                onPointerDown={(e) => {
                  // pointerdown, not click — avoids the input losing focus
                  // before we process the selection.
                  e.preventDefault();
                  pickSuggestion(s);
                }}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span
                  className="shrink-0 w-2.5 h-2.5 rounded-full mt-1.5"
                  style={{ backgroundColor: typeColor }}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.winery}
                    {s.vintage ? ` \u00B7 ${s.vintage}` : ""}
                    {s.region ? ` \u00B7 ${s.region}` : ""}
                    {s.country && s.region !== s.country ? `, ${s.country}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasAI && open && !loading && value.trim().length >= MIN_QUERY && suggestions.length === 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-sm px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <WineIcon className="h-3.5 w-3.5 shrink-0" />
          No matches — keep typing or pick fields manually
        </div>
      )}

      {popup}
    </div>
  );
}
