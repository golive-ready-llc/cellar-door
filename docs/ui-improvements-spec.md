# Spec: Cellar Door UI improvements — best-in-class polish

## Goal

Raise Cellar Door's **UI craft** to match the best apps in the category. The
features are largely there (and in cellar management we exceed the field) — this
spec is about *how it looks and feels*: hierarchy, imagery, motion, empty
states, consistency, and mobile ergonomics. Same framework as the Vivino-parity
spec: benchmark against the best, gap-analyze, build, verify, prove done.

Treat the named reference apps as the bar. When this spec and a reference app
disagree on a detail, re-check the app.

## What "best-in-class UI" means here

Five principles, drawn from the leaders:

1. **Photo-forward.** The bottle/label image is the hero, not an afterthought.
2. **One clear focal point per screen.** Rating, or the bottle, or the action —
   never three competing for attention.
3. **Motion with meaning.** Transitions explain what happened; nothing janks.
4. **Delight in the dead space.** Empty states, loading, and first-run are
   designed, not blank.
5. **Thumb-first.** Primary actions sit in reach; touch targets never cramped.

Non-goals: no redesign for its own sake, no new framework, no regressing the
cellar-management depth that sets Cellar Door apart.

## Benchmark apps (the bar — what each does well)

| App | UI strength to steal | Lesson |
|---|---|---|
| **Vivino** | Mobile-first, **camera-first** scan; instant rating reveal; clean discovery cards | Speed + a single obvious action per screen ([source](https://cellared.ai/blog/best-wine-cellar-apps-2026)) |
| **Delectable** | The **cleanest tasting-note / journaling UI** in the category; photo-centric, elegant typography, high-signal feed | Restraint, generous whitespace, type as the design ([source](https://invintory.com/blog/best-wine-apps-top-tools-for-collectors-compared/)) |
| **CellarTracker** | Unmatched data depth — but UI "**feels generations behind**" (no widgets, dated layout) | The cautionary example: don't let data density kill craft ([source](https://cellarlog.app/vs/cellartracker-vs-vivino)) |
| **InVintory / Enolisa** | Modern collector apps pushing premium visuals, 3D/visual cellar, polish | The current polish bar for collection apps ([source](https://enolisa.com/blog/best-wine-apps-2026/)) |
| **Cross-category craft** (Linear, Things, Apple HIG) | Motion discipline, spacing systems, reduced-motion respect | Reference for *how* to execute polish, not what |

## Inputs — Cellar Door's current UI state

Stack: Next.js 16 + React 19 + Tailwind + shadcn/ui, dark theme, Capacitor
WebView. Already present (build on these, don't reinvent):

- **Components**: `components/ui/` (shadcn), card/badge visual language,
  `wine-label-thumbnail.tsx` (label images), `ui/wine-list-skeleton.tsx`
  (skeletons), `pull-to-refresh.tsx`, `floating-camera-fab.tsx`.
- **Motion**: slot-flash highlight (add/place/move), `active:scale-95` on
  buttons, a few `animate-in` usages.
- **Haptics**: `hapticTap()` via Capacitor.
- **Theme**: dark palette + `theme-toggle`; `use-wine-colors` for type colors.
- **Surfaces**: Cellar grid, Inventory list/grid, new Discover / Activity /
  Taste Profile / Profile, wine-detail dialog, camera scan.

Honest current state: functional and consistent, but **utilitarian** — label
photos underused, motion sparse, empty/loading states plain, typographic
hierarchy flat, detail screen text-dense. Closer to CellarTracker's plainness
than Delectable's polish in places.

## Gap analysis (UI dimension → best-in-class → Cellar Door today → work)

Status: ✅ strong · 🟡 partial · ❌ weak

| Dimension | Best-in-class | Cellar Door today | Status | Work |
|---|---|---|---|---|
| **Label/photo prominence** | Vivino/Delectable lead with the bottle | Small thumbnails; type-color circles when no photo | 🟡 | Make the label photo the hero on detail + cards; richer fallback than a flat circle |
| **Typographic hierarchy** | Delectable: clear type scale, breathing room | Mostly `text-sm`/`text-xs`; flat | 🟡 | Define a type scale (display/title/body/caption); apply on detail + cards |
| **Rating visualization** | Vivino: bold, instantly readable score | CD badge + stars; functional | 🟡 | Stronger rating hero; rating distribution bar; consistent star component |
| **Motion / micro-interactions** | Linear/Vivino: purposeful transitions | Slot flash + scale only | 🟡 | Shared transition vocabulary: card press, dialog enter, list stagger, tab change; respect `prefers-reduced-motion` |
| **Empty states** | Vivino/Delectable: designed, actionable | Plain icon + text | 🟡 | Designed empty states per surface with a clear primary action |
| **Loading states** | Skeletons that match final layout | Skeletons exist; partial coverage | ✅/🟡 | Extend skeletons to Discover/Activity/Taste Profile; match real layout |
| **Card/spacing consistency** | One spacing & radius system | Mostly consistent; drift in paddings | 🟡 | Audit spacing/radii; codify tokens; remove one-offs |
| **Color & dark theme** | Refined, layered surfaces | Single dark surface, flat | 🟡 | Layered elevation (surface tiers), accent discipline, gradient restraint |
| **Touch targets / ergonomics** | 44px targets, thumb reach | Some sub-44 targets (icon buttons) | 🟡 | Enforce min target sizes; keep primary actions in thumb zone |
| **Onboarding / first-run** | Guided, delightful first session | `onboarding/` exists | 🟡 | Polish first-run; empty-cellar guidance toward first scan |
| **Scan/camera polish** | Vivino's hallmark | Functional custom camera | 🟡 | Reveal animation on identify; framing affordance; result transition |
| **Accessibility** | Contrast, dynamic type, reduced motion | Partial | 🟡 | Contrast pass (WCAG AA), focus states, reduced-motion, scalable text |

## What to build (prioritized)

**P0 — highest visible impact, low risk**
1. **Type scale + spacing tokens.** Define a small set of Tailwind utilities/
   tokens (display/title/body/caption; spacing/radius) and apply on the
   wine-detail dialog and the primary list/grid cards. Removes flatness app-wide
   with one system.
2. **Photo-forward wine detail.** Lead the detail dialog with a large label
   image (hero), rating overlaid/beneath; richer no-photo fallback (gradient +
   monogram, not a flat circle). Delectable/Vivino convention.
3. **Designed empty states.** A reusable `EmptyState` component (illustration/
   icon + headline + one primary action), applied to Cellar, Inventory,
   Discover, Activity, Taste Profile, Buy List, History.

**P1 — motion & consistency**
4. **Motion vocabulary.** A tiny set of shared transitions (card press, dialog/
   sheet enter, list stagger on first paint, tab/route change) gated behind
   `prefers-reduced-motion`. Reuse the existing flash; don't over-animate.
5. **Rating system component.** One canonical star/score component + a rating
   distribution bar on detail (Vivino-style), used everywhere ratings appear.
6. **Skeleton coverage.** Layout-matched skeletons for Discover, Activity, Taste
   Profile so first paint never flashes blank.

**P2 — depth & ergonomics**
7. **Elevation/surface tiers.** Introduce 2–3 dark-surface levels so cards,
   sheets, and the app background read as layered, not flat.
8. **Touch-target + thumb-zone audit.** Enforce ≥44px interactive targets; keep
   primary actions reachable on large phones.
9. **First-run polish.** Empty-cellar → guided first scan; celebrate the first
   bottle (tie into the existing slot-flash).

## Constraints / rules

- **Stack only**: Tailwind + shadcn/ui; extend the existing design tokens, don't
  add a UI framework or CSS-in-JS. Reuse `components/ui/`.
- **Mobile-first**: design at 375–430px first; verify desktop. It runs in a
  Capacitor WebView — no hover-only affordances for primary actions.
- **Dark-first**: the app is dark-theme primary; every change must look right in
  dark before light.
- **Performance**: motion must stay 60fps on a mid phone; no layout thrash; lazy
  the heavy bits. No regression to the perf work already done (cache TTLs).
- **Accessibility**: meet WCAG AA contrast; honor `prefers-reduced-motion`;
  keep focus states.
- **No feature regressions**: this is polish — behavior and data stay identical.
- **Incremental**: ship per-surface behind small PRs; never a big-bang restyle.

## Deliverables

- Design tokens (type scale, spacing, radius, elevation) as Tailwind theme
  extensions + a short usage note.
- Reusable `EmptyState`, canonical rating component, motion helpers.
- Restyled wine-detail (photo-forward) + primary cards.
- Skeleton + empty-state coverage across all primary surfaces.
- Before/after screenshots per surface (mobile + desktop, dark + light).

## Work until done — validate your own work

Polish is judged by eye and by device — prove it:

- **Before/after screenshots** for every changed surface, mobile + desktop,
  **dark and light**. Side-by-side with the reference app where relevant.
- **Device pass** in the Capacitor app (real phone), not just the browser —
  motion smoothness, touch targets, safe areas.
- **`next build` clean**, zero console errors on every changed screen.
- **Accessibility checks**: contrast (AA) on text/badges; `prefers-reduced-
  motion` disables non-essential motion; visible focus states; text scales.
- **Perf check**: no dropped frames on scroll/animation on a mid phone; no
  regression in tab-switch timings.
- **Consistency sweep**: one type scale, one spacing system, one radius set —
  grep for one-off paddings/font sizes that bypass the tokens.

## Definition of done — every item true and verified, not assumed

1. A single **type scale + spacing/radius token set** exists and is applied to
   the wine-detail dialog and primary list/grid cards (no ad-hoc sizes there).
2. The **wine-detail screen is photo-forward**: large label hero with a strong
   rating treatment and a designed no-photo fallback.
3. A reusable **EmptyState** is used on every primary surface (Cellar,
   Inventory, Discover, Activity, Taste Profile, Buy List, History), each with a
   clear primary action.
4. A **shared motion vocabulary** is in place (card press, dialog/sheet enter,
   route/tab change) and **fully disabled under `prefers-reduced-motion`**.
5. One **canonical rating component** is used everywhere ratings render;
   detail shows a rating distribution.
6. **Skeletons match final layout** on Discover, Activity, Taste Profile (no
   blank flash on first paint).
7. **Layered dark surfaces** (≥2 elevation tiers) replace the flat single
   surface on cards/sheets vs. background.
8. **All interactive targets ≥44px**; primary actions verified reachable in the
   thumb zone on a large phone.
9. **WCAG AA contrast** verified on text and badges; focus states visible.
10. `next build` passes, **zero console errors**, no feature/perf regression,
    and **before/after screenshots** (mobile+desktop, dark+light) captured for
    every changed surface, reviewed against the reference apps.
