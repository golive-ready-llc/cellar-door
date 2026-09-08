# Cellar Door — Project Context

## What is this?

Cellar Door is a wine collection management platform (web + mobile via Capacitor).
Users catalog, organize, rate, and track their wine collections with AI-powered
analysis, community ratings, and visual cellar management.

**Production URL:** https://mycellardoor.app
**Company:** Golive Ready, LLC

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Database:** PostgreSQL via Prisma 7. The hosted service uses Neon;
  self-hosted runs Postgres in a container. Prisma uses the **pg driver
  adapter** (`@prisma/adapter-pg`), so there is no Rust query engine binary.
- **Auth:** Firebase Authentication (Google Sign-In, email/password with
  verification). Self-hosted instances may instead run **single-user mode**
  (`NEXT_PUBLIC_SINGLE_USER_MODE=true`), which disables authentication
  entirely — see `src/lib/single-user.ts`.
- **Payments:** Stripe (subscriptions for Cellar+ and Cellar Pro tiers).
  No publishable key is used: checkout redirects to a server-created
  session URL, so Stripe.js never runs in the browser.
- **AI:** a provider **router** (`src/lib/ai/provider-router.ts`) with separate
  text and vision slots, each with failover. Gemini, DeepSeek, and Alibaba
  Qwen are supported; anything OpenAI-compatible works. Configurable at
  runtime in `/admin`, with keys encrypted at rest via `ENCRYPTION_KEY`.
- **Mobile:** Capacitor (iOS/Android). **Online-only** — it loads a URL in a
  WebView, so a web deploy reaches the app with no rebuild.
- **Hosting:** Vercel (hosted service) or Docker (`compose.yaml`) for
  self-hosting.
- **Styling:** Tailwind v4 + shadcn/ui components
- **License:** FSL-1.1-ALv2 (Functional Source License; source-available, not
  OSI open source — converts to Apache-2.0 two years after each release). See
  LICENSE and NOTICE — the code is licensed for any non-Competing-Use purpose,
  the "Cellar Door" name and logo are not.

## Architecture

```
src/
  app/
    (app)/         # Authenticated app pages. Surfaces: cellar, discover,
                   #   activity, taste-profile, profile, inventory, buy-list,
                   #   history, stats, insurance-report, settings, admin
    (auth)/        # Auth pages (login, signup, verify-email, terms)
    api/           # API routes (Stripe webhooks, REST API v1, gate)
    page.tsx       # Public landing page
  components/      # React components (ui/, wine/, chat/, tier/, stats/, settings/, etc.)
  hooks/           # Custom hooks (use-tier, use-ai-toggle, use-checkout, etc.)
  lib/             # Shared utilities (firebase, db, tier config, stripe, data fetching)
  server/          # Server actions (auth, wines, chat, admin, api-keys)
  types/           # TypeScript types and constants
  generated/       # Prisma generated client
prisma/
  schema.prisma    # Database schema
public/            # Static assets (screenshots, GIFs, logo)

Dockerfile            # Self-hosted image (multi-stage, standalone Next output)
compose.yaml          # One-command stack: app + its own Postgres
docker-entrypoint.sh  # Idempotent `prisma db push`, then start the server
```

**Mobile navigation:** Cellar - Stats - Scan (center) - Activity - Profile.
Secondary surfaces (Discover, Inventory, Buy List, History, Taste Profile,
Settings) live under Profile. See `src/components/bottom-nav.tsx`.

## Key Patterns

- **Tier system:** FREE / PRO (Cellar+) / PREMIUM (Cellar Pro). Defined in `src/lib/tier.ts`.
  AI features require PRO+. API access requires PREMIUM. Ads show for FREE only.
- **Server actions** in `src/server/actions/` handle all mutations (wines, auth, chat, etc.)
- **Data fetching** via `src/lib/data.ts` which calls server actions from client components
- **Firebase Auth → Prisma sync:** `syncUser(idToken)` creates/updates DB user after Firebase auth
- **Email verification:** Required for email/password signups before app access
- **Cascading deletes:** Prisma `onDelete: Cascade` ensures user deletion removes all data
- **`useSyncExternalStore`** used for cross-component reactive state (AI toggle, etc.)
- **Auth choke point:** every server action resolves identity through
  `getAuthenticatedUserId()` in `src/server/auth-guard.ts`. Never trust a
  client-supplied userId — `resolveServerUserId()` deliberately ignores it.
