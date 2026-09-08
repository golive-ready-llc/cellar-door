# Spec: Cellar Door → Vivino mobile-app parity

## Goal

Bring **Cellar Door** to feature and UI parity with the **Vivino mobile app**,
working entirely inside Cellar Door's existing stack. This is a *close-the-gaps
and align-the-UX* effort, not a rewrite — Cellar Door is already a mature wine
app that overlaps heavily with Vivino and **exceeds** it in physical-cellar
management. Reach parity on the surfaces where Vivino is ahead **without
regressing Cellar Door's differentiators**.

Treat the live Vivino app as the source of truth for UX details: when this spec
and the actual app disagree, re-check the app and match it.

## What "parity" means here

Parity = a user coming from Vivino finds every core Vivino capability present,
in a place they'd expect, working at least as well. Concretely:

- The **core loop** matches: scan → identify → see community rating + tasting
  notes + food pairing + price → rate/review → add to cellar or wishlist →
  discover more.
- The **information architecture** matches Vivino's five primary surfaces
  (Scan, Discover, Cellar, Activity, Profile), adapted to Cellar Door's nav.
- The **wine-detail screen** leads with the things Vivino leads with
  (community score, your rating, price range, tasting notes, food pairings).
- The **Taste Profile** is a first-class, browsable screen.

### Non-goals (explicit)

- **Do not** replicate Vivino's 16M-wine static catalog. Cellar Door is
  AI-first (Gemini/DeepSeek identification + enrichment) by design; "Discover"
  must be reframed around that, not a scraped database.
- **Do not** build a real-money marketplace/checkout for third-party wine in
  this pass (merchant price *comparison* is in scope; *buying* is not).
- **Do not** remove or degrade Cellar Door-only strengths: physical
  wall/cabinet/slot visualization, Sort Assistant, Terroir Twins, Pour Cost,
  Insurance Report, Sommelier guest-voting mode, CSV import, public API,
  Decant Timer, Vintage Story, receipt scan.

## Target — the Vivino app (what we're matching)

Vivino's mobile app is organized around five bottom-tab surfaces plus a
canonical wine-detail screen:

| Vivino surface | What it does |
|---|---|
| **Scan** | Camera-first. Photograph a label or a restaurant wine list → instant identification, rating, reviews, price, tasting notes, pairings. |
| **Discover** | Browse/search ~16M wines, 245k wineries, 500+ sellers; price comparison; "matches for you"; buy. |
| **Vinotheque (Cellar)** | Track owned bottles, drinking windows, quantities, vintages; sort by quantity/vintage/readiness. |
| **Activity** | Personal + social feed of tastings, ratings, reviews; favorites/memories. |
| **Profile / Taste Profile** | "What you've tried / like / dislike" broken down by style, region, grape; account + settings. |
| **Wine detail** | Leads with community rating, price range, tasting notes, food-pairing suggestions. |

