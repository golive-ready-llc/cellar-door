# Spec: Fix edge auto-scroll teardown — held-still scrolling still dead

## Goal

Bug #2 from `docs/bugfix-round-spec.md` ("must wiggle finger at the edge to
keep scrolling while dragging") is **still present in production** despite the
`0efb24a` fix. This round removes the second, independently-fatal defect found
while verifying that commit, so dragging near the top/bottom edge scrolls
continuously with the finger held still.

## Root cause (verified at runtime, Chrome touch emulation, /demo)

`src/components/cellar/drag-drop-context.tsx` (~line 141) registers an
unmount-cleanup effect:

```ts
useEffect(() => {
  return () => { autoScroll.stop(); scroll.restore(); };
}, [autoScroll, scroll]);
```

`autoScroll` (`useAutoScroll`) and `scroll` (`useScrollSuppression`) each
return a **fresh object literal every render** — their member functions are
stable `useCallback`s, but the wrapper objects are not. Since every
`updateDragPosition` calls `state.setDragPosition` → provider re-render on
**every pointer move**, the "unmount" cleanup actually runs after every move:

- `autoScroll.stop()` cancels the pending rAF callback, killing the loop that
  `0efb24a` made position-driven. Each new pointermove re-kicks it, so
  scrolling limps along *only while the finger moves*; the instant it stops,
  the last scheduled frame is cancelled and scrolling freezes (rAF
  SCHEDULE→RUN→CANCEL trace captured 2026-08-20).
- `scroll.restore()` also un-suppresses touch scrolling after the first move
  of every drag.

## What to build

1. Memoize the return values of both hooks so their identities are stable
   across renders (their members are already stable):
   - `use-auto-scroll.ts`: `useMemo(() => ({ setSpeed, stop }), [setSpeed, stop])`
   - `use-scroll-suppression.ts`: `useMemo(() => ({ suppress, restore, suppressedRef }), [suppress, restore])`
   - No behavioral change inside either hook.
2. Regression test: rendering each hook twice must return the same object
   identity (this is exactly the property the cleanup effect depends on).

## Rules / constraints

- Minimal diff. Do not touch `use-drag-state` / drop-targets identity churn
  (harmless) in this round.
- Standard gates: `tsc --noEmit` (0) · `npm run lint` (0 errors) · `npm test`
  (all pass) · `npx next build` (clean).
- No new dependencies.

## Definition of done

1. During an active long-press drag, after the pointer stops moving inside the
   110px bottom edge zone, `window.scrollY` keeps increasing for ≥1s with zero
   pointer events (verified via the Chrome touch-emulation harness used to
   find the bug).
2. The move-mode tap fix still passes: a 16px-drift tap opens the detail
   dialog; a 44px travel does not.
3. Unit test pinning hook return-identity stability passes and would fail on
   the pre-fix code.
4. All four gates pass.
5. Shipped to master with this spec updated to note verification results;
   real-finger confirmation on the user's phone remains outstanding (flagged
   in the commit message, not claimed as done).
