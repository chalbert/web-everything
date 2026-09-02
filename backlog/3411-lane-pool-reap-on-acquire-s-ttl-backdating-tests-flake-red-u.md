---
bornAs: x01b2gj
kind: task
status: open
dateOpened: "2026-08-30"
tags: []
scope:
  - we:scripts/lane-pool.mjs
  - we:scripts/lib/lane-lease.mjs
  - we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs
---

# lane-pool-reap-on-acquire's TTL-backdating tests flake red under real host load

we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs backdates a real lease's timestamp past DEFAULT_LEASE_TTL_MINUTES then asserts a fresh acquire reaps it (e.g. case 3b twin, pr-merged axis). Flaked red on 2026-08-30 in verify-lane's full suite twice in a row, on a docs-only backlog markdown PR unrelated to lane-pool, under heavy concurrent host load (multiple lanes + a review session + dev servers running at once). Passes clean in isolation (npx vitest run --changed the file alone, 4s, green). Mirrors #3011's precedent exactly: a real, timing-bound integration test that trips under parallel/contended load, not a real defect in the code it guards.

## Done when

1. **Reproduce first** — run `npx vitest run we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs` under
   real concurrent load (several other suites/lane-pool subprocesses running at once, mirroring tonight's
   host state) enough times to catch it red, and capture what actually differs from the isolated-pass run —
   `backdateLease` itself is a direct file write (not a sleep), so the flake is more likely in the reap
   decision's own subprocess/lock-acquisition path under contention than in the backdating itself. Don't
   guess the mechanism before this step confirms it.
2. **Executable** — once the mechanism is confirmed, a fix (widen a too-tight internal timeout, remove a
   real-wall-clock dependency in favor of an injectable clock, or serialize the contended step) that a
   repeated concurrent-load run no longer reds on. Mirrors #3011's precedent exactly (a load-flaky,
   timing-bound integration test, not a defect in the code it guards).
3. `npm run check:standards` — 0 errors.
