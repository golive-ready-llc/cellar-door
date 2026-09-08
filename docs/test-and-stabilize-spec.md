# Spec: Test & stabilize — drive the codebase to clean, and keep it there

## Goal

After a heavy feature/refactor period (Vivino parity, UI polish, consistency
convergence, shared detail body), **prove the codebase is healthy end to end
and fix everything that isn't.** "Clean" is defined mechanically, not by
feel: every gate below passes, every found bug is fixed or explicitly
triaged, and the new surfaces have test coverage so they stay fixed.

Same framework as the prior specs: define the bar → measure → fix → re-measure
→ prove done. Iterate — run → observe → fix → re-run — until all gates pass.
Do not stop at "code written"; stop at "gates green."

## What "clean" means here (the gates)

1. **Types**: `npx tsc --noEmit` — zero errors.
2. **Lint**: `npm run lint` — zero errors (warnings triaged: fix or justify).
3. **Unit/component tests**: `npm test` (vitest, 57 files) — **all pass**.
4. **Build**: `npx next build` — compiles with zero errors.
5. **Coverage of new surfaces**: the session's new/heavily-changed code has
   tests that pin its behavior (see Inputs → risk list).
6. **Runtime smoke**: every route renders in the preview without console
   errors; the critical flows work.
7. **No known-bug backlog**: every bug found during the pass is fixed, or
   listed in the final report with a reason (needs device / needs prod AI /
   deferred by scope).

## Inputs — current state & risk map

**Infrastructure (exists, use it):** vitest (`npm test`, 57 test files under
`tests/`), eslint flat config (`npm run lint`), `tsc`, `next build`, the
`/demo` route (seeded, auth-free) for runtime smoke via the preview server.
Maestro e2e exists (`npm run e2e`) but needs a device — out of scope here.

**Risk map — code that changed heavily this session, in risk order:**

| Area | Change | Existing tests? |
|---|---|---|
| `components/inventory/wine-list-item.tsx` | Became the canonical row: optional props, slots, normType | Unknown — verify |
| `components/wine/history-detail-dialog.tsx` | Full rewrite onto WineDetailBody | Unknown — verify |
| `components/wine/buy-list-detail-dialog.tsx` | Full rewrite onto WineDetailBody | Unknown — verify |
| `components/wine/wine-detail-body.tsx` | New shared component | **None — new** |
| `app/(app)/discover/page.tsx` | New surface (search, matches, wishlist add, detail) | **None — new** |
| `app/(app)/activity/page.tsx` | New surface (feed merge, event mapping, detail) | **None — new** |
| `app/(app)/taste-profile/page.tsx` | New surface (aggregation math: like/dislike thresholds, grape splitting) | **None — new** |
| `app/(app)/profile/page.tsx` | New hub | **None — new** |
| `components/ui/star-rating.tsx` | New canonical rating + distribution + compact | **None — new** |
| `components/ui/empty-state.tsx`, `page-header.tsx` | New shared UI | **None — new** |
| `components/wine/image-capture.tsx` | pendingStream dead-track fix | Has tests — may assert old behavior |
| `components/bottom-nav.tsx` | New 5-tab nav | Has a test — likely asserts OLD tabs |
| `components/wine/add-wine-form-sections.tsx` | Rating stars + ScanResultScore | Has tests (wine-form) — passed earlier |
| `hooks/use-add-wine-form.ts` | userRating threading | Covered by wine-form tests |
| `community-score.tsx` | CdScoreInline, ratingCount gate, StarRating | Unknown — verify |

**Suspicion to verify:** the full vitest suite has NOT been run since ~20
commits shipped. Tests that assert the old nav, old empty states, old detail
layout, or old image-capture stream behavior will fail — each failure is
either a stale test (update it to pin the NEW intended behavior) or a real
regression (fix the code). Decide per failure; never delete a failing test
just to go green.

## What to do (phases — execute in order)

**P0 — Measure everything (no fixes yet).** Run tsc, lint, the full vitest
suite, and the build. Record every failure. This is the bug list.

**P1 — Fix to green.** Work the list: for each failing test decide stale-test
vs regression, fix accordingly. Fix all type/lint/build errors. Re-run after
each batch until gates 1–4 pass.

**P2 — Pin the new surfaces.** Add focused tests for the risk-map rows with
none: taste-profile aggregation (thresholds, grape splitting, empty state),
activity event merge/ordering, StarRating (fractional fill, compact,
distribution bucketing), WineDetailBody (renders every populated field; hides
empties), the canonical WineListItem (slots, normType, selection), and the
detail dialogs' contextual actions. Component tests in the existing
`tests/` idioms — match neighboring test style.

**P3 — Runtime smoke.** With the preview server on `/demo`: visit every
route (cellar, inventory, discover, activity, taste-profile, profile,
buy-list, history, stats, settings), assert render + zero console errors;
exercise the critical clicks (open detail from inventory/activity/history/
buy-list, dimension switch on taste-profile, search UI on discover, edit
toggle on history detail).

**P4 — Report.** Final scorecard: each gate's status, every bug found and its
fix commit, tests added, and the explicit not-verifiable-here list (device
gestures, prod AI results, Stripe flows).

## Rules / constraints

- **Never weaken a test to pass it.** A failing assertion is evidence; the
  verdict is "stale test" only when the new behavior is clearly the intended
  one (it shipped deliberately per the prior specs). Say which in the commit.
- **Fix code on `master` via small commits** (this is stabilization, not a
  feature branch), each gated by tsc + affected tests before push.
- **No new dependencies** for testing; use the existing vitest + testing
  idioms found in `tests/`.
- **No scope creep**: no refactors beyond what a fix requires. The wine-detail
  internal dedup stays out of scope.
- Keep the perf/cache behavior and tier gating intact — regression there is a
  bug even if tests don't catch it.

## Deliverables

- All gates green (proof: command outputs).
- Fix commits, each explaining stale-test vs regression.
- New test files pinning the new surfaces (P2 list).
- Final report: scorecard + fixed-bug list + the explicit "requires device /
  prod" remainder.

## Work until done — validate your own work

Loop: run gate → read failures → classify → fix → re-run. A gate is only
"passed" when the command exits 0 in the transcript, not when the fix "should
work." After all gates pass individually, run the full sequence once more
end-to-end (tsc → lint → test → build → smoke) since fixes can regress each
other. Only then write the report.

## Definition of done — every item true and verified, not assumed

1. `npx tsc --noEmit` exits 0.
2. `npm run lint` exits 0 (or only justified warnings, listed in the report).
3. `npm test` exits 0 — every test passing, including previously-failing ones.
4. `npx next build` exits 0.
5. New tests exist and pass for: taste-profile aggregation, activity event
   merge, StarRating, WineDetailBody, canonical WineListItem, and the two
   rewritten detail dialogs.
6. Every `/demo` route renders in the preview with zero console errors, and
   the P3 click-throughs work.
7. Zero unexplained bugs: each found issue is fixed (with commit) or triaged
   in the report with a concrete reason.
8. The full gate sequence passes end-to-end in one final run.
9. Everything is committed and pushed to master; production deploy READY.
10. Final report delivered with the scorecard and the honest device/prod
    remainder list.
