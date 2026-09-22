---
bornAs: x3pkdii
kind: story
size: 3
parent: "3443"
status: open
scope: ["we:scripts/conveyor/driver-watchdog.mjs", "we:scripts/conveyor/driver-mode.mjs", "we:scripts/conveyor/__tests__/driver-watchdog.test.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Graduate we:scripts/conveyor/driver-watchdog.mjs and we:scripts/conveyor/driver-mode.mjs (new modules) from lane/mechanical-dispatcher to main

Graduation slice 1 of 6 for the land-advance operation (also the first step of the reaper slice chain in #3443). Two wholly new modules missing from main: we:scripts/conveyor/driver-watchdog.mjs (890 lines; exports resolvePidAlive, scanPsOutput, defaultIsPidAlive) and we:scripts/conveyor/driver-mode.mjs (145), with we:scripts/conveyor/__tests__/driver-watchdog.test.mjs (1215 lines; there is no separate driver-mode test on the branch). Self-contained: queue-store, resolve-runner-checkout and runner-lock are on main unchanged, and the five named imports from branch-sync are all exported by main's differing branch-sync. The test also imports dispatch-lane (on main, differs) and the import-graph helper (on main). It also unblocks the lease-reaper liveness read. Independent of the other five slices.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/driver-watchdog.test.mjs` passes ON `main` after the port, and `git diff origin/main...origin/lane/mechanical-dispatcher -- we:scripts/conveyor/driver-watchdog.mjs we:scripts/conveyor/driver-mode.mjs we:scripts/conveyor/__tests__/driver-watchdog.test.mjs` reports nothing.
2. `npm run check:standards` reports 0 errors.
3. Landed as its own PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push.

## Order and port notes

- Part of the six-slice land-advance graduation under #3443. No blockers: this slice can land first, in parallel with the tools (2) and ci-heal (4) slices. The IO and wiring slice (6) needs it, because `we:scripts/operations/land-advance-io.mjs` imports the watchdog. Order across the six: tools (2) → land-advance core (5) → session-verdicts (3); watchdog (1) and ci-heal (4) independent; IO and wiring (6) last.
- Under the #3804 statute (`we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync`) a graduation slice ports a file main has moved AS A DIFF and is exempt from the drift hold. Shared modules that exist on `main` with a different body and that this slice imports from: `we:scripts/conveyor/branch-sync.mjs` (five named imports, all exported on `main`) and `we:scripts/operations/dispatch-lane.mjs` (one named import in the test, exported on `main`). Do NOT overwrite either with the branch copy; if a test disagrees, diff-merge only the hunk it needs and name it in the PR. `we:scripts/conveyor/queue-store.mjs`, `we:scripts/conveyor/resolve-runner-checkout.mjs` and `we:skills-src/conveyor/runner-lock.mjs` are identical on both sides.
- The two new modules total 1035 lines and the test 1215, so the review is long but mechanical: all three files are new on `main`, so there is no existing file to merge into.