- **Shared UI primitives — reuse these, do not re-implement them:**
  - `components/inventory/wine-list-item.tsx` — the canonical wine row, with
    `trailing` / `mediaBadge` / `extraBadge` / `footer` slots
  - `components/wine/wine-detail-body.tsx` — the shared read-only detail
    layout; per-context differences go through `actions` / `ratingSlot` /
    `headerExtra` / `children`
  - `components/ui/`: `StarRating`, `EmptyState`, `PageHeader`, plus
    `CdScoreInline` in `components/community/community-score.tsx`

## Database Models (Prisma)

User, Wine, Wall, Cabinet, BuyListItem, WineHistory, CommunityWine,
CommunityRating, BarcodeCache, WineMetadata, ApiKey, AIConfig, AiUsage,
AiUsageLog, TasteProfileCache, Challenge, Badge, GuestSession, Feedback,
AuditLog, ProcessedStripeEvent, BusinessLead, ValueSnapshot.
See `prisma/schema.prisma` for the full schema.

## Environment Variables

Required for production: Firebase config (NEXT_PUBLIC_FIREBASE_*),
FIREBASE_SERVICE_ACCOUNT_KEY, DATABASE_URL, ENCRYPTION_KEY,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, GEMINI_API_KEY, ADMIN_EMAIL.

`ENCRYPTION_KEY` (64 hex characters) encrypts AI provider keys and Home
Assistant tokens at rest. If it is unset they are stored in plaintext.

`.env.example` documents every variable the code actually reads, grouped by
whether it is required. `.env.docker.example` is the compose equivalent.

## Development Rules

1. **Never commit secrets** (.env files, API keys, service account keys)
2. **Always run `npx next build`** before deploying to catch type/build errors
3. **Deploying = pushing to `master`.** Vercel's GitHub integration
   auto-deploys to production, so a push ships to real users immediately —
   there is no staging gate. Push a branch instead when you want a preview
   deploy first. (`npx vercel --prod` also works but needs CLI auth and is
   not the normal path.)
4. **Database migrations:** Edit `prisma/schema.prisma`, then `npx prisma db push`
5. **Prefer editing existing files** over creating new ones when possible
6. **Test tier gating** — free users should see upgrade prompts, not broken features
7. **Mobile-first responsive design** — test at both mobile and desktop widths
8. **shadcn/ui components** live in `src/components/ui/` — use them over custom UI

## Button Hierarchy

Every action button uses a semantic `Button` variant (`src/components/ui/button.tsx`)
so users can parse a row of buttons by color at a glance. Never restyle a button
with ad-hoc color classes — pick the variant that matches the action's meaning:

| Variant | Meaning | Examples |
|---|---|---|
| `default` (filled burgundy) | THE primary action of a view — at most one per view | Save, Submit, Mark Purchased |
| `outline` | Neutral utilities | Edit, Duplicate, Share, Cancel |
| `ai` (soft amber) | AI-powered actions (usually with a `Sparkles`/feature icon) | Enrich, Decant, Terroir Twins, AI scans |
| `destructive` (soft red) | Anything that removes data | Remove, Remove Bottle, Delete, batch remove |
| `ghost` | Low-emphasis inline controls | Collapse toggles, icon buttons in headers |

**Selection tiles / pickers** (choose-one grids like the Remove-Wine reason
picker, venue-type pills): each option shows its distinguishing accent color
at ALL times (usually the icon), not only when selected. Selected state =
that accent as border + background tint. A grid of identical monochrome
tiles is exactly the "all buttons look the same" problem this guide exists
to prevent.

This applies SITEWIDE — any new button or picker, on any page or dialog,
uses these variants. Never introduce ad-hoc color classes on a Button.

## Deployment Checklist

- [ ] `npx next build` passes with no errors
- [ ] No hardcoded secrets in committed files
- [ ] New env vars added to Vercel if needed
- [ ] Database migrations pushed if schema changed
- [ ] `npx vercel --prod` deploys successfully
