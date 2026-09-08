# Spec: Device bug round — move mode, quantity/vintage, Discover/IA

## Goal

Fix the six issues reported from on-device testing, verified by diagnosis (not
guesswork) against the actual code. Each has a confirmed root cause below.
Ship them to production, gated by the standard sequence (tsc → lint → tests →
build), with tests pinning the behavior that can be tested headlessly.

## Inputs — confirmed root causes

| # | Report | Root cause (verified in code) |
|---|---|---|
| 1 | Can't tap a wine for details in Move Mode | `wine-slot.tsx:256` — when `editable`, ONLY `onPointerDown`/`onContextMenu` are attached; no `onClick`. `useTouchDrag` does accept `onTap`, but it only fires if the pointer never exceeds `SCROLL_THRESHOLD` (10px). A normal finger tap drifts >10px → `handleWindowPointerMove` calls `cleanup()` and removes the pointerup listener, so `onTap` never fires. |
| 2 | Must wiggle finger at edge to keep scrolling while dragging | `use-touch-drag.ts:192` installs a `touchmove` `preventDefault` during drag (kills native scroll), and edge auto-scroll speed is only recomputed inside `updateDragPosition` — i.e. on pointer *movement*. Holding still at the edge → no events → `setSpeed` never refreshed. Edge zone is also small (`EDGE_ZONE = 70px`) relative to a tall phone screen. |
| 3 | Invoice scan didn't pick up quantity | `wineListVisionExtractPrompt()` never asks for quantity — the JSON schema has no `quantity` field. Receipts/invoices print "2 × Wine" but it's discarded. |
| 4 | Invoice scan didn't pick up vintage / no vintage field visible | The prompt DOES request `vintage`, and the receipt review row renders it (`add-wine-form-sections.tsx:751`) — but only when non-null, and there is no way to correct a missed vintage. Stage-1 vision extraction misses it on cramped invoices; user has no fallback. |
| 5 | No quantity option when adding a wine (any method) | `useAddWineForm` has no quantity state; `WineForm` has no quantity input. Duplicate-after-add exists but is a separate flow. |
| 6 | Discover slow to open; prefer Stats in the nav; can't find batch AI scan | Discover fires `aiSearchWineSuggestions` for "matches for you" on mount (blocking, no cache) → multi-second empty skeletons. `BulkEnrichDialog` is mounted ONLY in `inventory-header.tsx`, which is now buried under Profile → Inventory since the 5-tab nav change. |

## What to build

**P0 — Move Mode (issues 1 & 2)**
1. **Tap-through in move mode**: make tap detection robust — track whether a
   real drag started; on pointerup without an active drag, fire `onTap` even if
   the pointer drifted. Keep the scroll-cancel behavior for *drag initiation*,
   but do not let drift destroy a tap.
2. **Edge auto-scroll while stationary**: keep the auto-scroll rAF loop fed
   from the *last known pointer position* rather than only on movement, and
   widen the edge zone for touch. Dragging near the top/bottom must scroll
   continuously with the finger held still.

**P1 — Quantity & vintage (issues 3, 4, 5)**
3. **Extract quantity** from invoices: add `quantity` to the vision prompt
   schema and to the extraction result type; default 1 when absent.
4. **Quantity in the add form**: add a quantity field to `useAddWineForm` +
   `WineForm` (default 1). On submit, add N bottles (reuse the existing
   duplicate/`skipDuplicateCheck` path so slot logic is untouched).
5. **Editable vintage on receipt review**: surface vintage per row in the
   receipt/invoice review list and allow correcting it before adding, so a
   missed vintage is fixable in-flow.
6. Receipt submit honors extracted `quantity` (adds N of that wine).

**P2 — Navigation & discoverability (issue 6)**
7. **Swap Discover → Stats in the bottom nav** (Cellar · Stats · Scan ·
   Activity · Profile). Discover moves under Profile so nothing is lost.
8. **Make Discover cheap on open**: don't auto-fire the AI matches request on
   mount — render instantly, load matches lazily/on demand, and show the
   skeletons only while an actual request is in flight.
9. **Surface batch AI enrich**: expose the existing `BulkEnrichDialog` from a
   findable place (Profile hub entry and/or Cellar tools), not only the
   Inventory header.

## Rules / constraints

- No new dependencies; existing stack and patterns only.
- Adding N bottles must reuse the proven add path — do not fork slot/duplicate
  logic.
- Prompt changes must stay minimal-schema (the two-stage extraction exists
  because rich vision schemas caused refusals — do not re-bloat stage 1).
- Nav change must not orphan any surface (Discover stays reachable).
- Preserve tier gating and the perf/caching work.

## Work until done — validate

- Standard gate sequence after each batch: `tsc --noEmit` → `npm run lint`
  (0 errors) → `npm test` → `npx next build`.
- Add/extend tests for what's testable headlessly: quantity threading through
  the add form, receipt quantity/vintage handling, nav contents.
- Runtime smoke on `/demo` for the changed surfaces.
- Explicitly flag what needs on-device confirmation (touch drag, camera).

## Definition of done

1. Tapping a wine in Move Mode opens its detail (tap survives finger drift).
2. Dragging near the top/bottom edge scrolls continuously with the finger
   held still.
3. Invoice/receipt extraction captures quantity; the review list shows it.
4. Vintage is visible and correctable per row in the receipt review.
5. The add-wine form has a quantity field (default 1) that adds N bottles.
6. Bottom nav shows Stats instead of Discover; Discover reachable via Profile.
7. Discover renders immediately on open (no blocking AI call on mount).
8. Batch AI enrich is reachable from a findable location.
9. tsc, lint (0 errors), full test suite, and build all pass; new tests added.
10. Shipped to master, production deploy READY, with an honest list of what
    still needs device verification.
