"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  ArrowRight,
  Hand,
  Check,
  X,
  Sparkles,
  ChevronLeft,
  PartyPopper,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Wine, Cabinet, Wall } from "@/types/wine";
import type { HighlightSlot } from "@/components/cellar/cabinet-grid-types";
import {
  buildSortPlan,
  buildRackByRackPlan,
  schemeLabel,
  type SortScheme,
  type SlotPos,
  type SortMove,
} from "@/lib/cellar/sort-plan";
import { WINE_TYPE_COLORS, BOTTLE_SIZE_SHORT } from "@/types/constants";
import { cn } from "@/lib/utils";

interface SortAssistantProps {
  /** All wines / cabinets / walls (the assistant scopes them itself). */
  wines: Wine[];
  cabinets: Cabinet[];
  walls: Wall[];
  /** Current wall — scope defaults to "this wall". */
  selectedWallId: string | null;
  /** Apply one move: dest=null means set the bottle aside (unfile). */
  onApplyMove: (wineId: string, dest: SlotPos | null) => Promise<void>;
  /** Persistently glow a source bottle + destination empty slot. */
  onHighlight: (wineId: string | null, slot: HighlightSlot | null) => void;
  onClearHighlight: () => void;
  /** Bring a wall on-screen so its glow is visible. */
  onSelectWall: (wallId: string) => void;
  onClose: () => void;
}

const SCHEMES: SortScheme[] = [
  "type-region-varietal",
  "region-varietal",
  "varietal-region",
  "drink-window",
  "vintage",
  "rating",
];

/**
 * Mini end-state preview: one small grid per cabinet showing where every
 * bottle will END UP under the current plan, colored by wine type. Slots
 * whose occupant changes get a bright ring (the "future locations"); the
 * legend explains both. Storage (bulk/box) rows render as muted bands.
 */
