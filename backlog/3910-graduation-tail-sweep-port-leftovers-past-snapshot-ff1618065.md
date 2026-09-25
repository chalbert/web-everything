---
bornAs: xchvd5s
kind: task
parent: "3443"
status: open
blockedBy: ["3487", "3862", "3863", "3485", "3894", "3899", "3896", "3900", "3909", "3904", "3905", "4178", "4180"]
scope: ["we:agent-memory-src/index-meta.md", "we:docs/agent/backlog-workflow.md", "we:docs/agent/dispatcher-runbook.md", "we:docs/agent/platform-decisions.md", "we:docs/agent/testing.md", "we:scripts/conveyor/run-scorecards.json", "we:backlog/3443-graduate-origin-lane-mechanical-dispatcher-to-main-in-small.md", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs", "we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs", "we:scripts/lib/__tests__/review-escalation.test.mjs", "we:scripts/operations/__tests__/review-pr.test.mjs", "we:scripts/conveyor/__tests__/autofix-review-findings.test.mjs", "we:scripts/conveyor/__tests__/fix-autofix-gate.test.mjs", "we:scripts/conveyor/__tests__/parked-pr-conflict-dispatch-integration.test.mjs", "we:scripts/__tests__/pr-land.test.mjs", "we:scripts/__tests__/lane-verify.test.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduation tail sweep: port leftovers past snapshot 6a2c8c1ab, docs, and close #3443

Last slice of epic #3443. (1) Re-diff origin/main against the branch tip, which will have moved past snapshot 6a2c8c1ab while the other slices landed; port every remaining code change faithfully (no behaviour change), or file a follow-up slice if it is large. (2) Port the branch's doc changes (we:AGENTS.md, we:agent-memory-src/index-meta.md, we:docs/agent/backlog-workflow.md, we:docs/agent/dispatcher-runbook.md, we:docs/agent/platform-decisions.md, we:docs/agent/testing.md) as diffs onto main's current text. (3) we:scripts/conveyor/run-scorecards.json is runtime data, not code: record it as intentionally not ported. (4) Fold the branch-only #3383 and #3105 card narrative into main's cards by hand. (5) Resolve #3443 with the note Done-when 1 asks for. Hold lifted 2026-09-24: the #3857 model-tier table passed a live probe and the operator started wave A.

## Done when

1. **Executable** — `node --check` passes for , and every declared file exists on main.
2. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
3. **Faithful port** — for each ported file, `git diff 600acc14f -- <file>` (prototype snapshot vs main after the port) shows only main's own later changes kept by the merge notes, never a behaviour change of the branch code; runtime data files (e.g. `we:scripts/conveyor/run-scorecards.json`) are never edited.

## Graduation import check

- 2026-09-25: graduation-import-check moved `we:AGENTS.md` to #4180 — #4180's `we:scripts/check-standards.mjs` needs it directly, and this card already (transitively) depends on #4180, so a blockedBy edge the other way would cycle.
- 2026-09-25: graduation-import-check moved `we:scripts/__tests__/lane-verify.test.mjs` here from #4178 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/__tests__/pr-land.test.mjs` here from #3915 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/conveyor/__tests__/parked-pr-conflict-dispatch-integration.test.mjs` here from #3908 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/conveyor/__tests__/fix-autofix-gate.test.mjs` here from #3908 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/conveyor/__tests__/autofix-review-findings.test.mjs` here from #3908 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/review-pr.test.mjs` here from #3907 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/lib/__tests__/review-escalation.test.mjs` here from #3907 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/dispatch-lane.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-25: graduation-import-check added we:scripts/operations/run.mjs to this card's own scope — no open card owned it, and it is imported by `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs`, which this card ports.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs` here from #3903 — it imports a module this card owns.

## Snapshot moved to 6a2c8c1ab; two new tail cards filed (2026-09-25)

Added `4178` and `4180` to `blockedBy` — both are post-snapshot tail cards (parent #3443, `--queue=false`)
covering the `600acc14f..6a2c8c1ab` delta (13 commits) that landed while this epic's other slices were still
open: `4178` (lane-pool/lane-lease/verify-lane/guard-bash/poc-land landing tooling) and `4180`
(dispatch-contracts rule enforcement, land-seam hold, telemetry). Land both BEFORE this card's own re-diff step
so this sweep's "re-diff origin/main against the branch tip" starts from a smaller residual instead of
re-discovering the same delta from scratch.
