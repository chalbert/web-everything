---
kind: task
parent: "1237"
status: resolved
locus: plateau-app
blockedBy: ["1238"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "plateau:src/main.ts"
tags: [plateau, plateau-app, logged-off, auth, sign-up, password-reset]
---

# Sign-up + password-reset screens (on the mock store)

S3 of #1237. Add the remaining unauthenticated auth screens beyond #1238's sign-in/out: a sign-up / registration form and a password-reset request screen, both wired to the **mock** `authStore` (no real backend — registration just flips the simulated session, reset is a stubbed acknowledgement). New route templates in [plateau:index.html](../../plateau-app/index.html) alongside the existing `/login` template (~line 180-200) plus form handlers in [plateau:src/main.ts](../../plateau-app/src/main.ts) mirroring the existing `login`/`logout` pair (~line 115-131). Demoable: navigate from sign-in to sign-up / reset and round-trip through the mock store. Real identity backend is out of scope (deferred follow-on). Independent of S2/S4/S5.

## Progress

Added the remaining unauthenticated auth screens (S3 of #1237) on the mock `authStore`:

- `plateau:index.html` — `/signup` template (name/email/password → "Create account") and `/reset`
  template (email → "Send reset link" + a `role="status"` acknowledgement line); cross-links wired
  between sign-in/sign-up/reset via `route:link`.
- `plateau:src/main.ts` — `handlers.signup` (flips the simulated session from the form + navigates to
  `/`, mirroring `login`) and `handlers.resetRequest` (stubbed acknowledgement, no session change, no
  backend); both wired in `wireRouteHandlers`. Added `/signup` + `/reset` to `PUBLIC_ROUTES`.
- Also wired `wireRouteHandlers()` (and `tryMountLanding()`) into the **initial-load** block: a direct
  deep-link to a public route stamps its template without firing `route-change`, so the forms previously
  had no submit handler until the first in-app navigation (a latent #1238 gap for `/login` too). The
  shared handler refs make the per-route-change call idempotent.

Verified at :4000 (Playwright): deep-link `/reset` → submit shows the acknowledgement; deep-link `/signup`
→ submit flips to the logged-in app shell as the entered user. Plateau gate green (259). Real identity
backend remains out of scope (deferred).
