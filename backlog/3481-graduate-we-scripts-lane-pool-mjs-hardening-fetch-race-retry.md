---
bornAs: x4a2dkl
kind: story
size: 2
parent: "3443"
status: active
scope: ["we:scripts/lane-pool.mjs", "we:scripts/lib/lane-lease.mjs"]
dateOpened: "2026-09-04"
dateStarted: "2026-09-05"
tags: []
---

# Graduate we:scripts/lane-pool.mjs hardening (fetch-race retry, flag validation) from lane/mechanical-dispatcher to main

origin/lane/mechanical-dispatcher carries two self-contained lane-pool fixes never landed on main: a retry-on-transient-ref-lock wrapper around the shared-object-store git fetch, and fail-loud flag/positional validation, plus we:scripts/lib/lane-lease.mjs increments, with dedicated tests (we:scripts/lib/__tests__/lane-lease.test.mjs, we:scripts/__tests__/lane-pool-flag-validation.test.mjs -- both new). No overlap with any other slice, no dependency on the held-back reconcile-pass wiring. Land we:scripts/lane-pool.mjs plus we:scripts/lib/lane-lease.mjs and their new tests as one small reviewable PR.

## Done when

1. **Executable** — `git diff origin/main...origin/lane/mechanical-dispatcher -- we:scripts/lane-pool.mjs we:scripts/lib/lane-lease.mjs` reports no diff (content landed, whether by direct port or hand-reapplication), and the new tests (`we:scripts/lib/__tests__/lane-lease.test.mjs`, `we:scripts/__tests__/lane-pool-flag-validation.test.mjs`) exist on `main` and pass.
2. Landed as its own small PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push.
