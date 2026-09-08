# Spec: WineDetailDialog renders the shared WineDetailBody

## Goal

`wine-detail-dialog.tsx` is the last surface still rendering its own copy of
the read-only wine detail layout — it is the file `WineDetailBody` was
*extracted from*, so it looks identical but has drifted independently since.
Finish the convergence started in `18957a1` (Buy List) and `2db1c50`/`f7cbb09`
(History): the dialog renders `WineDetailBody` and passes its context-specific
UI through the existing slots. This is the highest-risk file in the app —
verify every action at runtime before merge.

## What to build

1. Replace the dialog's inline detail body (hero, title block, spec grid,
   description/pairings/notes — the region between the DialogHeader and the
   sub-dialog mounts) with `<WineDetailBody … />`, mapping every field the
   inline copy displayed onto `WineDetailBodyData`. If the inline copy shows a
   populated field the shared body lacks, extend the shared body (the body is
   the canonical "show every populated field" implementation per `f7cbb09`).
2. Pass through the slots:
   - `actions`: the dialog's action grid (Edit / Enrich / Decant / Terroir /
     Consume / Duplicate / Add Bottle / Share, plus Show-in-Cellar and the
     storage/line info where the current layout renders them).
   - `ratingSlot`: the existing `RatingDisplay` (tap-to-rate + DialRateDialog).
   - `headerExtra` / `children` as the shared body's interface requires.
3. Sub-dialogs (`DecantTimerDialog`, `TerroirTwinDialog`,
   `DuplicateCountDialog`) and the inline edit form stay mounted where they
   are — only the read-only body markup is replaced.
4. Delete the now-dead inline body markup and any helpers only it used
   (`RatingDisplay` moves to the slot or stays if still referenced).

## Rules / constraints

- Work on branch `detail-dedup` off master; do NOT push to master until every
  DoD item passes (Vercel deploy is currently author-gated anyway — see
  handoff §0.1).
- Zero behavior change: same fields, same actions, same conditional
  visibility (e.g. `onSave` gating Edit), same dialog scroll/layout feel.
- Reuse — do not re-create — `WineDetailBody`'s existing slots; if a slot is
  missing, extend the shared component rather than forking markup back in.
- The demo-mode guard (`assertNotDemoClient`) paths must be untouched.

## Definition of done

1. `npx tsc --noEmit` 0 · `npm run lint` 0 errors · `npm test` all pass ·
   `npx next build` clean.
2. Runtime on `/demo` (local dev server): tap a cellar bottle → dialog opens
   via `WineDetailBody`; hero, title, rating, CD score, full spec grid render
   with the demo wine's populated fields.
3. Every action verified on `/demo`: Edit → inline form opens and saves shape
   unchanged; Enrich triggers (mock) without error; Decant → timer dialog;
   Terroir → twin dialog; Duplicate → count dialog; Consume/Add-Bottle/Share
   render and are wired (mutations themselves are Unauthorized in demo —
   rendering + handler invocation is the verifiable surface).
4. Buy List and History detail views still render correctly (regression
   check — they already use the body).
5. Net line count of `wine-detail-dialog.tsx` drops by roughly the size of
   the removed inline body (~500-700 lines); no duplicated field-layout
   markup remains in the dialog.
6. Branch pushed; merge to master only after the above, with a commit
   message naming what moved where.

## Verification results (2026-08-25, /demo via Playwright)

1. Gates: tsc 0 · lint 0 errors / 27 baseline warnings · 70 files / 497
   tests · build clean. Dialog shrank 1,431 → 1,237 lines; no duplicated
   field-layout markup remains (local DetailItem helper deleted).
2. Dialog opens via WineDetailBody — verified full render: hero + photo/AI
   buttons, title + region + cellar-location (headerExtra), Your Rating +
   Expert Score + CD Score row, badges, complete spec grid (incl. new
   bottleSize field), description, critic scores, CD reviews, Vintage Time
   Machine, pairings, notes.
3. Actions on /demo: Edit → inline form ✓ · Decant → timer dialog ✓ ·
   Terroir Twins → dialog ✓ · Duplicate → count picker ✓ · Share → fires,
   no crash ✓ · Remove → reason picker ✓ (demo then rejects the mutation,
   by design). **Enrich: button renders and is wired to the untouched
   handleEnrich — live click-through not captured (harness timing), so the
   mock-enrichment path is unverified in this round.**
4. Regression: History detail (headerExtra Drank/Removed + Final Rating
   slot) ✓ · Buy List detail (Mark Purchased/Remove actions) ✓.
5. Body gained `bottleSize` (Bottle format field) — the one field the
   dialog's inline copy had that the shared body lacked.

## Implementation map (surveyed 2026-08-25, branch `detail-dedup`)

`DetailView` (wine-detail-dialog.tsx:272–~980) owns BOTH the logic and the
duplicated layout. Keep ALL logic in place (state, handleEnrich,
handleAiFetchImage, handleRate, CD-score fetch, mountedAt guard); replace
only the JSX regions:

- **519–585** hero + title + region + cellar-location button → the body's
  built-in hero/title; cellar-location button → `headerExtra` slot.
- **587–741** action grids (Edit/Enrich row, Decant/Terroir row,
  Remove/Duplicate/Share row with the 3-vs-2 column logic, Add/Remove Bottle
  storage row) → extract verbatim into the `actions` slot JSX.
- **743–~805** Your Rating + ExpertScoreInline + CdScoreInline →
  `ratingSlot` (keep the three-in-a-row layout inside the slot if the body's
  slot is single-node; check how History wired it).
- **~806–842** spec grids → the body's built-in grids (`WineDetailBodyData`
  covers the fields; verify field parity — the body is the canonical
  "every populated field" renderer per f7cbb09).
- **843+** CdScoreSection (community reviews) → `children`.
- **949–980** Decant/Terroir/Duplicate sub-dialog mounts — unchanged.
- `RatingDisplay` (212–270) stays (referenced by the slot); `DetailItem`
  local helper (1411) likely becomes dead after the grid replacement —
  delete if unreferenced.
- Hero props: `onImageChange`/`onAiFetchImage` map to the body's
  `onImageChange`/`onAiFetchImage` props (the body's hero already supports
  them).
- CHECK: where the body renders `actions` relative to rating/specs vs the
  dialog's current order (actions before rating). If different, the body's
  order wins — it's the shared standard (Buy List + History already render
  that way).
