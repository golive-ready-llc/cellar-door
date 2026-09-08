# Self-hosting Cellar Door

You can run your own instance. This guide is honest about what works, what
doesn't, and what it costs.

## What you get vs. the hosted service

| | Self-hosted | [mycellardoor.app](https://mycellardoor.app) |
|---|---|---|
| Full cellar management (racks, slots, inventory, history) | ✅ | ✅ |
| Stats, insurance report, CSV import/export, public API | ✅ | ✅ |
| AI scanning, enrichment, sommelier chat | ✅ **with your own API key** | ✅ included |
| Community ratings (CD Score) | ❌ empty — see below | ✅ |
| iOS / Android apps | ❌ build your own | ✅ |
| Sign-in | single-user (no auth) **or** your own Firebase | ✅ managed |
| Backups, updates, uptime | your problem | handled |

**On AI:** the AI features cost real money per call. Self-hosted, you bring
your own provider key and pay that provider directly. Nothing is crippled —
you just hold the bill.

**On community ratings:** the CD Score is aggregated across all users of the
hosted service. That dataset is not distributed with this code (it's other
people's data). A self-hosted instance starts with an empty community, so
CD Scores will show "–" until your own users rate wines. Your personal
ratings work normally.

---

## Docker (recommended)

The whole stack — app plus its own Postgres — comes up with one command. No
Vercel, no Neon, no managed services.

```bash
git clone https://github.com/YOUR-FORK/cellar-door.git
cd cellar-door
cp .env.docker.example .env
```

Edit `.env` and set the two required values:

```bash
POSTGRES_PASSWORD=<any strong string>
ENCRYPTION_KEY=<output of: openssl rand -hex 32>
```

Then:

```bash
docker compose up -d
```

Open http://localhost:3000. The container creates its schema on first boot
(`prisma db push`, idempotent — safe on every restart) and stores data in the
`pgdata` volume, so it survives `docker compose restart` and upgrades.

Useful commands:

```bash
docker compose logs -f app     # follow logs
docker compose down            # stop (data kept)
docker compose down -v         # stop AND DELETE the database volume
docker compose up -d --build   # rebuild after changing code or NEXT_PUBLIC_* vars
```

**Important:** `NEXT_PUBLIC_*` values are compiled into the browser bundle at
*build* time, not read at runtime. After changing any of them in `.env` you
must `docker compose build` for the change to take effect.

### Authentication: pick one

**Single-user mode (default in `.env.docker.example`)** — set
`NEXT_PUBLIC_SINGLE_USER_MODE=true` and there is no sign-in at all. The app
treats every request as one implicit local owner, created automatically on
first boot. No Google account, no Firebase project, no external service of any
kind.

> ⚠️ **This disables authentication.** Anyone who can reach the server has
> full access to your cellar. That is fine on a LAN, over a VPN/Tailscale,
> behind `SITE_PASSWORD`, or behind your own reverse-proxy auth — but do not
> expose it to the open internet as-is. The server logs a warning at startup
> if you enable it without `SITE_PASSWORD`.

**Firebase** — leave `NEXT_PUBLIC_SINGLE_USER_MODE` blank and configure a
Firebase project instead (see step 3 of the manual install). Use this if you
want real accounts for multiple people.

Switching between them requires `docker compose build`, because the flag is
compiled into the browser bundle.

### Bringing your own database

If you already run Postgres, skip the bundled one and run just the app
container:

```bash
docker build -t cellardoor .
docker run -d -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@your-host:5432/cellardoor" \
  -e ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -e NEXT_PUBLIC_DEFAULT_TIER=PREMIUM \
  cellardoor
```

### What was verified

This setup was built and run end-to-end on Docker 29.5 / Compose v5.1
(Linux, Node 22 Alpine base): image builds, schema provisions on first boot,
`/api/health` reports `{"db":"ok"}`, pages serve, and data survives a
container restart. Single-user mode was verified the same way with NO
Firebase configuration present at all: the app loads straight into the
cellar, creates its owner row, and a wall created through the UI persists
against that owner across a restart. Final image is ~595 MB.

---

## Manual install (no Docker)

Prefer Docker above unless you have a reason not to. Running directly
needs:

- **Node 20+** (Next.js 16 baseline)
- **Postgres** — any instance. [Neon](https://neon.tech) has a usable free tier.
- **Firebase project** — for authentication (free tier is fine)
- **An AI provider key** — optional but recommended (see below)

---

## Quick look (no database, no accounts)

To just see the UI, mock mode runs entirely in memory:

```bash
git clone https://github.com/YOUR-FORK/cellar-door.git
cd cellar-door
npm install
echo 'NEXT_PUBLIC_USE_MOCK=true' > .env.local
npm run dev
```

Open http://localhost:3000. No Postgres, no Firebase, no keys. Data resets on
restart — this is for evaluation, not use.

---

## Real install

### 1. Clone and configure

```bash
git clone https://github.com/YOUR-FORK/cellar-door.git
cd cellar-door
npm install
cp .env.example .env.local
```

`.env.example` is organised by priority — the **REQUIRED** block is the
minimum to boot. Fill that in first.

### 2. Database

Set `DATABASE_URL`, then create the schema:

```bash
npx prisma db push
```

### 3. Authentication (Firebase)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. **Authentication → Sign-in method**: enable Google and/or Email/Password
3. **Project settings → General**: copy the web-app config into the
   `NEXT_PUBLIC_FIREBASE_*` vars (these are public by design — not secrets)
4. **Project settings → Service accounts**: generate a private key and set
   either `FIREBASE_SERVICE_ACCOUNT_KEY` (whole JSON) or the two
   `FIREBASE_ADMIN_*` fields. **These are secrets.**

### 4. Encryption key

```bash
openssl rand -hex 32
```

Set it as `ENCRYPTION_KEY`. This encrypts AI provider keys and Home
Assistant tokens at rest. Without it those are stored in plaintext. Use the
same value everywhere that shares a database.

### 5. Unlock the features (skip Stripe)

Self-hosted, you probably don't want billing. Set:

```
NEXT_PUBLIC_DEFAULT_TIER=PREMIUM
```

This acts as a tier floor on both the client and the server, so every
feature is available without configuring Stripe at all. Leave the
`STRIPE_*` vars blank.

### 6. AI provider (recommended)

Two ways:

- **Env var** — set `GEMINI_API_KEY` and you're done.
- **Admin console** — set `ADMIN_EMAIL` + `NEXT_PUBLIC_ADMIN_EMAIL` to your
  account's email, sign in, and visit `/admin`. You can configure separate
  **text** and **vision** providers with independent failovers. Anything
  OpenAI-compatible works (Gemini, DeepSeek, Alibaba Qwen, OpenRouter,
  Together, local llama.cpp/Ollama behind an OpenAI shim, …). Keys entered
  here are encrypted with `ENCRYPTION_KEY`.

Vision-capable models are required for label/receipt scanning. Text-only
models still power enrichment and chat.

### 7. Run

```bash
npm run dev            # development
npm run build && npm start   # production
```

---

## Mobile apps

The repo includes a [Capacitor](https://capacitorjs.com) shell for iOS and
Android. It is **online-only**: it loads a URL in a WebView rather than
bundling the app.

Point it at your instance in `capacitor.config.ts`:

```ts
server: { url: process.env.CAPACITOR_SERVER_URL || "https://your-domain" }
```

Then `npx cap sync android` (or `ios`) and build in Android Studio / Xcode.
You will need your own signing keys and developer accounts to distribute.
Note that Capacitor 8 uses Swift Package Manager on iOS, not CocoaPods.

---

## Costs, honestly

- **Postgres**: free tier is plenty for personal use
- **Firebase Auth**: free at this scale
- **Hosting**: Vercel's free tier works; anything running Node 20+ does too
- **AI**: the only real cost. Highly variable by provider — a label scan is
  one vision call plus a text call. Cheap providers run fractions of a cent
  per scan; premium models cost meaningfully more. Set your own spend limits
  with your provider.

---

## Support expectations

This is a small project maintained alongside a hosted service. Please read
[CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue.

Briefly: **bug reports about the code are welcome; self-hosting setup is
best-effort.** If your instance won't start, that's usually a credential or
schema issue on your side, and there's a limit to how much of that can be
debugged remotely. Issues that come with a reproduction get much further
than issues that don't.
