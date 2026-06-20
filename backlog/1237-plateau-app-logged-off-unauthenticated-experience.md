---
type: idea
workItem: epic
size: 8
status: open
locus: plateau-app
dateOpened: "2026-06-20"
tags: [plateau, plateau-app, logged-off, unauthenticated, auth, landing, marketing, pricing, product-build]
---

# Plateau app — logged-off (unauthenticated) experience

Build the public, pre-login surface of plateau-app — everything a visitor sees *before* authenticating: a marketing/landing page, the sign-in / sign-up / sign-out / reset auth flows, a pricing surface, and the supporting public pages (legal, 404). Then flip the app from "everyone is logged-in" to a real authenticated/anonymous split: gate the sidebar product shell behind a re-enabled guard and route logged-off visitors to the public surface. Today the app ships only the authenticated half — `/` is the Dashboard inside the sidebar shell and auth is stubbed-but-disabled.

## Current state (grounding)

The auth machinery is **scaffolded but switched off** — this epic finishes and activates it, then builds the public surface around it:

- [plateau:src/main.ts](../../plateau-app/src/main.ts) — `authStore` (`SimpleStore`, line ~59), a `requireAuth` guard that currently **passes through** ("Sign-in is DISABLED for now", line ~80-86), and `login`/`logout` handlers (line ~115-131) kept "for easy re-enable".
- [plateau:index.html](../../plateau-app/index.html) — a `/login` route template (line ~180-200) and one guarded route `/settings` (`route:guard="requireAuth"`, line ~161). Every other route is ungated; `/` is the authenticated Dashboard.
- **No public shell, no landing/marketing page, no sign-up/reset, no pricing page** exist. The sidebar layout assumes a logged-in user throughout.

## Scope — candidate child slices (UNSLICED — `/slice 1237` before working)

1. **Public shell + routing split** (root) — a logged-off layout distinct from the authenticated sidebar shell; re-enable `requireAuth` to gate the product routes; redirect anonymous→landing and logged-in→app. The other slices depend on this.
2. **Landing / marketing page** — public `/` (or `/home`) hero + value prop + product overview; the visitor's first screen.
3. **Auth flows** — finish & enable sign-in, add sign-up/registration, sign-out, password reset. (Open question: real identity backend vs. continued mock `authStore` — see below.)
4. **Pricing page** — public pricing surface; consumes the open-core tiering rulings (#089–#093, #775 monetization) rather than re-deciding them.
5. **Supporting public pages** — legal (terms/privacy), public 404, any nav/footer chrome for the logged-off shell.

## Slicing guidance (settle at `/slice 1237` / per-slice prep)

- **Dogfooding:** the public surface is a prime candidate to render from FUI components per the WE-on-FUI dogfood goal (epic #777) — net-new screens with no legacy to migrate. Worth fixing as a constraint when slicing.
- **Auth backend:** the slice-3 prep must settle whether this introduces a real identity provider / session backend or stays on the mock `authStore` (no real credentials). Recommendation: mock-first (POC pragmatism), with a real backend tracked as a separately-prioritised follow-on. If that turns into a genuine fork, carve a `type:decision` item that blocks slice 3 rather than deciding it here.
- **Pricing source of truth:** the pricing slice should *read* the open-core monetization rulings (#089–#093, #775), not re-decide them — monetization is soft-accepted & revisitable, so cite, don't fork.
- This umbrella stays `open`; it is not yet sliced into on-disk child items.
