<div align="center">

# Cellar Door

**A wine collection manager that knows where every bottle physically is.**

[![License: FSL-1.1-ALv2](https://img.shields.io/badge/License-FSL--1.1--ALv2-blue.svg)](LICENSE)

[Hosted service](https://mycellardoor.app) · [Self-hosting](SELF-HOSTING.md) · [Contributing](CONTRIBUTING.md)

</div>

---

Most wine apps are catalogs — a list of what you own. Cellar Door models the
**physical cellar**: walls, racks, cabinets, rows, columns, and depth. When
the app says a bottle is in Row 10, Column 6, you can walk over and pick it
up.

On top of that it does the things you'd expect from a modern wine app —
label scanning, ratings, drink windows, stats — plus a few you wouldn't.

## Features

**Physical cellar management**
- Visual rack/slot grid with drag-and-drop placement, multi-bottle depth,
  and bulk-storage zones
- **Sort Assistant** — groups your bottles and walks you through
  rearranging them one move at a time, lighting up the destination slot
- Deep-link to any bottle's location from anywhere in the app

**AI-powered** (bring your own API key when self-hosting)
- Scan a wine label, a barcode, a restaurant wine list, or a purchase
  invoice — the invoice scan reads quantities and prices
- Automatic enrichment: region, grape, drink window, food pairings,
  estimated critic scores
- Sommelier chat that knows your actual cellar
- Terroir Twins, decant timing, vintage context, pour-cost planning

**Tracking & insight**
- Personal ratings and community CD Scores
- Taste Profile — what you like and don't, by style, region, and grape
- Stats, value tracking, drinkability reports, insurance export
- Full history of every bottle consumed, gifted, or sold

**Platform**
- Mobile-first, installable, with iOS/Android shells via Capacitor
- CSV import/export and a public REST API

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 + shadcn/ui ·
Prisma + Postgres · Firebase Auth · Stripe · pluggable AI providers
(Gemini / DeepSeek / Qwen / any OpenAI-compatible endpoint)

## Try it in 30 seconds

```bash
git clone https://github.com/golive-ready-llc/cellar-door.git
cd cellar-door
npm install
echo 'NEXT_PUBLIC_USE_MOCK=true' > .env.local
npm run dev
```

Open http://localhost:3000 — no database, no accounts, no API keys.

Or run the real thing with Docker (app + Postgres, no other services):

```bash
cp .env.docker.example .env    # then set DATABASE_URL creds and a password
docker compose up -d
```

For a real install — including a **single-user mode** with no sign-in at
all — see **[SELF-HOSTING.md](SELF-HOSTING.md)**.

## Self-hosting vs. the hosted service

The code here is complete and self-hostable. Two things don't travel with
it, and it's worth being upfront about them:

- **AI costs money per call.** Self-hosted, you bring your own provider key
  and pay that provider directly. Nothing is feature-crippled — set
  `NEXT_PUBLIC_DEFAULT_TIER=PREMIUM` and every feature unlocks without
  Stripe.
- **Community ratings are other people's data.** The CD Score dataset is
  aggregated from hosted-service users and isn't distributed here, so a new
  instance starts with an empty community.

Subscriptions to [mycellardoor.app](https://mycellardoor.app) pay for
exactly those two things plus hosting — not for access to the source.

## License

[FSL-1.1-ALv2](LICENSE) — the [Functional Source License](https://fsl.software).
It's **source available**, not OSI open source: you can read, run, modify,
self-host, and redistribute the code for any purpose *except* a Competing Use
(offering it to others as a commercial product or service that substitutes for
Cellar Door). Each release automatically becomes **Apache-2.0 two years** after
it ships. The "Cellar Door" name and logo are trademarks and are not licensed —
see [NOTICE](NOTICE); brand your own fork.

The **name and logo are not covered** by that grant — if you run your own
instance publicly, please brand it as your own. See [NOTICE](NOTICE).

Contributions require a CLA so the project can continue to be offered both
under the FSL and commercially — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Support expectations

This is a small project maintained alongside a commercial service. Bug
reports with reproductions are welcome; self-hosting setup help is
best-effort. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

---

<div align="center">
<sub>Copyright © 2026 Golive Ready, LLC</sub>
</div>
