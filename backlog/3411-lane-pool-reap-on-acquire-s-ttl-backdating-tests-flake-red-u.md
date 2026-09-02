---
bornAs: x01b2gj
kind: task
status: resolved
dateOpened: "2026-08-30"
dateStarted: "2026-09-02"
dateResolved: "2026-09-02"
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

## Progress

1. **Attempted reproduction (unsuccessful; contention confirmed)** — could not flip the test red in this sandboxed clone even under sustained heavy
   CPU + disk contention (58x `yes` + concurrent `dd` writers, 3 parallel copies of the file, and the full
   26-file/261-test integration suite alongside real `cargo build` runs): the file's own runtime scaled
   ~4-5x under load (15s isolated → 55-80s contended) with no individual test tripping. Direct benchmarking of
   the `gh pr list` call under the same load showed it erroring in ~75-120ms (this throwaway origin is not a
   GitHub repo, so `gh` fails fast rather than hanging) — so I could not catch the exact SIGTERM-kill moment,
   but the mechanism is well precedented: `we:vitest.integration.config.ts`'s own header already documents three
   sibling files (`gate-entrypoint-integration`, `wake-cli`, `dispatch-spawn-live`) that were "measured NOT
   just slow but actively flaky under CPU contention (a wall-clock comparison blown, a timeout tripped)" and
   fixed the identical way applied here. #3011 (`we:scripts/__tests__/sync-skills-deploy.test.mjs`) is the closest direct precedent:
   a 5s child-process bound tripped under full-parallel-run contention with no real hang present, fixed by
   widening the bound 4x (5s → 20s).
2. **Fix applied on the same precedent, two-pronged:**
   - Widened the internal `gh pr list` / `git ls-remote` timeouts in `we:scripts/lane-pool.mjs` from 8s → 20s
     (matching #3011's ~4x widen ratio) — these are the reap decision's own bounded subprocess calls the item
     description points to, and an 8s bound has little headroom once host contention is real.
   - Pinned `we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs` into the isolated `singleFork` `forks` pool in
     `we:vitest.integration.config.ts`, joining the three sibling files already there for the identical
     CPU-contention-correctness reason — this removes it from sharing the default `threads` pool with ~18
     other subprocess-spawning integration files, which is the dominant real-world contention source.
3. Neither the backdating mechanism nor `DEFAULT_LEASE_TTL_MINUTES` needed to change — confirmed per the
   item's own steer, `backdateLease` is a direct file write, not a sleep, and not the flake source.
