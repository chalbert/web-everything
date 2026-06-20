---
kind: task
parent: "1237"
status: resolved
locus: plateau-app
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: plateau-app/src/main.ts
tags: [plateau, plateau-app, logged-off, auth, shell, routing, simulated-login]
---

# Public/app shell split + simulated login (navigate both spaces locally)

Phase-1 root slice of #1237. Split the app into a logged-off public shell and the existing authenticated sidebar shell, and add a **simulated** sign-in/out toggle so both spaces are reachable locally — no real identity backend. Re-enable the stubbed `requireAuth` guard in [plateau:src/main.ts](../../plateau-app/src/main.ts) (~line 80-86) so product routes gate on `authStore`'s `isLoggedIn`; reuse the existing mock `login`/`logout` handlers (~line 115-131). Add the logged-off layout + redirect logic (anonymous → landing/`/login`, logged-in → app) in [plateau:index.html](../../plateau-app/index.html) and `plateau:src/styles/layout.css`. Demoable: flip the toggle, see both shells. Root of S2–S5.

## Progress

Resolved 2026-06-20 (locus plateau-app). Implemented the public/app shell split + simulated auth toggle:

- **Guard re-enabled** — `plateau:src/main.ts` `requireAuth` now returns `/login` when
  `authStore.isLoggedIn` is false (was the stubbed `return true`).
- **Shell split** — new `syncAuthShell(path)` (plateau:src/main.ts): toggles `.app-shell.logged-off`
  (public shell hides the sidebar via `plateau:src/styles/layout.css`) and redirects across the auth
  boundary — anonymous → `/login`, logged-in-on-`/login` → `/`. Wired into `route-change` (returns early on
  a redirect) and run once on initial load (so an anonymous deep-link to a product route lands on the
  public shell). `updateUserDisplay` also flips `.is-authed` for sign-out visibility.
- **Simulated toggle** — sign-in is the existing `/login` form (reuses the mock `login` handler);
  added a persistent `#signout-btn` in the header (plateau:index.html), wired once to the mock `logout`
  handler, which now navigates back to `/login`. The plateau:src/styles/layout.css shows the button only on `.is-authed`.
- **CSS** — `.app-shell.logged-off` collapses to a single-column public shell (sidebar hidden, login
  card centered); `.btn-signout` styled + hidden on the public shell.

**Verified live (Playwright on the running :4000 dev server, no restart):** anonymous `/settings` →
`logged-off=true`, sidebar hidden, login form shown, redirected to `/login`; simulated sign-in →
`logged-off=false`, sidebar + sign-out visible, at `/`; sign-out → public shell + `/login`. No console
errors. plateau-app gate green: `npm test` 259/259. Root of S2–S5 (#1237).
