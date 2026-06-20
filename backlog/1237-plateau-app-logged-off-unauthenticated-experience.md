---
kind: epic
status: resolved
locus: plateau-app
dateOpened: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
relatedReport: reports/2026-06-20-1237-split-analysis.md
tags: [plateau, plateau-app, logged-off, unauthenticated, auth, landing, marketing, pricing, product-build]
---

# Plateau app — logged-off (unauthenticated) experience

Build the public, pre-login surface of plateau-app — everything a visitor sees *before* authenticating: a marketing/landing page, the sign-in / sign-up / sign-out / reset auth flows, a pricing surface, and the supporting public pages (legal, 404). Then flip the app from "everyone is logged-in" to a real authenticated/anonymous split: gate the sidebar product shell behind a re-enabled guard and route logged-off visitors to the public surface. Today the app ships only the authenticated half — `/` is the Dashboard inside the sidebar shell and auth is stubbed-but-disabled.

## Current state (grounding)

The auth machinery is **scaffolded but switched off** — this epic finishes and activates it, then builds the public surface around it:

- [plateau:src/main.ts](../../plateau-app/src/main.ts) — `authStore` (`SimpleStore`, line ~59), a `requireAuth` guard that currently **passes through** ("Sign-in is DISABLED for now", line ~80-86), and `login`/`logout` handlers (line ~115-131) kept "for easy re-enable".
- [plateau:index.html](../../plateau-app/index.html) — a `/login` route template (line ~180-200) and one guarded route `/settings` (`route:guard="requireAuth"`, line ~161). Every other route is ungated; `/` is the authenticated Dashboard.
- **No public shell, no landing/marketing page, no sign-up/reset, no pricing page** exist. The sidebar layout assumes a logged-in user throughout.

## Scope — child slices (SLICED 2026-06-20, `/slice 1237`, [report](../reports/2026-06-20-1237-split-analysis.md))

Phase-1 steer: **login is simulated** so both spaces are navigable locally — no real identity backend (deferred follow-on). #1238 is the root; #1239–#1242 each depend only on it and are mutually independent (true parallel fan-out).

1. **#1238 — Public/app shell split + simulated login** (root) — logged-off layout distinct from the authenticated sidebar shell; re-enable `requireAuth`; mock sign-in/out toggle to navigate both spaces.
2. **#1239 — Landing / marketing page** — public `/` hero + value prop + product overview; the visitor's first screen. (blockedBy #1238)
3. **#1240 — Sign-up + password-reset screens** — registration + reset on the mock `authStore` (sign-in/out itself lands in #1238). (blockedBy #1238)
4. **#1241 — Pricing page** — public pricing surface; reads the open-core rulings (#089–#093, #775) rather than re-deciding them. (blockedBy #1238)
5. **#1242 — Supporting public pages** — legal (terms/privacy), public 404, logged-off nav/footer chrome. (blockedBy #1238)

## Slicing guidance (settle at `/slice 1237` / per-slice prep)

- **Dogfooding:** the public surface is a prime candidate to render from FUI components per the WE-on-FUI dogfood goal (epic #777) — net-new screens with no legacy to migrate. Worth fixing as a constraint when slicing.
- **Auth backend:** the slice-3 prep must settle whether this introduces a real identity provider / session backend or stays on the mock `authStore` (no real credentials). Recommendation: mock-first (POC pragmatism), with a real backend tracked as a separately-prioritised follow-on. If that turns into a genuine fork, carve a `type:decision` item that blocks slice 3 rather than deciding it here.
- **Pricing source of truth:** the pricing slice should *read* the open-core monetization rulings (#089–#093, #775), not re-decide them — monetization is soft-accepted & revisitable, so cite, don't fork.
- This umbrella stays `open` until all five child slices (#1238–#1242) resolve.