Sources: [Vivino app page](https://www.vivino.com/en/app), [Complete guide to the Vivino experience](https://www.vivino.com/en/wine-news/the-complete-guide-to-the-vivino-experience), [Wine Cellar feature](https://www.vivino.com/en/wine-news/discover-vivinos-wine-cellar-feature), [App features help](https://us.help.vivino.com/customer/s/topic/0TO2M0000018bxYWAQ/vivino-app-features). Verify against the installed app during build.

## Inputs — Cellar Door's current state (the starting point)

Routes (`src/app/(app)/`): `cellar`, `inventory`, `stats` (+ `stats/[metric]`),
`history`, `buy-list`, `settings`, `admin`, `insurance-report`.

Nav today: bottom-nav = Cellar / Inventory / Buy List / History / Stats, plus a
camera **Add** action and the **CellarChat** sommelier. (See
`src/components/bottom-nav.tsx`, `floating-camera-fab.tsx`, `chat/`.)

Relevant existing building blocks to reuse (do not rebuild):

- **Scan**: `add-wine-dialog.tsx` + `image-capture.tsx` (label / barcode /
  wine-list / receipt), `wine-list-results.tsx` (ranks a scanned list against
  the cellar). AI in `src/lib/ai/` (provider router → Gemini / DeepSeek / Qwen).
- **Ratings**: user 0–5 `userRating`; community **CD Score**
  (`community/community-score.tsx`, `CommunityWine`/`CommunityRating` models).
- **Wine detail**: `wine/wine-detail-dialog.tsx` (rich; rating, CD score,
  location, enrich, decant, terroir, share, pour cost, vintage story).
- **Cellar**: `cellar/` (walls/cabinets/slots grid, Sort Assistant, edit mode).
- **Wishlist**: `buy-list/` + `add-buy-list-dialog.tsx`.
- **Taste profile**: `server/actions/taste-profile.ts` (data exists; not a
  first-class screen yet).
- **Recommendations**: `aiRecommend` / `aiPersonalizedRecommend`, CellarChat.
- **Tiers**: FREE / PRO (Cellar+) / PREMIUM (Cellar Pro) — `src/lib/tier.ts`.

## Gap analysis (Vivino feature → Cellar Door today → parity work)

Status: ✅ have · 🟡 partial · ❌ missing

| Vivino capability | Cellar Door today | Status | Parity work |
|---|---|---|---|
| Label / wine-list scan → instant ID | Full AI scan (label/barcode/list/receipt) | ✅ | None functional. Match the *result UX*: show rating + pairing + price inline on the scan result, not only on add. |
| Community rating on a wine | CD Score (AI-baseline + user blend) | 🟡 | Parity needs a real ratings base. Surface "X ratings" prominently; never show a score with 0 real ratings (already fixed). |
| Written reviews | CommunityRating has review text | 🟡 | Show reviews list + "write a review" on detail; aggregate. |
| Wine-detail leads w/ rating, price, notes, pairing | Detail dialog has all, different order | 🟡 | Reorder/restyle detail to Vivino hierarchy: hero rating → price range → tasting notes → pairings → your actions. |
| Discover / search huge catalog | AI search (no browsable catalog) | ❌→reframe | Build a **Discover** surface: AI-backed search, "matches for you", trending in your regions, browse by grape/region/style. Reframe around AI, not a static DB. |
| Price comparison across sellers | Market-value estimate only | 🟡 | Add merchant price-range display (data source TBD; AI estimate + optional affiliate API). Comparison only — no checkout. |
| Buy / marketplace | Buy List (wishlist) only | ❌ (non-goal) | Out of scope this pass; keep wishlist. |
| Cellar tracking, drink windows, sort | Superset (walls/cabinets, Sort Assistant) | ✅ exceeds | Keep. Add Vivino-style quick sorts (quantity / vintage / readiness) to inventory if missing. |
| Wishlist | Buy List | ✅ | Align naming/affordances ("add to wishlist" verb on detail + scan result). |
| Taste Profile (tried/like/dislike by style·region·grape) | Data exists, no screen | ❌ | Build a **Taste Profile** screen on Profile: breakdowns by style/region/grape from rated wines. |
| Activity feed (own + social) | Community ratings; no feed/follow | ❌ | Build an **Activity** surface: your tasting history as a feed first; social/follow is a later phase. |
| Personalized recommendations | AI recommend + CellarChat | ✅ | Surface "matches for you" inside Discover, not only chat. |
| Food pairing | Cork & Fork + per-wine pairings | ✅ | Surface pairings on the wine-detail hero area. |
| Premium subscription | 3-tier Stripe (FREE/PRO/PREMIUM) | ✅ exceeds | Keep; ensure new surfaces are tier-gated consistently. |
| Education ("Wine Adventure") | Blog + Vintage Story | 🟡 | Optional: light "learn" entry; low priority. |
| 5-tab IA | Different nav (Cellar/Inventory/Buy/History/Stats) | 🟡 | Re-map nav to Vivino's mental model (see UI parity). |

## What to build (prioritized)

**P0 — core-loop & detail parity (highest leverage, mostly reshaping existing UI)**
1. **Wine-detail hierarchy**: reorder the detail dialog to Vivino's order —
   hero (name/vintage/region) → **community rating + your rating** → **price
   range** → **tasting notes** → **food pairings** → cellar location + actions.
   Reuse existing data; this is layout + emphasis.
2. **Scan-result parity**: after identify, show rating + pairing + estimated
   price *before* the add form, with one-tap "Add to cellar" / "Add to
   wishlist" / "Rate".
3. **Reviews on detail**: list community reviews; "write a review" inline
   (CommunityRating already supports text).

**P1 — missing surfaces**
4. **Taste Profile screen** (Profile): "What you like / dislike / tried" by
   wine style, region, grape — computed from `userRating` + `taste-profile.ts`.
   Visual: bars/chips per category, like Vivino.
5. **Discover surface**: AI search + "matches for you" + browse by
   region/grape/style + "trending in regions you own". Tier-gate AI parts.
6. **Activity surface**: your tasting/rating history as a reverse-chron feed
   (from `WineHistory` + ratings). Defer social/follow to P2.

**P2 — discovery depth & social**
7. **Merchant price range** on detail (AI estimate now; affiliate/price API
   later) — comparison only.
8. **Social**: follow other users; see friends' ratings in Activity. Requires
   new models + privacy controls.

**UI parity (applies across the above)**
- **Nav / IA**: map the bottom nav to Vivino's five-surface model. Proposed:
  **Scan** (camera) · **Discover** · **Cellar** (Vinotheque) · **Activity** ·
  **Profile**. Fold Inventory/Stats/History/Buy List under Cellar/Activity/
  Profile so the top-level count stays at five. Keep desktop sidebar.
- **Camera-first Scan tab**: tapping Scan opens the camera immediately (already
  the add-wine default) — make it a first-class tab, not only a FAB.
- **Mobile-first**: every new screen designed for the Capacitor WebView width
  first; verify at 375–430px and desktop.
- **Components**: build with `shadcn/ui` from `src/components/ui/`; match the
  existing dark palette and the rounded-card visual language.

## Rules / constraints

- **Stack only**: Next.js 16 App Router, React 19, TypeScript, Tailwind,
  shadcn/ui, Prisma/Neon, Firebase auth, Stripe, Gemini/DeepSeek AI, Capacitor.
  No new framework or state library; reuse existing patterns
  (`server/actions/`, `lib/data.ts`, `useSyncExternalStore`, tier hooks).
- **Tier-gate** every AI/discovery feature consistently with `src/lib/tier.ts`
  (AI requires PRO+; show upgrade prompts, never broken features for FREE).
- **Reuse over rebuild**: extend `wine-detail-dialog`, `add-wine-*`,
  `community-score`, `buy-list`, etc. New top-level screens are new routes under
  `(app)/`.
- **Mobile-first & online-only Capacitor**: the app loads production in a
  WebView. No native-only assumptions; test on device.
- **Privacy/data**: any social feature needs explicit privacy controls and a
  privacy-policy update (international data + AI provider disclosures already in
  `(auth)/terms`). No new PII exposure without disclosure.
- **DB**: schema changes via `prisma/schema.prisma` + `npx prisma db push`;
  keep cascading deletes intact.
- **Do not regress** the differentiators listed in Non-goals.

## Deliverables

- Implemented P0 + P1 features and the nav/IA re-map, behind appropriate tier
  gates.
- New routes/screens: Discover, Activity, Taste Profile (Profile section).
- Any Prisma migrations (reviews surfacing, activity, optional social) pushed.
- Reused/refactored detail + scan-result UI matching Vivino's hierarchy.
- Tests for new server actions and gating; updated `CLAUDE.md`/docs if IA
  changes.
- This spec kept current as scope is confirmed.

## Work until done — validate your own work

Do not stop at "code written." Prove each surface works end-to-end:

- **Build gate**: `npx next build` passes with zero type/lint errors before any
  deploy.
- **Device parity check**: run the relevant screen side-by-side with the live
  Vivino app at mobile width; capture before/after screenshots. The bar is "a
  Vivino user finds the feature where they expect it and it works."
- **Tier matrix**: verify each new feature for FREE / PRO / PREMIUM — FREE sees
  upgrade prompts, not broken UI; AI features blocked below PRO.
- **No console/runtime errors** on each new screen (mobile WebView + desktop).
- **Data correctness**: Taste Profile reflects actual rated wines; Activity
  reflects real history; Discover search returns sensible AI results; detail
  shows real CD score + rating count (no phantom scores).
- **Regression pass**: cellar grid, Sort Assistant, scan flows, and chat still
  work after the nav re-map.

## Definition of done — every item true and verified, not assumed

1. **Nav/IA** matches Vivino's five-surface model; all prior functionality
   reachable; no dead ends; verified on device + desktop.
2. **Scan result** shows rating + pairing + price + one-tap add/wishlist/rate
   before the add form; verified with a real label scan.
3. **Wine detail** leads with community rating + your rating, then price,
   tasting notes, pairings — matching Vivino's hierarchy; reviews list +
   write-review work.
4. **Taste Profile** screen renders tried/like/dislike by style, region, and
   grape from the user's actual ratings; empty state handled.
5. **Discover** returns AI search results + "matches for you" + region/grape
   browse; tier-gated; no errors.
6. **Activity** shows the user's tasting/rating history as a feed; correct
   chronological data.
7. **CD score** never displays a number with zero real ratings; rating counts
   shown (already enforced — keep verified).
8. **Tier gating** verified across FREE/PRO/PREMIUM for every new surface.
9. **`npx next build` passes**, deploy succeeds, **zero console errors** on
   every new/changed screen, and **no differentiator regressed**.
10. Parity confirmed by side-by-side comparison with the live Vivino app for
    Scan, Discover, Cellar, Activity, and Profile.
