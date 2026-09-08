# Spec: Cellar Door UI consistency — one design system, applied everywhere

## Goal

Make Cellar Door look and behave like **one app**, not a dozen screens built
by a dozen people. Today the same concepts — a wine row, a detail view, a
primary button — are re-implemented per screen with drifting padding, sizes,
typography, and layout. This spec converges them onto **shared components and a
single set of tokens**, so every list item, detail view, and button is the same
everywhere unless there's a real reason to differ.

Same framework as the prior specs: benchmark → gap-analyze → build → verify →
prove done. This one is about *consistency*, not new features or new visuals.

## What "consistent" means here

1. **One component per concept.** A wine appears in a list the same way on every
   screen — same component, same props, same anatomy.
2. **One detail shell.** Every wine/bottle detail shares the same header
   hierarchy, the same community block, the same action layout.
3. **One button language.** Primary actions live in the same place, at the same
   size, with the same hierarchy, on every screen.
4. **Tokens, not magic numbers.** Padding, radius, gaps, avatar sizes, and type
   come from the shared scale — no ad-hoc `p-2`/`p-4`/`rounded-xl` per screen.
5. **Predictable layout.** Page headers, empty states, loading states, and
   spacing rhythm are identical across surfaces.

Non-goal: changing *what* each screen does. This is convergence and cleanup —
behavior and data stay identical. No new framework.

## Benchmarks (why consistency is the bar)

The leaders win partly because they're rigidly consistent — a wine row in
**Vivino** or **Delectable** is the same row everywhere, and their detail pages
share one template. **CellarTracker** is the counter-example again: its screens
feel assembled ad hoc. Cross-category, **Apple HIG** and **Material** both make
the same point — a finite component set, applied uniformly, *is* the polish.

## Inputs — where Cellar Door is inconsistent today

**Wine "row"/card — 6 bespoke implementations of the same idea:**
- `components/inventory/wine-list-item.tsx`
- `components/inventory/wine-grid-item.tsx`
- `ResultCard` (inline in `app/(app)/discover/page.tsx`)
- `HistoryCard` (inline in `app/(app)/history/page.tsx`)
- the event card (inline in `app/(app)/activity/page.tsx`)
- `RatingCard` (inline in `components/community/community-score.tsx`)

Each picks its own padding (`p-2`/`p-3`/`p-4`), avatar size (`w-10`/`w-11`/
`w-24`), radius, title size, badge placement, and rating display.

**Detail views — 3 dialogs, duplicated + diverging:**
- `wine/wine-detail-dialog.tsx`, `wine/history-detail-dialog.tsx`,
  `wine/buy-list-detail-dialog.tsx`
- The CD-Score block is copy-pasted across all three (the `cdScore != null &&
  cdRatingCount > 0 ? <CdScoreBadge> : "–"` pattern lives in each). Headers and
  action rows differ screen to screen.

**Buttons:** action grids mix `h-11`/`h-12`; icon buttons range `h-6`/`h-7`/
`h-8`; primary-action placement varies (top vs inline vs bottom); some primary
actions are full-width, some not.

**Foundations that already exist (use these — the convergence targets):**
- Type scale + `surface-elevated` + `press` + radius scale → `app/globals.css`
- `EmptyState` → `components/ui/empty-state.tsx`
- `StarRating` / `RatingDistribution` → `components/ui/star-rating.tsx`
- shadcn primitives → `components/ui/`

## Gap analysis (concept → standard → today → work)

| Concept | Standard | Today | Work |
|---|---|---|---|
| Wine list/grid row | One `WineListItem` (variants: list / grid / compact) | 6 bespoke versions | Build it; replace all 6 |
| Detail view | One `WineDetailShell` + shared sections | 3 dialogs, duplicated CD block | Extract shared shell/sections; all 3 consume them |
| CD-Score block | One shared component | Copy-pasted in 3 files | Single `<CdScoreInline>` used everywhere |
| Rating display | `StarRating` everywhere | Mixed (some inline single-star) | Route all read-only ratings through `StarRating` |
| Buttons | Documented sizes + placement | `h-11`/`h-12`/`h-6`/`h-7` mix | Define + apply button standards |
| Page header | One `PageHeader` (title/subtitle/icon/action) | Each page rolls its own `<h1>` | Build it; apply to every `(app)` page |
| Spacing/radius/type | From tokens only | Ad-hoc per screen | Apply tokens in the converged components |
| Empty / loading | `EmptyState` + layout-matched skeletons | Mostly converged (prior spec) | Finish coverage |

## What to build (prioritized)

