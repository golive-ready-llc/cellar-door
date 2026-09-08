# Contributing to Cellar Door

Thanks for your interest. This document sets expectations honestly so
nobody wastes their time.

## What this project is

Cellar Door is a small project developed alongside a commercial hosted
service at [mycellardoor.app](https://mycellardoor.app). The code is
source-available under the Functional Source License (FSL-1.1-ALv2); the
hosted service, the community rating dataset, and the brand are not (see
[NOTICE](NOTICE)).

That shapes what contributions fit:

**Welcome**
- Bug fixes, with a reproduction
- Accessibility and performance improvements
- Test coverage
- Documentation and self-hosting fixes
- Small, focused features that fit the existing product direction

**Please ask first** (open an issue before writing code)
- Anything that changes the data model or public API
- New dependencies
- Large refactors
- New features — the product has a direction, and a rejected PR after a
  weekend of work is a bad outcome for everyone

**Out of scope**
- Changes that exist only to remove tier gating. You do not need to patch
  anything: set `NEXT_PUBLIC_DEFAULT_TIER=PREMIUM` and every feature is
  unlocked on your own instance. See [SELF-HOSTING.md](SELF-HOSTING.md).

## Contributor License Agreement (required)

**Before a pull request can be merged, you must sign the
[CLA](CLA.md).** Signing is the checkbox in the pull-request template;
the PR record is the signed copy.

Why: the maintainer needs to retain the right to license this code both
under the FSL and commercially. If contributions arrived under the FSL alone,
that option would disappear the moment the first PR landed, permanently and
irreversibly. The CLA asks you to grant those rights while you keep the
copyright to your own work.

If you would rather not sign, that's completely reasonable — please open an
issue describing the fix instead. A well-described bug is genuinely valuable
and doesn't require any agreement.

## Development

```bash
npm install
cp .env.example .env.local     # see SELF-HOSTING.md
npm run dev
```

For a quick look with no database or credentials, set
`NEXT_PUBLIC_USE_MOCK=true`.

## Before you open a PR

Every change must pass all four gates:

```bash
npx tsc --noEmit     # must be clean
npm run lint         # must be 0 errors
npm test             # all tests must pass
npx next build       # must compile
```

Notes:
- **Lint warnings**: the repo carries a known set of
  `react-hooks/set-state-in-effect` warnings on pre-existing hydration
  effects. Zero *errors* is the bar; don't feel obliged to chase warnings.
- **Tests**: add coverage for what you change. Never weaken an existing
  assertion to make a build pass — if a test now fails, decide whether it's
  a stale test or a real regression, and say which in the PR.
- **Verify at runtime**: the `/demo` route runs seeded, auth-free data and
  is the fastest way to check UI changes.

## Code conventions

- **Reuse before building.** This codebase has shared primitives —
  `WineListItem` (the canonical row), `WineDetailBody` (the shared detail
  layout), `StarRating`, `EmptyState`, `PageHeader`. Grep before adding a
  new component; several "missing" features already exist unused.
- **Comments explain *why*, not what.** Especially for non-obvious fixes.
  This codebase documents root causes inline, and that convention has paid
  for itself repeatedly.
- **Commit messages are substantive** — root cause and reasoning, not
  "fix bug".
- **Mobile-first, dark-first.** The app runs primarily in a mobile WebView
  on a dark theme. Verify at 375–430px width, and never make a primary
  action hover-only.

## Reporting bugs

Include:
- What you expected vs. what happened
- Steps to reproduce (this is the difference between a fixed bug and a
  closed issue)
- Hosted service or self-hosted? Which browser/device?
- Console errors, if any

## Security

**Do not open a public issue for security problems.** Email
security@mycellardoor.app instead, and please give a reasonable window to
ship a fix before disclosing.