function PlanPreview({
  plan,
  wines,
  cabinets,
  cabName,
}: {
  plan: ReturnType<typeof buildSortPlan>;
  wines: Wine[];
  cabinets: Cabinet[];
  cabName: Map<string, string>;
}) {
  const wineById = useMemo(() => new Map(wines.map((w) => [w.id, w])), [wines]);

  // slotKey → wineId in the PROPOSED layout, and the set of slots that change.
  const { finalAt, changedKeys } = useMemo(() => {
    const finalAt = new Map<string, string>();
    const changedKeys = new Set<string>();
    for (const a of plan.assignments) {
      const k = `${a.slot.cabinetId}:${a.slot.row}:${a.slot.col}`;
      finalAt.set(k, a.wineId);
      const w = wineById.get(a.wineId);
      if (!w || w.cabinetId !== a.slot.cabinetId || w.row !== a.slot.row || w.col !== a.slot.col) {
        changedKeys.add(k);
      }
    }
    return { finalAt, changedKeys };
  }, [plan.assignments, wineById]);

  const cabsWithSlots = cabinets.filter((c) =>
    plan.assignments.some((a) => a.slot.cabinetId === c.id)
  );

  return (
    <div className="space-y-2 max-h-56 overflow-y-auto rounded-lg border border-border/60 p-2">
      {cabsWithSlots.map((cab) => {
        const storageRows = new Set((cab.storageRows ?? []).map((sr) => sr.row));
        return (
          <div key={cab.id}>
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">
              {cabName.get(cab.id) ?? "Section"}
            </p>
            <div className="space-y-0.5">
              {Array.from({ length: cab.rows }, (_, r) => (
                <div key={r} className="flex gap-0.5">
                  {storageRows.has(r) ? (
                    <div className="h-2.5 flex-1 rounded-sm bg-muted/60" />
                  ) : (
                    Array.from({ length: cab.cols }, (_, col) => {
                      const k = `${cab.id}:${r}:${col}`;
                      const wid = finalAt.get(k);
                      const w = wid ? wineById.get(wid) : undefined;
                      const color = w
                        ? WINE_TYPE_COLORS[w.type as keyof typeof WINE_TYPE_COLORS] || "#666"
                        : undefined;
                      return (
                        <div
                          key={col}
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            !w && "bg-muted/40",
                            changedKeys.has(k) &&
                              "ring-1 ring-amber-500 ring-offset-1 ring-offset-background"
                          )}
                          style={color ? { backgroundColor: color } : undefined}
                          title={w ? `${w.name}${w.vintage ? ` ${w.vintage}` : ""}` : "empty"}
                        />
                      );
                    })
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-[10px] text-muted-foreground">
        Dots = bottles in their final spots (colored by type) ·{" "}
        <span className="text-amber-600 dark:text-amber-400">ringed</span> = bottle moves there
      </p>
    </div>
  );
}

export function SortAssistant({
  wines,
  cabinets,
  walls,
  selectedWallId,
  onApplyMove,
  onHighlight,
  onClearHighlight,
  onSelectWall,
  onClose,
}: SortAssistantProps) {
  const [phase, setPhase] = useState<"config" | "running" | "done">("config");
  // Default to the full collection — the primary choice is "everything,
  // sorted together" vs "everything, rack by rack" (no cross-rack carries).
  const [scopeValue, setScopeValue] = useState<string>("all");
  const [scheme, setScheme] = useState<SortScheme>("type-region-varietal");
  const [runPlan, setRunPlan] = useState<ReturnType<typeof buildSortPlan> | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [applying, setApplying] = useState(false);
  // Conflicted bottles the user chose to set aside instead of leaving pinned.
  const [asideChoices, setAsideChoices] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);

  const cabName = useMemo(
    () => new Map(cabinets.map((c) => [c.id, c.name])),
    [cabinets]
  );
  const wallOfCab = useMemo(
    () => new Map(cabinets.map((c) => [c.id, c.wallId])),
    [cabinets]
  );

  // Scope → the set of cabinets it covers.
  const scopeCabinets = useCallback(
    (value: string): Cabinet[] => {
      if (value === "all") return cabinets;
      if (value.startsWith("wall:")) {
        const wid = value.slice(5);
        return cabinets.filter((c) => c.wallId === wid);
      }
      if (value.startsWith("cabinet:")) {
        const cid = value.slice(8);
        return cabinets.filter((c) => c.id === cid);
      }
      return cabinets;
    },
    [cabinets]
  );

  // Live preview plan in the config screen (recomputed as scope/scheme change).
  // "rack-by-rack" sorts every cabinet within itself (no cross-rack carries);
  // all other scopes sort their cabinets together as one sequence.
  const previewPlan = useMemo(() => {
    const params = {
      wines,
      cabinets: scopeCabinets(scopeValue),
      walls,
      scheme,
      setAsideWineIds: asideChoices,
    };
    return scopeValue === "rack-by-rack"
      ? buildRackByRackPlan(params)
      : buildSortPlan(params);
  }, [wines, scopeCabinets, scopeValue, walls, scheme, asideChoices]);

  // Reset conflict choices when the scope/scheme changes — the conflict set
  // itself changes with them.
  useEffect(() => {
    setAsideChoices(new Set());
  }, [scopeValue, scheme]);

  const scopeOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      // The two primary choices lead: everything at once, or rack by rack.
      { value: "all", label: "Full collection — sorted together" },
      { value: "rack-by-rack", label: "Full collection — rack by rack" },
    ];
    const currentWall = walls.find((w) => w.id === selectedWallId);
    if (currentWall) {
      opts.push({ value: `wall:${currentWall.id}`, label: `This wall — ${currentWall.name}` });
      for (const c of cabinets.filter((c) => c.wallId === currentWall.id)) {
        opts.push({ value: `cabinet:${c.id}`, label: `Just: ${c.name}` });
      }
    }
    return opts;
  }, [walls, cabinets, selectedWallId]);

  const slotLabel = useCallback(
    (pos: SlotPos | "table"): string => {
      if (pos === "table") return "the table";
      return `${cabName.get(pos.cabinetId) ?? "rack"} · Row ${pos.row + 1}, Col ${pos.col + 1}`;
    },
    [cabName]
  );

  // ── Per-step highlight: glow the bottle + its destination, focus the wall ──
  useEffect(() => {
    if (phase !== "running" || !runPlan) return;
    const move = runPlan.moves[stepIndex];
    if (!move) return;
    const dest = move.to === "table" ? null : move.to;
    const focusCab =
      dest?.cabinetId ?? (move.from !== "table" ? move.from.cabinetId : null);
    if (focusCab) {
      const wid = wallOfCab.get(focusCab);
      if (wid) onSelectWall(wid);
    }
    onHighlight(move.wineId, dest);
  }, [phase, stepIndex, runPlan, wallOfCab, onHighlight, onSelectWall]);

  // Clear the glow when the assistant unmounts.
  useEffect(() => onClearHighlight, [onClearHighlight]);

  const start = () => {
    setRunPlan(previewPlan);
    setStepIndex(0);
    setPhase(previewPlan.moves.length === 0 ? "done" : "running");
  };

  const handleClose = () => {
    onClearHighlight();
    onClose();
  };

  const doNext = async () => {
    if (!runPlan) return;
    const move = runPlan.moves[stepIndex];
    setApplying(true);
    try {
      await onApplyMove(move.wineId, move.to === "table" ? null : move.to);
      const next = stepIndex + 1;
      if (next >= runPlan.moves.length) {
        onClearHighlight();
        setPhase("done");
      } else {
        setStepIndex(next);
      }
    } finally {
      setApplying(false);
    }
  };

  // Per-move fallback: unfile the bottle instead of placing it. Its planned
  // destination simply stays empty — no other move depends on it.
  const skipToTable = async () => {
    if (!runPlan) return;
    const move = runPlan.moves[stepIndex];
    setApplying(true);
    try {
      await onApplyMove(move.wineId, null);
      const next = stepIndex + 1;
      if (next >= runPlan.moves.length) {
        onClearHighlight();
        setPhase("done");
      } else {
        setStepIndex(next);
      }
    } finally {
      setApplying(false);
    }
  };

  const goBack = async () => {
    if (!runPlan || stepIndex === 0) return;
    const prev = stepIndex - 1;
    const move = runPlan.moves[prev];
    setApplying(true);
    try {
      // Invert the previous move: send the bottle back where it came from.
      await onApplyMove(move.wineId, move.from === "table" ? null : move.from);
      setStepIndex(prev);
    } finally {
      setApplying(false);
    }
  };

  const currentMove: SortMove | null =
    phase === "running" && runPlan ? runPlan.moves[stepIndex] : null;

  return (
    <div className="fixed inset-x-0 bottom-[4.5rem] md:bottom-6 z-50 flex justify-center px-3 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-background/95 backdrop-blur shadow-2xl shadow-black/40 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Sort Assistant
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {phase === "config" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              I&apos;ll group your bottles into tidy blocks and walk you through
              moving them one at a time — the destination slot lights up as you go.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">What to sort</label>
              <select
                value={scopeValue}
                onChange={(e) => setScopeValue(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
              >
                {scopeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Group by</label>
              <select
                value={scheme}
                onChange={(e) => setScheme(e.target.value as SortScheme)}
                className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
              >
                {SCHEMES.map((s) => (
                  <option key={s} value={s}>
                    {schemeLabel(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
              {previewPlan.bottleCount === 0 ? (
                <span className="text-muted-foreground">No sortable bottles in this scope.</span>
              ) : previewPlan.moves.length === 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Already sorted! 🎉 {previewPlan.bottleCount} bottles in order.
                </span>
              ) : (
                <span>
                  <span className="font-medium text-foreground">{previewPlan.bottleCount}</span>{" "}
                  bottles · about{" "}
                  <span className="font-medium text-foreground">{previewPlan.moves.length}</span>{" "}
                  moves
                </span>
              )}
            </div>

            {/* Size conflicts: bottles with no compatible slot. Default =
                leave in place; the user can set individual ones aside. */}
            {previewPlan.conflicts.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 space-y-2">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  {previewPlan.conflicts.length}{" "}
                  {previewPlan.conflicts.length === 1 ? "bottle doesn't" : "bottles don't"} fit
                  any available slot
                </p>
                {previewPlan.conflicts.map((c) => (
                  <div key={c.wineId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">
                      {c.wineName}
                      {c.wineVintage ? ` ${c.wineVintage}` : ""}
                      <span className="ml-1 text-muted-foreground">
                        ({BOTTLE_SIZE_SHORT[c.bottleSize] ?? c.bottleSize})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAsideChoices((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.wineId)) next.delete(c.wineId);
                          else next.add(c.wineId);
                          return next;
                        })
                      }
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                        asideChoices.has(c.wineId)
                          ? "border-amber-500 bg-amber-500/20 text-amber-700 dark:text-amber-300"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {asideChoices.has(c.wineId) ? "Will set aside" : "Stays in place"}
                    </button>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground">
                  Tap to toggle: leave the bottle where it is, or set it aside to
                  Unfiled and free its slot. Mark bigger rows in the section&apos;s
                  row settings to give large bottles more homes.
                </p>
              </div>
            )}

            {/* Proposed end-state preview: per-cabinet mini grid, colored by
                wine type; slots whose occupant CHANGES get a bright ring. */}
            {previewPlan.bottleCount > 0 && (
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="w-full text-left text-xs font-medium text-primary hover:underline"
              >
                {showPreview ? "Hide" : "Show"} proposed arrangement
              </button>
            )}
            {showPreview && (
              <PlanPreview
                plan={previewPlan}
                wines={wines}
                cabinets={scopeCabinets(scopeValue)}
                cabName={cabName}
              />
            )}

            <Button
              className="w-full"
              onClick={start}
              disabled={previewPlan.moves.length === 0}
            >
              Start sorting
            </Button>
          </div>
        )}

        {phase === "running" && currentMove && runPlan && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Step {stepIndex + 1} of {runPlan.moves.length}
              </span>
              <span>{schemeLabel(runPlan.scheme)}</span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(stepIndex / runPlan.moves.length) * 100}%` }}
              />
            </div>

            {currentMove.kind === "place" ? (
              <div className="space-y-2">
                <p className="text-sm">
                  <Hand className="inline h-4 w-4 mr-1 text-primary align-text-bottom" />
                  Move{" "}
                  <span className="font-semibold">{currentMove.wineName}</span>
                  {currentMove.wineVintage ? ` ${currentMove.wineVintage}` : ""} to the{" "}
                  <span className="font-semibold text-[#ca8a04] dark:text-[#facc15]">glowing slot</span>.
                </p>
                <div className="flex items-center gap-2 text-xs rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-muted-foreground">{slotLabel(currentMove.from)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-medium text-foreground">{slotLabel(currentMove.to)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm">
                  <Hand className="inline h-4 w-4 mr-1 text-amber-500 align-text-bottom" />
                  Take{" "}
                  <span className="font-semibold">{currentMove.wineName}</span>
                  {currentMove.wineVintage ? ` ${currentMove.wineVintage}` : ""} out and rest it on
                  the table — we&apos;ll place it in a moment.
                </p>
                <div className="text-xs rounded-lg bg-muted/50 px-3 py-2 text-muted-foreground">
                  Currently at {slotLabel(currentMove.from)}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goBack}
                disabled={applying || stepIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button className="flex-1" onClick={doNext} disabled={applying}>
                {applying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {currentMove.kind === "place" ? "Done — next" : "Set aside — next"}
                  </>
                )}
              </Button>
            </div>
            {/* Escape hatch: if the physical move doesn't work out (bottle
                won't fit, slot obstructed…) set the bottle aside instead —
                always valid, and the rest of the plan is unaffected because
                every other move targets a different slot. */}
            {currentMove.kind === "place" && (
              <button
                onClick={skipToTable}
                disabled={applying}
                className="w-full text-center text-xs text-amber-600 dark:text-amber-400 hover:underline"
              >
                Can&apos;t make this move? Set the bottle aside instead
              </button>
            )}
            <button
              onClick={handleClose}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Finish later
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-3 text-center py-2">
            <PartyPopper className="h-8 w-8 mx-auto text-primary" />
            <p className="text-sm font-medium">
              {runPlan && runPlan.moves.length > 0
                ? "All sorted! Your bottles are grouped and tidy."
                : "Already sorted — nothing to move!"}
            </p>
            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