**P0 — the two biggest sources of drift**
1. **`WineListItem`** (`components/ui/` or `components/wine/`): canonical row.
   Anatomy: leading media (label thumb / type avatar with the *normalized* type
   color), title (name + vintage), subtitle (winery), meta row (type badge,
   grape, region, rating via `StarRating`), optional trailing slot (price /
   action / chevron). Variants: `list`, `grid`, `compact`. Replace all 6 bespoke
   implementations (inventory list+grid, Discover, History, Activity, community
   review).
2. **Shared detail foundation**: extract `WineDetailHero`, `CdScoreInline`, and
   `DetailActionRow` so `wine-detail-dialog`, `history-detail-dialog`, and
   `buy-list-detail-dialog` render identical header + community + actions. Kill
   the copy-pasted CD block.

**P1 — language & layout**
3. **Button standards**: document and apply — primary actions ≥44px height and
   in a consistent slot; secondary/outline next to primary; icon buttons one
   size (e.g. 40px touch / 36px visual). Encode as a couple of variants/usage
   rules, not new magic numbers.
4. **`PageHeader`**: `{ title, subtitle?, icon?, action? }`; apply to Cellar,
   Inventory, Discover, Activity, Taste Profile, History, Buy List, Stats,
   Profile.

**P2 — sweep & enforce**
5. **Token sweep**: replace ad-hoc `p-*`/`rounded-*`/`w-*`/text sizes in the
   converged components with the shared scale; standardize card padding + gaps.
6. **Guardrail**: a short "components & tokens" note in the repo so new screens
   compose the canonical pieces instead of rolling their own.

## Constraints / rules

- **Stack only**: Tailwind + shadcn + existing tokens; reuse `components/ui/`.
  No new UI framework.
- **Behavior-preserving**: pure convergence — every screen does exactly what it
  did, just via shared parts. No data/flow changes.
- **Mobile-first, dark-first**: verify 375–430px and desktop, dark and light.
- **Incremental**: one concept at a time behind small PRs (WineListItem first,
  then detail shell), each built + verified before the next. Never a big-bang.
- **No regressions** to the differentiators or the perf work.

## Deliverables

- `WineListItem` (+ variants) replacing all 6 bespoke rows.
- Shared detail foundation (`WineDetailHero`, `CdScoreInline`, `DetailActionRow`)
  consumed by all 3 detail dialogs.
- `PageHeader` applied to every `(app)` page.
- Button standards applied; token sweep done in converged components.
- Before/after screenshots per surface (mobile + desktop, dark + light).

## Work until done — validate your own work

- **Visual diff**: before/after screenshots of every list surface and every
  detail dialog, mobile + desktop, dark + light. A wine row must look identical
  across Inventory, History, Activity, Discover.
- **Grep audit**: after convergence, the bespoke row functions
  (`HistoryCard`, `ResultCard`, the inline activity card, `RatingCard`,
  `wine-list-item`, `wine-grid-item`) are gone or are thin wrappers over
  `WineListItem`; the CD-block pattern appears in exactly one file.
- **Token audit**: grep the converged components for stray `p-2|p-4|rounded-xl|
  w-11` that bypass the standard.
- **`next build` clean**, zero console errors, no functional regressions
  (open/edit/consume/scan/rate all still work).
- **Device pass** in the Capacitor app.

## Definition of done — every item true and verified, not assumed

1. **One `WineListItem`** renders the wine row on Inventory (list + grid),
   History, Activity, Discover, and community reviews — the 6 bespoke versions
   are removed or reduced to thin wrappers.
2. A wine row is **visually identical** across those surfaces (same avatar size,
   padding, type scale, badge placement, rating component) — proven by
   screenshots.
3. **One detail foundation**: all three detail dialogs share the hero, the
   community block, and the action row; the CD-Score block exists in **exactly
   one** component (no duplication).
4. **Read-only ratings everywhere route through `StarRating`** (no remaining
   inline star maps).
5. **Button standards applied**: primary actions are the same size (≥44px) and
   in the same slot on every screen; icon buttons are one consistent size.
6. **`PageHeader` is used by every `(app)` page** (consistent title/subtitle/
   action rhythm).
7. **Token audit passes**: converged components use the shared spacing/radius/
   type scale — no ad-hoc one-offs.
8. `next build` passes, **zero console errors**, and **no functional
   regression** (verified: open detail, edit, consume, scan, rate).
9. **Before/after screenshots** captured for every list surface and detail
   dialog (mobile + desktop, dark + light), demonstrating consistency.
10. A short **components-and-tokens guideline** exists so future screens compose
    the canonical pieces by default.
