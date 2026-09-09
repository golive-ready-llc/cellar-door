# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public GitHub
issue, discussion, or pull request for anything security-sensitive.

Email **security@mycellardoor.app** with:

- a description of the issue and its impact,
- steps to reproduce (a proof-of-concept is ideal), and
- the affected version, commit, or URL.

We'll acknowledge your report as soon as we reasonably can and keep you
updated as we investigate. This is a small project maintained alongside a
hosted service, so responses are best-effort rather than SLA-backed — but
security reports are taken seriously and triaged ahead of other work.

Please give us a reasonable window to ship a fix before any public
disclosure. We're happy to credit reporters who'd like acknowledgement.

## Scope

In scope:

- The code in this repository.
- The hosted service at https://mycellardoor.app.

Out of scope:

- Vulnerabilities in third-party dependencies that are already public — though
  a heads-up is still welcome, especially with a suggested upgrade path.
- Findings that require a compromised device, a self-hosted instance the
  reporter controls, or physical access.
- Reports from automated scanners without a demonstrated, exploitable impact.

## Self-hosted instances

If you self-host, you are responsible for your own credentials, patching, and
exposure. See [SELF-HOSTING.md](SELF-HOSTING.md) — in particular, single-user
mode disables authentication and must not be exposed to the open internet
without your own auth in front of it.
