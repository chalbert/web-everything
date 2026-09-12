---
kind: story
size: 5
parent: "3637"
status: active
scaffoldedBy: "3637-poc-fast-lander"
dateScaffolded: "2026-09-12"
blockedBy: ["3637"]
scope: ["we:scripts/operations/poc-land.mjs", "we:scripts/lib/poc-branches.mjs", "we:scripts/readiness/drain-lock.mjs", "we:scripts/lib/lane-lease.mjs", "we:scripts/check-backlog-item.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:skills-src/conveyor/delivery-agent-brief.md"]
dateOpened: "2026-09-12"
tags: []
---

# Build the POC fast-lander and the poc-branches registry

A lock-serialized, fast-forward-only lander that lands a lane's commits onto a registered POC branch with no review tax, plus the poc-branches registry and the deliveryTarget frontmatter field that names the target.

This is the follow-on build `#3637`'s ruling named and deliberately did not build. That decision settled the
design (transport **A′**, the `deliveryTarget:` field, and the registry built now rather than deferred); this
item is the implementation, including the blockers `#3637`'s own survey found.

## What this builds

- **`we:scripts/lib/poc-branches.mjs` + `we:scripts/lib/poc-branches.json`** — the registry. Pure core
  (validate / normalize / find / upsert / remove / the `deliveryTarget:` predicate) over a JSON table, with a
  thin read/write IO shell. Follows `we:scripts/lib/constellation-repos.mjs`'s small-typed-registry shape: a
  frozen table and lookups that FAIL CLOSED (an unknown branch is `null`, never a silent fall back to `main`).
  Each entry carries the four fields doctrine rule 10(c) names — branch, graduation target, scope, graduation
  item — plus `purpose` and `owner`, so a branch names what it is for and who graduates it.
  `lane/mechanical-dispatcher` is registered as the first real entry.
- **`we:scripts/operations/poc-land.mjs`** — the fast-lander. A plain module with injected IO plus a CLI block
  (`we:scripts/operations/dispatch-abort.mjs`'s shape, not the `op()` engine). Verifies once outside the lock,
  then inside the branch's own write lock: fetch the tip → fast-forward push if it has not moved → otherwise
  rebase onto it, re-run the tests and retry, bounded at 3 attempts. Never `--force`, ever.
- **`withPocLandLock` in `we:scripts/readiness/drain-lock.mjs`** — the per-branch, per-repo write lock, built
  on the existing `O_EXCL` + TTL lease primitive rather than a new one. Its one contract difference from
  `withLandWriteLock`: it does NOT degrade to running unlocked on contention.
- **`deliveryTarget:` frontmatter** — validated against the registry at filing time by the shared rule module,
  so the whole-repo gate and the scoped per-item lint agree; resolved and re-validated on the dispatch path.
- **The blockers** — `assertMainNotStale` takes its target as a parameter; the brief's literal `--base=main`
  becomes `{{DELIVERY_BASE}}`; the lane lease persists `--base`; the two duplicated drift-constant blocks
  collapse into one registry read.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/poc-branches.test.mjs
   we:scripts/operations/__tests__/poc-land.test.mjs we:scripts/readiness/__tests__/drain-lock.test.mjs`
   passes, covering the five cases the ruling names: fast-forward success, rebase-and-retry, bounded-retry
   exhausted, lock serialization between two landers on one branch, and the registry read/write round-trip.
2. **Executable** — `node we:scripts/operations/poc-land.mjs --branch=lane/never-declared --json` exits
   non-zero with `not-registered` and touches no git: an undeclared branch is a refusal, per doctrine rule
   10(c).
3. **Executable** — `npm run check:standards` reports 0 errors, and a backlog item carrying an unregistered
   `deliveryTarget:` is one of the errors it would report.
4. **Observable** — `we:skills-src/conveyor/delivery-agent-brief.md` contains no literal `--base=main`, and a
   POC-targeted build's filled brief tells the agent to run `we:scripts/operations/poc-land.mjs` instead of
   opening a PR.
