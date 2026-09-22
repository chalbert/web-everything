---
kind: story
size: 3
parent: "3443"
status: open
scope: ["we:vitest.setup.ts", "we:vitest.config.ts", "we:vitest.integration.config.ts", "we:scripts/readiness/heavy-admission.mjs", "we:scripts/readiness/__tests__/heavy-admission.test.mjs", "we:scripts/readiness/file-locks.mjs", "we:scripts/readiness/__tests__/file-locks.test.mjs", "we:skills-src/batch-backlog-items/parallel-execute.workflow.js", "we:scripts/__tests__/parallel-execute-workflow.test.mjs", "we:.gitignore", "we:package-lock.json", "we:scripts/operator/converge.py", "we:skills-src/drain/SKILL.md"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate test setup, heavy-command admission and file-locks changes from lane/mechanical-dispatcher to main

Ports the vitest setup/config, we:scripts/readiness/heavy-admission.mjs, we:scripts/readiness/file-locks.mjs, the parallel-execute workflow and small doc/config diffs, plus their tests. Graduation slice of epic #3443, split out of #3487 on 2026-09-22. FAITHFUL PORT: no behaviour change; port from snapshot ff1618065 of origin/lane/mechanical-dispatcher and diff-merge every file main has also changed (see the merge notes on this card). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

### S1 — test infra + heavy-command admission + docs (size 3)

**Blockers:** none.

**Files (incl. tests):**
- `we:vitest.setup.ts`, `we:vitest.config.ts`, `we:vitest.integration.config.ts`
- `we:scripts/readiness/heavy-admission.mjs`, `we:scripts/readiness/__tests__/heavy-admission.test.mjs`
- `we:scripts/readiness/file-locks.mjs`, `we:scripts/readiness/__tests__/file-locks.test.mjs`
- `we:skills-src/batch-backlog-items/parallel-execute.workflow.js`, `we:scripts/__tests__/parallel-execute-workflow.test.mjs`
- `we:.gitignore`, `we:package-lock.json` (license MIT→Apache-2.0, matches main's `we:package.json`)
- `we:scripts/operator/converge.py`, `we:skills-src/drain/SKILL.md` (comment/doc-only)

**Branch commits:** `35849f23f` (heavy-admission `run` mode), `b4d65d88b` (parallel batch through `run`), `8983b136a` (slot reentrancy by process identity; heavy-admission + file-locks), heavy-admission half of `76cea45c1` (`partitionWaiting` ghost-marker fix), vitest half of `7ee2ba6f0` / `ab7ac270c`, `.gitignore` lines from `5fbc2dd53` / `373f14af1` / `39b88e26f` / `2acd6c567` / `6bc909866`, `3f78e4cc3` / `1afc7242b` (drain we:skills-src/drain/SKILL.md), `7d7a4ce9a` (converge.py note). `2c2b554c6` is already on main as `bf556fe5a` (#3679).

**Why the seam is clean:**
- `we:vitest.setup.ts` only sets env (`WE_COORDINATION_ROOT` temp dir per test, `WE_TELEMETRY=0`). Both are inert on main until #3901 / #3895 land, and landing it first gives those slices' tests isolation.
- `8983b136a` spans heavy-admission + file-locks, both in this slice. The runner half of `76cea45c1` is a `tickMetrics` comment only (S4).
- `we:scripts/conveyor/tick-core.mjs` reads admission status via the CLI's `waiting` field, which works with either shape, so S2 does not depend on S1.
- `.gitignore` additions are ignore lines only (harmless before their owning modules land).

**Merge notes:**
- `we:.gitignore` — clean 3-way (main `21ee7d6f9` touched other lines).
- `we:vitest.config.ts` — clean (adds `setupFiles: ['we:vitest.setup.ts']`).
- `we:scripts/readiness/file-locks.mjs` — 1 region vs main `d622b4d80` (#xaipsbs): keep main's entryless-lock-dir grace block (`lockDirAgeMs` / `ENTRYLESS_LOCK_DIR_GRACE_MS`), then the branch's `reclaimDecision(current, nowMs, owner, pidLiveness, leaseMinutes, requireOwnProcess ? pid : null)`. Test merges clean.
- `we:scripts/readiness/heavy-admission.mjs` — 6 regions; a semantic overlap with main's `d622b4d80` (#xaipsbs / #3785), which independently built the stale-waiter reap (`classifyWaiter`, `reapStaleWaiters`, `reapHistory`, `reap` CLI), `admissionBypassReason`, `admittedArgv` / `admittedShellCommand`, and its own `run` wrapper. **Ruled resolution:**
  - Main's machinery is the base (live callers: `we:scripts/pr-land.mjs`, `we:scripts/readiness/test-selection.mjs`, `we:scripts/operations/mutation-check-io.mjs`, `we:scripts/dev/regression.mjs`).
  - Add the branch's exports `partitionWaiting`, `pruneStaleWaiting`, `WAITING_STALE_GRACE_MS` (branch test + #3899 need them).
  - `markWaiting`: union signature `{ ..., pid = process.pid, repo = null }`, body `{ owner, lane, num, pid, requestedAt, host, repo }`.
  - Acquire path: keep main's reap; DROP the branch's extra `pruneStaleWaiting(...)` call before `markWaiting` (no second, looser reaper).
  - `admissionStatus`: branch shape — `waiting` = live waiters, `staleWaiting` = array of stale markers — plus main's `reaped: reapHistory(lockRoot)`. Change main's no-lock-root `status` emit from `staleWaiting: 0` to `staleWaiting: []`, and update main's matching test assertion.
  - Keep main's `run` wrapper header/body (container `exec` seam, bypass, re-entrancy env) and `admittedArgv` / `admittedShellCommand`.
- `we:scripts/readiness/__tests__/heavy-admission.test.mjs` — 1 region: both sides appended `describe` blocks at EOF; keep both.
- `we:skills-src/batch-backlog-items/parallel-execute.workflow.js`, `we:package-lock.json`, `we:vitest.integration.config.ts`, `we:scripts/operator/converge.py`, `we:skills-src/drain/SKILL.md` — main untouched since the base; apply as-is.
