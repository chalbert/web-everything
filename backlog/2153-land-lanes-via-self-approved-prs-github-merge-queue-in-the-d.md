---
kind: story
size: 5
status: resolved
blockedBy: ["2165"]
relatedTo: ["2123", "2138", "2152", "2160"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: none
tags: [lane, pr-flow, integrator, session-tooling]
---

# Land lanes via self-approved PRs / GitHub merge queue in the drain command

Implements the self-approved-PR substrate for the #2138 drain: instead of a local git merge + push origin main, each ready lane opens a self-approved PR (gh pr create) and the merge/monitor session drains via gh pr merge — pulling, rebasing, resolving conflicts when GitHub reports the branch unmergeable. **#2138 Fork 5 (ruled): the custom drain owns every merge in impl-first/WE-last order; GitHub's native merge queue stays OFF** (it would reorder couples). PRs are the review/CI surface, not an autonomous merge mechanism; local `git merge` is the fallback. gh-authed (`chalbert`).

## Blocked / investigation (2026-07-02, batch-2026-07-02-2152-2153)

#2152 is **done** (branch protection live: required check `test`, 0 approvals, `enforce_admins:false`). This item is **blocked on #2165** (updated 2026-07-02, batch-2026-07-02-2160-2161-2163): the required `test` check is **red on origin/main**, so a self-approved PR can never satisfy it → `gh pr merge` cannot complete → the substrate is un-landable and un-verifiable end-to-end until origin CI is green. **#2160 (done) fixed one CI-red cause** (untracked `relatedReport` files) but origin CI stayed red on a **second, pre-existing cause**: ~15 vitest files fail to resolve `@frontierui/*` sibling-alias imports on single-repo CI — now filed as **#2165** (WE↔FUI single-repo coupling, #2158 family). Verifying this item also needs a **live PR round-trip** (mutates `main`), so it wants its own focused session once #2165 clears, not a batch seam. Implementation note when unblocked: the substrate lives in the existing landing path — the inline integrator's `git merge --no-ff origin/lane/* → push-if-green` in `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` + `we:scripts/push-if-green.mjs` (the shared land helper) — swap `git merge + push origin main` for `gh pr create --fill` (self-approved) + `gh pr merge` in impl-first/WE-last order; keep `git merge` as the fallback.

## Progress — resolved 2026-07-02 (batch-2026-07-02-2160-2161-2163)

Unblocked once #2165 landed (CI green). Shipped the substrate as a standalone helper:

- **`we:scripts/pr-land.mjs`** — the PR analogue of `we:scripts/push-if-green.mjs` (same flag/`emit`/exit-code conventions). Publishes a lane clone's HEAD to a `lane/*` ref (the #1934 guard carve-out — **no local branch**, never `--force`), opens a **self-approved PR** (`gh pr create --fill`, no reviewer — 0 approvals + the required `test` check from #2152), **waits for the required check** (`gh pr checks`, polling; a red check ABORTS — never merges a red PR), then merges ONE PR (`gh pr merge --merge --delete-branch`). The **drain (#2162) owns couple-order** — this is deliberately NOT `gh pr merge --auto` on GitHub's native queue (which is branch-level and would reorder couples, #2138 Fork 5). Retains the `git merge --no-ff` + push **fallback** (`--fallback-git`, #2138 Fork 5 (a)) for when `gh` is unavailable or a PR is unmergeable. `--dry-run` prints the exact command sequence.
- **Pure helpers unit-tested** (`we:scripts/__tests__/pr-land.test.mjs`, 7 green): `buildCreateArgs` (self-approved, no `--reviewer`), `buildMergeArgs` (one-PR, `--delete-branch`, no `--auto`), `classifyChecks` (pass→merge / fail→abort / pending→wait), `mergeMethodFlag`, + source-guards (lane/* only, no `--force`, aborts on red check).
- **Live-verified end-to-end:** this very item was **landed via `we:scripts/pr-land.mjs` itself** (dogfood) — self-approved **PR #9** from its `lane/*` ref, required `test` check green, merged to `main` (`97458aac`), mirroring how #2165 landed via PR #4.
- **Robustness fix the live run surfaced:** the first attempt merged too early — a fresh PR's `gh pr checks` list is momentarily empty, which naively read as "passed." Fixed to gate the merge on GitHub's authoritative **`mergeStateStatus`** (`CLEAN`/`UNSTABLE` + all *required* checks green), so a non-required check (`cla`) never blocks and a pending/unregistered required check never races the merge. `BEHIND` (strict up-to-date) and `DIRTY` (conflict) abort recoverably. Landed as its own self-approved PR.

**Boundary with #2162:** the drain/monitor command wires `we:scripts/pr-land.mjs` as its per-lane transport (choosing it vs the `git merge` fallback) and sequences impl-first/WE-last across a couple — this item ships the transport, #2162 the orchestration.
