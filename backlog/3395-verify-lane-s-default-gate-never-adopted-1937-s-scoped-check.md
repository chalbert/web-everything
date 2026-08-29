---
bornAs: xpace6e
kind: task
status: resolved
dateOpened: "2026-08-29"
dateStarted: "2026-08-29"
dateResolved: "2026-08-29"
tags: []
---

# verify-lane's default gate never adopted #1937's scoped check:standards for a solo lane land

we:scripts/lib/verify-lane-gate.mjs's hardcoded FULL_GATE runs npm run check:standards unscoped at land time, even though #1937 already ratified that a lane's own pre-land check should use the existing --local --files= scoped mode (deferring whole-repo/cross-lane invariants to the central CI gate on the merged tree). #3372 scoped only the vitest half of the same gate; the check:standards half was never updated to match, so a solo lane's landing keeps false-redding on other PRs' transient state (e.g. a not-yet-JIT-numbered backlog file landing on we:main mid-run).

## What is true today

- `we:scripts/lib/verify-lane-gate.mjs`'s `FULL_GATE` constant is `npm run test:unit && npm run
  check:standards`, and `resolveDefaultGate` only ever swaps the **vitest** half for a diff-scoped
  `npx vitest related ...` run (#3372) — the `check:standards` half stays bare/unscoped on every path,
  including the fallback and the shrink case.
- `we:scripts/check-standards.mjs` already has a scoped mode built for exactly this — `--local
  --files=<comma|space list>` demotes path-less GLOBAL/RELATIONAL findings and findings on files outside
  the given set (`we:scripts/readiness/claimScope.mjs`'s `partitionLocal`). It is already used by the
  `/batch` parallel orchestrator, never by the solo `/pr`/`verify-lane` land path.
- #1937 (`#gate-on-merged-tree-lane-fast-fail`, ratified 2026-06-28) already rules that a lane gate is
  not the authority for whole-repo/cross-lane invariants — "an isolated lane tree false-reds on
  whole-repo consistency rules that can't pass without sibling lanes present" — and that the lane may
  only run a scoped fast-fail, with the binding check running once, centrally, on the merged tree (CI).
- Symptom observed live during #3368's landing session (2026-08-29): a solo lane's `verify-lane` run
  failed `check:standards` three times in a row, each time on a **different** unrelated PR's
  not-yet-JIT-numbered backlog file landing on `we:main` mid-run (`strandedHashesOnMain` reads
  `origin/main` directly via `git ls-tree`, independent of the lane's own diff) — despite the lane's own
  diff never touching `backlog/`. #3368's own diff was independently proven clean the whole time
  (targeted tests, a full unscoped `test:unit` pass, and a `check:standards` diff against a clean `main`
  baseline showing 0 new errors/warnings).

## Done when

1. **Executable** — `we:scripts/lib/__tests__/verify-lane-gate.test.mjs` asserts: when the lane's changed
   files (already computed by the existing vitest test-selection decision) contain no `backlog/` path and
   no path matching `we:scripts/lib/gate-config.mjs`'s `isGateSelfPath`/`isPolicyCorePath`, the resolved
   check:standards half of the composed command is `npm run check:standards -- --local
   --files=<those files>`, not the bare unscoped invocation.
2. **The existing fail-safe test still passes, updated rather than deleted** — the current assertion
   that pins a bare `npm run check:standards` (no flags) must be re-targeted at the cases where it is
   still correct to run unscoped: `changedFiles` is `null`/unreadable, empty, or touches a gate-self /
   policy-core path. Both the "scoped" and "fail-safe unscoped" branches need their own asserted case.
3. **No change outside `we:scripts/lib/verify-lane-gate.mjs` and its test.** `we:scripts/pr-land.mjs`,
   `we:scripts/lane-drain.mjs`, the CI workflow, and the marker/CAS logic in `we:scripts/verify-lane.mjs`
   itself are unaffected — the central, unscoped `check:standards` that CI's required check runs against
   the real merged tree is the actual authority and must not change.
4. **A short comment at the check:standards branch cites #1937** — so a future reader sees this is the
   ratified split being applied, not a new/ad-hoc scoping decision.

## Deliberately NOT in scope

- **Not the flaky `we:scripts/operations/__tests__/wake-cli.test.mjs` `spawnSync ETIMEDOUT`** hit in the
  same landing session — that is a subprocess-spawn resource-contention problem under heavy concurrent
  machine load, orthogonal to staleness/scope, and would recur under a scoped run just as under the full
  one. File separately if it is not already tracked (a concurrency cap on simultaneous verify runs, or a
  retry-on-timeout for `spawnSync`-based CLI tests).
- **Not `we:scripts/pr-land.mjs`'s `--require-verified` default, `we:scripts/lane-drain.mjs`'s
  JIT-numbering timing, or the CI workflow.** All three were read and are already correctly designed for
  the problem they each solve; this item narrows only where an already-ratified scoping (#1937) was never
  wired into the one command that still runs unscoped.

## Lineage

Filed 2026-08-29, surfaced by a design-agent investigation launched mid-session while landing #3368,
after that landing hit the exact false-red pattern #1937 already exists to prevent.

## Progress

- Status: implemented, verifying.
- Branch: lane-40 (`we-lane-40`), working tree at `~/workspace/.lanes/web-everything/lane-40`.
- Done:
  - `we:scripts/lib/verify-lane-gate.mjs`: added `canScopeCheckStandards(changedFiles)` — true iff the changed
    set is known + non-empty and touches neither `backlog/` nor a gate-self/policy-core path
    (`isPolicyCorePath` from `we:scripts/lib/gate-config.mjs`). `resolveDefaultGate` now composes the
    check:standards half as `npm run check:standards -- --local --files=<changed>` whenever that holds,
    independently of the vitest half's shrink/full mode (deliberately narrower deny-set than the vitest
    shrink's full sensitive-surface gauntlet — see the file header for why).
  - `we:scripts/lib/__tests__/verify-lane-gate.test.mjs`: re-targeted the fail-safe assertions that used to pin
    a bare `npm run check:standards` (they now assert scoped check:standards alongside a full vitest half where
    applicable), added `canScopeCheckStandards` unit cases (null/empty/backlog/gate-self/blast-radius-but-not-
    policy-core), and empty-changed-set + backlog + policy-core end-to-end fail-safe cases. 16/16 passing.
  - `npm run check:standards` (unscoped — this PR's own diff touches `backlog/`): 0 errors, no new warnings.
- Next: full `npm run test:unit` running in background; once green, run `verify` + `resolve`.
- Notes: no changes outside `we:scripts/lib/verify-lane-gate.mjs` and its test, per Done-when #3.
