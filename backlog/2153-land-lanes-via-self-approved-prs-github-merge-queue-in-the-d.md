---
kind: story
size: 5
status: open
blockedBy: ["2165"]
relatedTo: ["2123", "2138", "2152", "2160"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
tags: [lane, pr-flow, integrator, session-tooling]
---

# Land lanes via self-approved PRs / GitHub merge queue in the drain command

Implements the self-approved-PR substrate for the #2138 drain: instead of a local git merge + push origin main, each ready lane opens a self-approved PR (gh pr create) and the merge/monitor session drains via gh pr merge — pulling, rebasing, resolving conflicts when GitHub reports the branch unmergeable. **#2138 Fork 5 (ruled): the custom drain owns every merge in impl-first/WE-last order; GitHub's native merge queue stays OFF** (it would reorder couples). PRs are the review/CI surface, not an autonomous merge mechanism; local `git merge` is the fallback. gh-authed (`chalbert`).

## Blocked / investigation (2026-07-02, batch-2026-07-02-2152-2153)

#2152 is **done** (branch protection live: required check `test`, 0 approvals, `enforce_admins:false`). This item is **blocked on #2165** (updated 2026-07-02, batch-2026-07-02-2160-2161-2163): the required `test` check is **red on origin/main**, so a self-approved PR can never satisfy it → `gh pr merge` cannot complete → the substrate is un-landable and un-verifiable end-to-end until origin CI is green. **#2160 (done) fixed one CI-red cause** (untracked `relatedReport` files) but origin CI stayed red on a **second, pre-existing cause**: ~15 vitest files fail to resolve `@frontierui/*` sibling-alias imports on single-repo CI — now filed as **#2165** (WE↔FUI single-repo coupling, #2158 family). Verifying this item also needs a **live PR round-trip** (mutates `main`), so it wants its own focused session once #2165 clears, not a batch seam. Implementation note when unblocked: the substrate lives in the existing landing path — the inline integrator's `git merge --no-ff origin/lane/* → push-if-green` in `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` + `we:scripts/push-if-green.mjs` (the shared land helper) — swap `git merge + push origin main` for `gh pr create --fill` (self-approved) + `gh pr merge` in impl-first/WE-last order; keep `git merge` as the fallback.
