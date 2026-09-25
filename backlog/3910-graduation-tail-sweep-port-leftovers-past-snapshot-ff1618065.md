---
bornAs: xchvd5s
kind: task
parent: "3443"
status: open
blockedBy: ["3487", "3862", "3863", "3485", "3894", "3899", "3896", "3900", "3909", "3904", "3905"]
scope: ["we:AGENTS.md", "we:agent-memory-src/index-meta.md", "we:docs/agent/backlog-workflow.md", "we:docs/agent/dispatcher-runbook.md", "we:docs/agent/platform-decisions.md", "we:docs/agent/testing.md", "we:scripts/conveyor/run-scorecards.json", "we:backlog/3443-graduate-origin-lane-mechanical-dispatcher-to-main-in-small.md", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs", "we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs", "we:scripts/lib/__tests__/review-escalation.test.mjs", "we:scripts/operations/__tests__/review-pr.test.mjs", "we:scripts/conveyor/__tests__/autofix-review-findings.test.mjs", "we:scripts/conveyor/__tests__/fix-autofix-gate.test.mjs", "we:scripts/conveyor/__tests__/parked-pr-conflict-dispatch-integration.test.mjs", "we:scripts/__tests__/pr-land.test.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduation tail sweep: port leftovers past snapshot 600acc14f, docs, and close #3443

Last slice of epic #3443. (1) Re-diff origin/main against the branch tip, which will have moved past snapshot 600acc14f while the other slices landed; port every remaining code change faithfully (no behaviour change), or file a follow-up slice if it is large. (2) Port the branch's doc changes (we:AGENTS.md, we:agent-memory-src/index-meta.md, we:docs/agent/backlog-workflow.md, we:docs/agent/dispatcher-runbook.md, we:docs/agent/platform-decisions.md, we:docs/agent/testing.md) as diffs onto main's current text. (3) we:scripts/conveyor/run-scorecards.json is runtime data, not code: record it as intentionally not ported. (4) Fold the branch-only #3383 and #3105 card narrative into main's cards by hand. (5) Resolve #3443 with the note Done-when 1 asks for. Hold lifted 2026-09-24: the #3857 model-tier table passed a live probe and the operator started wave A.

## Done when

1. **Executable** — `node --check` passes for , and every declared file exists on main.
2. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
3. **Faithful port** — for each ported file, `git diff 600acc14f -- <file>` (prototype snapshot vs main after the port) shows only main's own later changes kept by the merge notes, never a behaviour change of the branch code; runtime data files (e.g. `we:scripts/conveyor/run-scorecards.json`) are never edited.

## Graduation import check

- 2026-09-25: graduation-import-check moved `we:scripts/__tests__/pr-land.test.mjs` here from #3915 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/conveyor/__tests__/parked-pr-conflict-dispatch-integration.test.mjs` here from #3908 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/conveyor/__tests__/fix-autofix-gate.test.mjs` here from #3908 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/conveyor/__tests__/autofix-review-findings.test.mjs` here from #3908 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/review-pr.test.mjs` here from #3907 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/lib/__tests__/review-escalation.test.mjs` here from #3907 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/dispatch-lane.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-25: graduation-import-check added we:scripts/operations/run.mjs to this card's own scope — no open card owned it, and it is imported by `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs`, which this card ports.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs` here from #3903 — it imports a module this card owns.
