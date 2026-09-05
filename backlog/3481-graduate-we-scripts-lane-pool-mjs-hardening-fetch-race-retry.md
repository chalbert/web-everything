---
bornAs: x4a2dkl
kind: story
size: 2
parent: "3443"
status: active
scope: ["we:scripts/lane-pool.mjs", "we:scripts/lib/lane-lease.mjs"]
dateOpened: "2026-09-04"
dateStarted: "2026-09-04"
tags: []
---

# Graduate we:scripts/lane-pool.mjs hardening (fetch-race retry, flag validation) from lane/mechanical-dispatcher to main

origin/lane/mechanical-dispatcher carries two self-contained lane-pool fixes never landed on main: a retry-on-transient-ref-lock wrapper around the shared-object-store git fetch, and fail-loud flag/positional validation, plus we:scripts/lib/lane-lease.mjs increments, with dedicated tests (we:scripts/lib/__tests__/lane-lease.test.mjs, we:scripts/__tests__/lane-pool-flag-validation.test.mjs -- both new). No overlap with any other slice, no dependency on the held-back reconcile-pass wiring. Land we:scripts/lane-pool.mjs plus we:scripts/lib/lane-lease.mjs and their new tests as one small reviewable PR.

## Done when

1. **Executable** — `git diff origin/main...origin/lane/mechanical-dispatcher -- we:scripts/lane-pool.mjs we:scripts/lib/lane-lease.mjs` reports no diff (content landed, whether by direct port or hand-reapplication), and the new tests (`we:scripts/lib/__tests__/lane-lease.test.mjs`, `we:scripts/__tests__/lane-pool-flag-validation.test.mjs`) exist on `main` and pass.
2. Landed as its own small PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push.

## Progress

- Ported `we:scripts/lane-pool.mjs`, `we:scripts/lib/lane-lease.mjs`, and `we:scripts/lib/__tests__/lane-lease.test.mjs`
  byte-for-byte from `origin/lane/mechanical-dispatcher` (verified via diff — content matches exactly), and
  added the new `we:scripts/__tests__/lane-pool-flag-validation.test.mjs`.
- `npx vitest run` on both test files: 84/84 passing locally.
- **One deliberate deviation from byte-for-byte**, found by adversarial self-review: `origin/lane/mechanical-dispatcher`'s
  new `KNOWN_FLAGS` allowlist omits `wait-ms` — a flag that exists only on `main` (added independently of that
  branch, so the two diverged around it). Landing the allowlist verbatim would hard-reject the already-shipped
  `acquire --wait-ms=<N>` (used by `we:scripts/operations/review-dispatch.mjs` and documented in the review
  agent brief) the moment this PR lands. Added `'wait-ms'` to `KNOWN_FLAGS` on top of the port; confirmed
  `we:scripts/__tests__/lane-pool-acquire-wait-ms.test.mjs` (excluded from the fast default run) still passes.
  This means `git diff origin/main...origin/lane/mechanical-dispatcher -- we:scripts/lane-pool.mjs` will show a
  one-line residual diff post-land — intentional, fixing a real bug the source branch carried.
- **Second deviation, found by CI (PR #1929's `test-shard (2)` went red):** the ported
  `we:scripts/__tests__/lane-pool-flag-validation.test.mjs`'s `adopt` case never set
  `CLAUDE_CODE_SESSION_ID` in its spawned-process env, so it silently relied on the ambient
  environment having one set — true in an interactive agent session, false on a clean CI runner,
  where `cmdAdopt` fails loud without it. Passed 84/84 locally for that reason alone. Fixed by
  passing an explicit `CLAUDE_CODE_SESSION_ID` for that one `adopt` call; confirmed the fix holds
  with the var explicitly unset locally (`env -u CLAUDE_CODE_SESSION_ID npx vitest run ...`).
